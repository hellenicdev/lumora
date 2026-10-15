import { calculateHealthScore } from '../services/healthService.js';
import { scanRepository, getSecurityReport, resolveIncident, dismissIncident } from '../services/securityService.js';
import { generatePersonality } from '../services/personalityService.js';
import { generateArchitectureDiagram, getArchitectureInsights as getArchitectureInsightsService } from '../services/architectureService.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { recordUsage } from '../middlewares/usage.js';
import { logAuditEvent } from '../utils/audit.js';
import { getOwnedRepoOr404 } from '../utils/ownership.js';

export async function getHealth(req, res) {
  try {
    const repo = await getOwnedRepoOr404(req, res);
    if (!repo) return;
    const health = await calculateHealthScore(req.params.id);
    return success(res, { health });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function getSecurity(req, res) {
  try {
    const repo = await getOwnedRepoOr404(req, res);
    if (!repo) return;
    const report = await getSecurityReport(req.params.id);
    return success(res, { report });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function runSecurityScan(req, res) {
  try {
    const repo = await getOwnedRepoOr404(req, res);
    if (!repo) return;
    const result = await scanRepository(req.params.id, req.user._id);
    await recordUsage(req, 'securityScans');
    await logAuditEvent({
      userId: req.user._id,
      action: 'security.scan_completed',
      resource: 'Repository',
      resourceId: req.params.id,
      details: result,
      req,
    });
    return success(res, result, 'Security scan completed');
  } catch (err) {
    logger.error('Security scan failed', { repositoryId: req.params.id, error: err.message });
    return error(res, err.message, 500);
  }
}

export async function resolveSecurityIncident(req, res) {
  try {
    const incident = await resolveIncident(req.params.incidentId, req.user._id);
    return success(res, { incident }, 'Incident resolved');
  } catch (err) {
    return error(res, err.message, 404);
  }
}

export async function dismissSecurityIncident(req, res) {
  try {
    const incident = await dismissIncident(req.params.incidentId, req.user._id);
    return success(res, { incident }, 'Incident dismissed');
  } catch (err) {
    return error(res, err.message, 404);
  }
}

export async function getPersonality(req, res) {
  try {
    const repo = await getOwnedRepoOr404(req, res);
    if (!repo) return;
    const personality = await generatePersonality(req.params.id);
    return success(res, { personality });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function analyzeImpact(req, res) {
  try {
    const { file } = req.body;
    if (!file) return error(res, 'File path required', 400);
    const repo = await getOwnedRepoOr404(req, res);
    if (!repo) return;

    const { generateChangeImpact } = await import('../services/chatService.js');
    const analysis = await generateChangeImpact(req.params.id, file);
    return success(res, { analysis });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function getArchitecture(req, res) {
  try {
    const repo = await getOwnedRepoOr404(req, res);
    if (!repo) return;
    const diagram = await generateArchitectureDiagram(req.params.id);
    return success(res, { diagram });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function getArchitectureInsights(req, res) {
  try {
    const repo = await getOwnedRepoOr404(req, res);
    if (!repo) return;
    const insights = await getArchitectureInsightsService(req.params.id);
    return success(res, { insights });
  } catch (err) {
    return error(res, err.message, 500);
  }
}
