import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import DocumentationVersion from '../models/DocumentationVersion.js';
import SecurityIncident from '../models/SecurityIncident.js';
import { calculateHealthScore } from './healthService.js';
import { generatePersonality } from './personalityService.js';

export async function generateOnboardingReport(repositoryId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  const nodes = await GraphNode.find({ repositoryId });
  const edges = await GraphEdge.find({ repositoryId });
  const endpoints = await ApiEndpoint.find({ repositoryId });
  const deps = await Dependency.find({ repositoryId });
  const incidents = await SecurityIncident.find({ repositoryId, status: 'open' });
  const docTypes = await DocumentationVersion.find({ repositoryId }).distinct('type');

  const health = await calculateHealthScore(repositoryId);
  let personality = null;
  try {
    const p = await generatePersonality(repositoryId);
    personality = p.personality;
  } catch {}

  const files = snapshot?.tree?.filter((f) => f.type === 'blob') || [];
  const extensions = [...new Set(files.map((f) => f.path.split('.').pop()).filter(Boolean))];

  const techKeywords = {
    js: 'JavaScript', ts: 'TypeScript', jsx: 'React', tsx: 'React',
    py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', rb: 'Ruby',
    php: 'PHP', cs: 'C#', swift: 'Swift', kt: 'Kotlin',
    vue: 'Vue', svelte: 'Svelte', sol: 'Solidity',
  };
  const technologies = [...new Set(extensions.map((e) => techKeywords[e] || null).filter(Boolean))];

  const entryPoints = findEntryPoints(files);

  const missingDocTypes = ['README', 'WIKI', 'API_DOC', 'ARCHITECTURE'].filter((t) => !docTypes.includes(t));

  const topIncidents = incidents
    .sort((a, b) => ({ critical: 4, high: 3, warning: 2, info: 1 }[b.severity] || 0) - ({ critical: 4, high: 3, warning: 2, info: 1 }[a.severity] || 0))
    .slice(0, 5);

  const typeCounts = {};
  nodes.forEach((n) => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });

  return {
    repoName: repo.fullName || repo.name,
    description: repo.description || '',
    language: repo.language,
    filesCount: files.length,
    defaultBranch: repo.defaultBranch || 'main',
    personality,
    overallScore: health.overall,
    subScores: health.categories,
    technologies,
    entryPoints,
    architecture: {
      modules: nodes.length,
      connections: edges.length,
      endpoints: endpoints.length,
      nodeTypes: typeCounts,
    },
    dependencies: {
      total: deps.length,
      production: deps.filter((d) => d.type === 'production').length,
      development: deps.filter((d) => d.type === 'development').length,
    },
    securityConcerns: topIncidents.map((i) => ({
      type: i.type,
      severity: i.severity,
      file: i.file,
      explanation: i.explanation,
      confidence: i.confidence,
    })),
    missingDocumentation: missingDocTypes,
    suggestedFirstIssues: generateSuggestedIssues(health, missingDocTypes, incidents),
    generatedAt: new Date(),
  };
}

function findEntryPoints(files) {
  const patterns = [
    /^index\.(js|ts|mjs)$/, /^main\.(js|ts|py|go|rs|java)$/,
    /^app\.(js|ts|py)$/, /^server\.(js|ts|py)$/,
    /^src\/index\.(js|ts|mjs)$/, /^src\/main\.(js|ts|py|java)$/,
    /^src\/app\.(js|ts|py)$/,
    /package\.json$/, /Cargo\.toml$/, /go\.mod$/, /Gemfile$/,
    /Pipfile$/, /requirements\.txt$/, /pom\.xml$/,
  ];

  return files
    .filter((f) => patterns.some((p) => p.test(f.path)))
    .map((f) => f.path);
}

function generateSuggestedIssues(health, missingDocs, incidents) {
  const issues = [];

  const sorted = Object.entries(health.categories).sort((a, b) => a[1].score - b[1].score);
  const weakest = sorted[0];

  if (weakest) {
    issues.push({ category: weakest[0], priority: 'high', suggestion: `Improve ${weakest[0]} score (currently ${weakest[1].score}/100). ${weakest[1].total > 0 ? 'Address the ' + weakest[1].total + ' related items.' : ''}` });
  }

  if (missingDocs.length > 0) {
    issues.push({ category: 'documentation', priority: 'high', suggestion: `Generate missing documentation: ${missingDocs.join(', ')}.` });
  }

  const critical = incidents.filter((i) => i.severity === 'critical');
  if (critical.length > 0) {
    critical.slice(0, 2).forEach((i) => {
      issues.push({ category: 'security', priority: 'critical', suggestion: `Resolve ${i.type} in ${i.file}:${i.line}. ${i.explanation || ''}` });
    });
  }

  return issues;
}
