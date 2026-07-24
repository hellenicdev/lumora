import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import SecurityIncident from '../models/SecurityIncident.js';
import { generateQualityScore } from './driftDetection.js';

const WEIGHTS = {
  architecture: 0.15,
  documentation: 0.20,
  complexity: 0.10,
  dependencies: 0.10,
  security: 0.25,
  testing: 0.10,
  maintainability: 0.10,
};

export async function calculateHealthScore(repositoryId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const scores = await Promise.all([
    scoreArchitecture(repositoryId),
    scoreDocumentation(repositoryId),
    scoreComplexity(repositoryId),
    scoreDependencies(repositoryId),
    scoreSecurity(repositoryId),
    scoreTesting(repositoryId),
    scoreMaintainability(repositoryId),
  ]);

  const overall = Math.round(
    scores.reduce((sum, s, i) => sum + s.score * Object.values(WEIGHTS)[i], 0)
  );

  return {
    overall,
    categories: {
      architecture: scores[0],
      documentation: scores[1],
      complexity: scores[2],
      dependencies: scores[3],
      security: scores[4],
      testing: scores[5],
      maintainability: scores[6],
    },
    recommendations: generateRecommendations(scores, repo),
  };
}

async function scoreArchitecture(repositoryId) {
  const nodes = await GraphNode.find({ repositoryId });
  const edges = await GraphEdge.find({ repositoryId });
  const endpoints = await ApiEndpoint.find({ repositoryId });

  let score = 80;

  const circularDeps = detectCircularDependencies(edges);
  if (circularDeps.length > 0) score -= circularDeps.length * 5;

  const nodesWithoutConnections = nodes.filter((n) =>
    !edges.some((e) => e.sourceId.equals(n._id) || e.targetId.equals(n._id))
  );
  if (nodesWithoutConnections.length > nodes.length * 0.3) score -= 10;

  if (endpoints.length > 0 && !endpoints.some((e) => e.middleware?.length > 0)) score -= 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    circularDependencies: circularDeps.length,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalEndpoints: endpoints.length,
  };
}

async function scoreDocumentation(repositoryId) {
  const quality = await generateQualityScore(repositoryId);
  let score = quality.score;

  if (score === 0) score = 10;

  const envVars = await EnvironmentVariable.find({ repositoryId });
  if (envVars.length > 0 && !quality.details?.apiDocs) {
    score -= 5;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    hasReadme: quality.details?.readme || false,
    hasWiki: quality.details?.wiki || false,
    hasApiDocs: quality.details?.apiDocs || false,
    hasArchitecture: quality.details?.architecture || false,
    driftIssues: quality.driftIssues || 0,
  };
}

