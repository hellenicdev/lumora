import DocumentationVersion from '../models/DocumentationVersion.js';
import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import { logger } from '../utils/logger.js';

export async function detectDrift(repositoryId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const latestDoc = await DocumentationVersion.findOne({ repositoryId })
    .sort({ createdAt: -1 });

  if (!latestDoc) {
    return { hasDrift: false, message: 'No documentation exists yet.', issues: [] };
  }

  const issues = [];

  const currentSnapshot = await RepositorySnapshot.findOne({ repositoryId })
    .sort({ createdAt: -1 });

  if (currentSnapshot && latestDoc.commitHash && currentSnapshot.commitHash !== latestDoc.commitHash) {
    issues.push({
      type: 'code_change',
      severity: 'warning',
      message: 'Code has changed since documentation was generated.',
      detail: `Documentation was based on commit ${latestDoc.commitHash.slice(0, 8)}, current is ${currentSnapshot.commitHash.slice(0, 8)}.`,
    });
  }

  const currentEndpoints = await ApiEndpoint.find({ repositoryId });
  const docEndpoints = extractEndpointsFromDoc(latestDoc.content);

  if (docEndpoints.length > 0 && currentEndpoints.length !== docEndpoints.length) {
    const missing = currentEndpoints.filter(
      (ep) => !docEndpoints.includes(`${ep.method} ${ep.path}`)
    );
    const removed = docEndpoints.filter(
      (ep) => !currentEndpoints.some((c) => `${c.method} ${c.path}` === ep)
    );

    if (missing.length > 0) {
      issues.push({
        type: 'missing_endpoints',
        severity: 'warning',
        message: `${missing.length} API endpoint(s) not documented.`,
        detail: missing.map((m) => `${m.method} ${m.path}`).join(', '),
      });
    }

    if (removed.length > 0) {
      issues.push({
        type: 'removed_endpoints',
        severity: 'info',
        message: `${removed.length} endpoint(s) documented but no longer exist in code.`,
        detail: removed.join(', '),
      });
    }
  }

  const currentDeps = await Dependency.find({ repositoryId });
  const depNames = currentDeps.map((d) => d.name);

  if (depNames.length > 0 && latestDoc.content) {
    const missingDeps = depNames.filter(
      (name) => !latestDoc.content.toLowerCase().includes(name.toLowerCase())
    );

    if (missingDeps.length > 5) {
      issues.push({
        type: 'missing_dependencies',
        severity: 'info',
        message: `${missingDeps.length} dependencies not mentioned in documentation.`,
        detail: missingDeps.slice(0, 5).join(', ') + '...',
      });
    }
  }

  return {
    hasDrift: issues.length > 0,
    commitHash: currentSnapshot?.commitHash || null,
    issues,
    score: calculateScore(issues),
  };
}

function extractEndpointsFromDoc(content) {
  const lines = content.split('\n');
  const endpoints = [];
  const pattern = /(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+`([^`]+)`/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    endpoints.push(`${match[1]} ${match[2]}`);
  }
  return endpoints;
}

function calculateScore(issues) {
  const weights = {
    code_change: 10,
    missing_endpoints: 15,
    removed_endpoints: 5,
    missing_dependencies: 5,
  };

  let deduction = 0;
  for (const issue of issues) {
    deduction += weights[issue.type] || 5;
  }

  return Math.max(0, 100 - deduction);
}

export async function generateQualityScore(repositoryId) {
  const docVersions = await DocumentationVersion.find({ repositoryId }).sort({ createdAt: -1 });

  if (docVersions.length === 0) {
    return { score: 0, details: { readme: false, wiki: false, apiDocs: false, architecture: false } };
  }

  const types = docVersions.reduce((acc, doc) => {
    acc[doc.type] = true;
    return acc;
  }, {});

  let score = 0;
  const weights = { README: 30, WIKI: 25, API_DOC: 25, ARCHITECTURE: 20 };

  for (const [type, weight] of Object.entries(weights)) {
    if (types[type]) score += weight;
  }

  const driftResult = await detectDrift(repositoryId);
  if (driftResult.hasDrift) {
    score = Math.max(0, score - driftResult.score);
  }

  return {
    score,
    details: {
      readme: !!types.README,
      wiki: !!types.WIKI,
      apiDocs: !!types.API_DOC,
      architecture: !!types.ARCHITECTURE,
    },
    driftIssues: driftResult.issues.length,
    driftScore: driftResult.score,
  };
}
