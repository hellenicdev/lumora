import SecurityIncident from '../models/SecurityIncident.js';
import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import User from '../models/User.js';
import { getIO } from '../socket/index.js';
import { sendEmail } from './emailService.js';
import { logger } from '../utils/logger.js';

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'critical' },
  { name: 'AWS Secret Key', pattern: /aws.{0,20}(?:key|secret).{0,20}['"][0-9a-zA-Z\/+]{40}['"]/gi, severity: 'critical' },
  { name: 'GitHub Token', pattern: /ghp_[0-9a-zA-Z]{36}/g, severity: 'critical' },
  { name: 'GitHub Old Token', pattern: /gho_[0-9a-zA-Z]{36}/g, severity: 'critical' },
  { name: 'Stripe Live Key', pattern: /sk_live_[0-9a-zA-Z]{24,}/g, severity: 'critical' },
  { name: 'Stripe Test Key', pattern: /sk_test_[0-9a-zA-Z]{24,}/g, severity: 'warning' },
  { name: 'Stripe Publishable Key', pattern: /pk_live_[0-9a-zA-Z]{24,}/g, severity: 'warning' },
  { name: 'JWT Secret', pattern: /(?:jwt|secret|token).{0,10}=.{0,10}['"][0-9a-zA-Z!@#$%^&*()_+]{32,}['"]/g, severity: 'high' },
  { name: 'MongoDB URI', pattern: /mongodb(?:\+srv)?:\/\/[^\s'"]+/g, severity: 'high' },
  { name: 'PostgreSQL URI', pattern: /postgres(?:\+ssl)?:\/\/[^\s'"]+/g, severity: 'high' },
  { name: 'MySQL URI', pattern: /mysql:\/\/[^\s'"]+/g, severity: 'high' },
  { name: 'Redis URI', pattern: /redis:\/\/[^\s'"]+/g, severity: 'high' },
  { name: 'Private Key', pattern: /-----BEGIN\s?(?:RSA\s?)?PRIVATE\s?KEY-----/g, severity: 'critical' },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g, severity: 'high' },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/g, severity: 'high' },
  { name: 'Heroku API Key', pattern: /(?:heroku|api_key).{0,10}=.{0,10}['"][0-9a-f-]{36}['"]/gi, severity: 'high' },
  { name: 'Generic Password', pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, severity: 'high' },
];

export async function scanRepository(repositoryId, userId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  if (!snapshot || !snapshot.tree) {
    throw new Error('No repository snapshot found. Import the repository first.');
  }

  const fileEntries = snapshot.tree.filter((item) => item.type === 'blob');

  const textExtensions = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.css', '.html',
    '.md', '.yaml', '.yml', '.py', '.java', '.go', '.rs', '.php', '.rb',
    '.sh', '.bash', '.env', '.cfg', '.conf', '.ini', '.xml', '.toml',
    '.txt', '.gitignore', '.dockerfile', '.gradle', '.lock',
  ]);

  const findings = [];

  for (const file of fileEntries) {
    const ext = '.' + file.path.split('.').pop()?.toLowerCase();
    if (!textExtensions.has(ext)) continue;

    try {
      const content = await fetchFileContent(repo, file.path);
      if (!content) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of SECRET_PATTERNS) {
          const matches = line.match(pattern.pattern);
          if (matches) {
            for (const match of matches) {
              findings.push({
                repositoryId,
                type: pattern.name,
                severity: pattern.severity,
                file: file.path,
                line: i + 1,
                maskedValue: maskValue(match),
                status: 'open',
              });
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  const uniqueFindings = deduplicate(findings);

  for (const finding of uniqueFindings) {
    const existing = await SecurityIncident.findOne({
      repositoryId: finding.repositoryId,
      file: finding.file,
      line: finding.line,
      type: finding.type,
      status: 'open',
    });

    if (!existing) {
      const incident = await SecurityIncident.create(finding);

      if (finding.severity === 'critical') {
        notifyCritical(userId, repo, incident);
      }
    }
  }

  const allOpen = await SecurityIncident.find({ repositoryId, status: 'open' });

  return {
    newFindings: uniqueFindings.length,
    openIncidents: allOpen.length,
    criticalCount: allOpen.filter((i) => i.severity === 'critical').length,
    warningCount: allOpen.filter((i) => i.severity === 'warning').length,
    highCount: allOpen.filter((i) => i.severity === 'high').length,
  };
}

async function fetchFileContent(repo, path) {
  const response = await fetch(`https://api.github.com/repos/${repo.fullName}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_ACCESS_TOKEN || ''}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  if (data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }
  return null;
}

function maskValue(value) {
  if (value.length <= 8) return value[0] + '***' + value[value.length - 1];
  return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
}

function deduplicate(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.file}:${f.line}:${f.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function notifyCritical(userId, repo, incident) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('notification.new', {
      type: 'critical',
      title: '🚨 Critical: Secret detected',
      message: `${incident.type} found in ${repo.fullName}/${incident.file}:${incident.line}`,
    });

    const user = await User.findById(userId);
    if (user && user.email) {
      await sendEmail({
        to: user.email,
        subject: '🚨 Lumora Security Alert: Secret Detected in ' + repo.name,
        html: buildSecurityAlertEmail(repo, incident),
      });
    }
  } catch (err) {
    logger.error('Failed to send security alert', { userId, error: err.message });
  }
}

function buildSecurityAlertEmail(repo, incident) {
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px">
      <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:12px;padding:24px;margin-bottom:24px">
        <h1 style="color:#ef4444;margin:0 0 8px;font-size:22px">🚨 Critical Security Alert</h1>
        <p style="color:#991b1b;margin:0">Lumora detected a sensitive credential inside your repository.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Repository</td><td style="padding:8px 0;font-weight:600">${repo.fullName || repo.name}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Secret Type</td><td style="padding:8px 0;font-weight:600">${incident.type}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Location</td><td style="padding:8px 0;font-weight:600">${incident.file}:${incident.line}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Severity</td><td style="padding:8px 0;font-weight:600;color:#ef4444">CRITICAL</td></tr>
      </table>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
        <h3 style="margin:0 0 8px;font-size:15px">Recommended Actions</h3>
        <ol style="margin:0;padding-left:20px;font-size:14px;color:#374151">
          <li style="margin-bottom:6px">Rotate the credential immediately.</li>
          <li style="margin-bottom:6px">Remove it from the repository.</li>
          <li style="margin-bottom:6px">Review recent usage for unauthorized access.</li>
          <li style="margin-bottom:6px">Add it to environment variables instead.</li>
        </ol>
      </div>
      <p style="font-size:13px;color:#9ca3af;text-align:center">Lumora — AI-powered codebase intelligence</p>
    </div>
  `;
}

export async function getSecurityReport(repositoryId) {
  const incidents = await SecurityIncident.find({ repositoryId }).sort({ severity: 1, createdAt: -1 });

  const open = incidents.filter((i) => i.status === 'open');
  const resolved = incidents.filter((i) => i.status === 'resolved');

  const critical = open.filter((i) => i.severity === 'critical');
  const high = open.filter((i) => i.severity === 'high');
  const warning = open.filter((i) => i.severity === 'warning');

  const score = calculateSecurityScore(open.length, critical.length, high.length);

  return {
    score,
    total: incidents.length,
    openCount: open.length,
    resolvedCount: resolved.length,
    criticalCount: critical.length,
    highCount: high.length,
    warningCount: warning.length,
    critical,
    high,
    warning,
    recentScan: incidents[0]?.createdAt || null,
  };
}

function calculateSecurityScore(open, critical, high) {
  let score = 100;
  score -= critical * 15;
  score -= high * 8;
  score -= (open - critical - high) * 3;
  return Math.max(0, Math.min(100, score));
}

export async function resolveIncident(incidentId, userId) {
  const incident = await SecurityIncident.findByIdAndUpdate(
    incidentId,
    { status: 'resolved', resolvedAt: new Date(), resolvedBy: userId },
    { new: true },
  );
  if (!incident) throw new Error('Incident not found');
  return incident;
}

export async function dismissIncident(incidentId) {
  const incident = await SecurityIncident.findByIdAndUpdate(
    incidentId,
    { status: 'dismissed' },
    { new: true },
  );
  if (!incident) throw new Error('Incident not found');
  return incident;
}
