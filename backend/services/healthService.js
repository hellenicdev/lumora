import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import { generateQualityScore } from './driftDetection.js';

export async function calculateHealthScore(repositoryId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const scores = await Promise.all([
    scoreArchitecture(repositoryId),
    scoreDocumentation(repositoryId),
    scoreComplexity(repositoryId),
    scoreDependencies(repositoryId),
  ]);

  const total = scores.reduce((sum, s) => sum + s.score, 0);
  const overall = Math.round(total / scores.length);

  return {
    overall,
    categories: {
      architecture: scores[0],
      documentation: scores[1],
      complexity: scores[2],
      dependencies: scores[3],
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

  if (scores[0].score < 60) {
    recs.push({ category: 'architecture', severity: 'high', message: 'Improve architecture by reducing circular dependencies and adding middleware to API routes.' });
  }

  if (!scores[1].hasReadme) {
    recs.push({ category: 'documentation', severity: 'high', message: 'Generate a README file for your repository.' });
  }

  if (scores[2].issues.length > 0) {
    recs.push({ category: 'complexity', severity: 'medium', message: `Refactor large files: ${scores[2].issues.join(', ')}` });
  }

  if (scores[3].total === 0) {
    recs.push({ category: 'dependencies', severity: 'low', message: 'No dependencies detected. Consider adding package manager files.' });
  }

  return recs;
}