async function scoreComplexity(repositoryId) {
  let score = 85;
  const issues = [];

  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  if (snapshot && snapshot.filesCount) {
    if (snapshot.filesCount > 200) { score -= 15; issues.push('Large repository (>200 files)'); }
    else if (snapshot.filesCount > 100) { score -= 5; issues.push('Moderate repository size'); }
  }

  const largeFiles = await detectLargeFiles(repositoryId);
  if (largeFiles.length > 0) {
    score -= largeFiles.length * 3;
    issues.push(`${largeFiles.length} large file(s) detected`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    largeFiles: largeFiles.slice(0, 5),
  };
}

async function scoreDependencies(repositoryId) {
  const deps = await Dependency.find({ repositoryId });
  let score = 80;

  const prodDeps = deps.filter((d) => d.type === 'production');
  const devDeps = deps.filter((d) => d.type === 'development');

  if (prodDeps.length > 50) score -= 10;
  else if (prodDeps.length > 20) score -= 5;

  if (deps.length === 0) score = 30;

  return {
    score: Math.max(0, Math.min(100, score)),
    production: prodDeps.length,
    development: devDeps.length,
    total: deps.length,
    outdated: 0,
  };
}

async function scoreSecurity(repositoryId) {
  const open = await SecurityIncident.find({ repositoryId, status: 'open' });
  let score = 100;

  const critical = open.filter((i) => i.severity === 'critical').length;
  const high = open.filter((i) => i.severity === 'high').length;
  const warning = open.filter((i) => i.severity === 'warning').length;

  score -= critical * 15;
  score -= high * 8;
  score -= warning * 3;

  return {
    score: Math.max(0, Math.min(100, score)),
    critical,
    high,
    warning,
    total: open.length,
  };
}

async function scoreTesting(repositoryId) {
  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  if (!snapshot || !snapshot.tree || !snapshot.filesCount) {
    return { score: 30, testFiles: 0, totalFiles: 0, ratio: 0 };
  }

  const testPatterns = /\.(test|spec)\.|__tests__\/|_test\./i;
  const testFiles = snapshot.tree.filter((f) => f.type === 'blob' && testPatterns.test(f.path)).length;
  const totalFiles = snapshot.tree.filter((f) => f.type === 'blob').length;
  const ratio = totalFiles > 0 ? testFiles / totalFiles : 0;

  let score = 30;
  if (ratio >= 0.3) score = 90;
  else if (ratio >= 0.2) score = 75;
  else if (ratio >= 0.1) score = 55;
  else if (ratio > 0) score = 40;

  return {
    score,
    testFiles,
    totalFiles,
    ratio: Math.round(ratio * 100),
  };
}

async function scoreMaintainability(repositoryId) {
  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  if (!snapshot || !snapshot.tree) {
    return { score: 50, largeFiles: 0, deepDirs: 0, totalFiles: 0 };
  }

  const files = snapshot.tree.filter((f) => f.type === 'blob');
  const dirs = new Set(files.map((f) => f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : 'root'));
  const avgDepth = files.length > 0
    ? Math.round(files.reduce((sum, f) => sum + f.path.split('/').length - 1, 0) / files.length)
    : 0;
  const largeFiles = files.filter((f) => f.size > 50000).length;

  let score = 80;
  if (files.length > 200) score -= 10;
  else if (files.length > 100) score -= 5;
  if (largeFiles > 5) score -= 10;
  else if (largeFiles > 2) score -= 5;
  if (avgDepth > 5) score -= 10;
  else if (avgDepth > 3) score -= 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    totalFiles: files.length,
    largeFiles,
    avgDepth,
    totalDirs: dirs.size,
  };
}

function detectCircularDependencies(edges) {
  const adjList = {};
  for (const edge of edges) {
    if (edge.type === 'IMPORTS') {
      const src = edge.sourceId.toString();
      const tgt = edge.targetId.toString();
      if (!adjList[src]) adjList[src] = [];
      adjList[src].push(tgt);
    }
  }

  const circular = [];
  const visited = new Set();
  const recStack = new Set();

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adjList[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, path)) return true;
      } else if (recStack.has(neighbor)) {
        const cycle = path.slice(path.indexOf(neighbor));
        circular.push(cycle);
        return true;
      }
    }

    path.pop();
    recStack.delete(node);
    return false;
  }

  for (const node of Object.keys(adjList)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return circular;
}

async function detectLargeFiles(repositoryId) {
  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  if (!snapshot || !snapshot.tree) return [];

  return snapshot.tree
    .filter((item) => item.type === 'blob' && item.size > 50000)
    .map((item) => ({
      path: item.path,
      size: item.size,
      sizeKB: Math.round(item.size / 1024),
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
}

function generateRecommendations(scores, repo) {
  const recs = [];
  const [arch, docs, complexity, deps, security, testing, maintain] = scores;

  if (arch.score < 60) {
    recs.push({ category: 'architecture', severity: 'high', message: 'Improve architecture by reducing circular dependencies and adding middleware to API routes.' });
  }

  if (!docs.hasReadme) {
    recs.push({ category: 'documentation', severity: 'high', message: 'Generate a README file for your repository.' });
  }

  if (complexity.issues?.length > 0) {
    recs.push({ category: 'complexity', severity: 'medium', message: `Refactor large files: ${complexity.issues.join(', ')}` });
  }

  if (deps.total === 0) {
    recs.push({ category: 'dependencies', severity: 'low', message: 'No dependencies detected. Consider adding package manager files.' });
  }

  if (security.critical > 0) {
    recs.push({ category: 'security', severity: 'high', message: `${security.critical} critical security incident(s) require immediate attention.` });
  }

  if (testing.ratio < 10) {
    recs.push({ category: 'testing', severity: 'medium', message: `Only ${testing.testFiles} test file(s) found. Add more tests to improve maintainability.` });
  }

  if (maintain.largeFiles > 3) {
    recs.push({ category: 'maintainability', severity: 'medium', message: `${maintain.largeFiles} file(s) exceed 50KB. Consider splitting them into smaller modules.` });
  }

  return recs;
}
