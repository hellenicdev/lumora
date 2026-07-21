import KnowledgeChunk from '../models/KnowledgeChunk.js';
import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import { fetchFileContent } from '../github/client.js';
import { logger } from '../utils/logger.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
  '.json', '.css', '.html', '.md', '.yaml', '.yml', '.py', '.java',
  '.go', '.rs', '.php', '.rb', '.sh', '.bash', '.env', '.cfg',
  '.conf', '.ini', '.xml', '.toml', '.txt', '.gitignore', '.dockerfile',
  '.gradle', '.lock', '.vue', '.svelte', '.astro', '.sql', '.graphql',
  '.prisma', '.hbs', '.ejs', '.pug', '.scss', '.less', '.styl',
  '.swift', '.kt', '.kts', '.dart', '.ex', '.exs', '.erl', '.hrl',
  '.clj', '.cljs', '.cljc', '.lua', '.r', '.m', '.mm', '.c', '.h',
  '.cpp', '.hpp', '.cs', '.fs', '.fsx', '.nim', '.zig', '.scala',
]);

const MAX_FILE_SIZE = 15360;
const MAX_FILE_CHUNKS = 30;

export async function buildKnowledgeBase(repositoryId, userId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  await KnowledgeChunk.deleteMany({ repositoryId });

  const chunks = [];

  chunks.push(...await buildFileChunks(repositoryId, repo));
  if (userId && repo.fullName) {
    chunks.push(...await buildFileContentChunks(repositoryId, repo, userId));
  }
  chunks.push(...await buildRouteChunks(repositoryId));
  chunks.push(...await buildDependencyChunks(repositoryId));
  chunks.push(...await buildEnvVarChunks(repositoryId));
  chunks.push(...await buildArchitectureChunks(repositoryId, repo));

  if (chunks.length === 0) {
    logger.warn('No knowledge chunks generated', { repositoryId });
    return [];
  }

  const inserted = await KnowledgeChunk.insertMany(chunks);
  logger.info('Knowledge base built', { repositoryId, chunks: inserted.length });

  return inserted;
}

const SOURCE_PRIORITY = [
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.py', '.go', '.rs', '.java',
  '.rb', '.php', '.swift', '.kt', '.cs', '.vue', '.svelte',
];

async function buildFileContentChunks(repositoryId, repo, userId) {
  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  if (!snapshot || !snapshot.tree) return [];

  const [owner, name] = repo.fullName.split('/');
  if (!owner || !name) return [];

  const textFiles = snapshot.tree.filter(function (item) {
    if (item.type !== 'blob') return false;
    const dot = item.path.lastIndexOf('.');
    if (dot === -1) return false;
    const ext = item.path.slice(dot).toLowerCase();
    return TEXT_EXTENSIONS.has(ext);
  });

  textFiles.sort(function (a, b) {
    const aExt = a.path.includes('.') ? '.' + a.path.split('.').pop() : '';
    const bExt = b.path.includes('.') ? '.' + b.path.split('.').pop() : '';
    const aScore = SOURCE_PRIORITY.indexOf(aExt);
    const bScore = SOURCE_PRIORITY.indexOf(bExt);
    if (aScore !== -1 && bScore !== -1) return aScore - bScore;
    if (aScore !== -1) return -1;
    if (bScore !== -1) return 1;
    return a.path.localeCompare(b.path);
  });

  const toFetch = textFiles.slice(0, MAX_FILE_CHUNKS);
  const chunks = [];

  for (const file of toFetch) {
    try {
      if (file.size && file.size > MAX_FILE_SIZE) continue;

      const content = await fetchFileContent(userId, owner, name, file.path, repo.defaultBranch || 'main');
      if (!content || content.length > MAX_FILE_SIZE) continue;

      chunks.push({
        repositoryId,
        type: 'source',
        title: file.path,
        content: '```' + getExtension(file.path) + '\n' + content.slice(0, MAX_FILE_SIZE) + '\n```',
        sourceFile: file.path,
        metadata: { size: file.size || content.length, extension: getExtension(file.path) },
      });
    } catch (err) {
      continue;
    }
  }

  return chunks;
}

function getExtension(path) {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1);
}

async function buildFileChunks(repositoryId, repo) {
  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  if (!snapshot || !snapshot.tree) return [];

  const files = snapshot.tree.filter((item) => item.type === 'blob');
  const language = repo.language || 'Unknown';

  return [{
    repositoryId,
    type: 'architecture',
    title: `${repo.name} — Project Overview`,
    content: `Repository: ${repo.fullName || repo.name}
Description: ${repo.description || 'No description'}
Language: ${language}
Files: ${files.length}
Default Branch: ${repo.defaultBranch || 'main'}
Last Commit: ${repo.lastCommit || 'N/A'}`,
    sourceFile: null,
    metadata: { filesCount: files.length, language },
  }];
}

async function buildRouteChunks(repositoryId) {
  const endpoints = await ApiEndpoint.find({ repositoryId });
  return endpoints.map((ep) => ({
    repositoryId,
    type: 'route',
    title: `${ep.method} ${ep.path}`,
    content: `Endpoint: ${ep.method} ${ep.path}
File: ${ep.file || 'N/A'}
Handler: ${ep.function || 'N/A'}
Middleware: ${(ep.middleware || []).join(', ') || 'None'}
Description: ${ep.description || 'Auto-detected route'}`,
    sourceFile: ep.file,
    metadata: { method: ep.method, path: ep.path },
  }));
}

async function buildDependencyChunks(repositoryId) {
  const deps = await Dependency.find({ repositoryId });
  if (deps.length === 0) return [];

  const production = deps.filter((d) => d.type === 'production');
  const development = deps.filter((d) => d.type === 'development');

  return [{
    repositoryId,
    type: 'dependency',
    title: 'Dependencies',
    content: `Production Dependencies (${production.length}):
${production.map((d) => `- ${d.name}@${d.version || 'latest'}`).join('\n')}

Development Dependencies (${development.length}):
${development.map((d) => `- ${d.name}@${d.version || 'latest'}`).join('\n')}`,
    sourceFile: 'package.json',
    metadata: { productionCount: production.length, devCount: development.length },
  }];
}

async function buildEnvVarChunks(repositoryId) {
  const envVars = await EnvironmentVariable.find({ repositoryId });
  if (envVars.length === 0) return [];

  return [{
    repositoryId,
    type: 'env_var',
    title: 'Environment Variables',
    content: envVars.map((v) =>
      `${v.name}
  Used in: ${(v.files || []).join(', ') || 'Unknown'}
  Purpose: ${v.purpose || 'Unknown'}
  ---`
    ).join('\n'),
    sourceFile: null,
    metadata: { count: envVars.length },
  }];
}

async function buildArchitectureChunks(repositoryId, repo) {
  const nodes = await GraphNode.find({ repositoryId });
  const edges = await GraphEdge.find({ repositoryId });

  const fileNodes = nodes.filter((n) => n.type === 'file').map((n) => n.name);
  const routeNodes = nodes.filter((n) => n.type === 'route').map((n) => n.name);
  const classNodes = nodes.filter((n) => n.type === 'class').map((n) => n.name);
  const functionNodes = nodes.filter((n) => n.type === 'function').map((n) => n.name);

  const chunks = [];

  if (fileNodes.length > 0) {
    chunks.push({
      repositoryId,
      type: 'architecture',
      title: 'File Structure',
      content: `The repository contains ${fileNodes.length} analyzed files:

${fileNodes.map((f) => `- ${f}`).join('\n')}`,
      sourceFile: null,
      metadata: { count: fileNodes.length },
    });
  }

  if (routeNodes.length > 0) {
    chunks.push({
      repositoryId,
      type: 'architecture',
      title: 'API Routes',
      content: `Detected API endpoints (${routeNodes.length}):

${routeNodes.map((r) => `- ${r}`).join('\n')}`,
      sourceFile: null,
      metadata: { count: routeNodes.length },
    });
  }

  if (edges.length > 0) {
    const importEdges = edges.filter((e) => e.type === 'IMPORTS');
    chunks.push({
      repositoryId,
      type: 'architecture',
      title: 'Module Dependencies',
      content: `Import relationships (${importEdges.length}):

${importEdges.slice(0, 50).map((e) => {
        const source = nodes.find((n) => n._id.equals(e.sourceId));
        const target = nodes.find((n) => n._id.equals(e.targetId));
        return `- ${source ? source.name : '?'} → ${target ? target.name : '?'}`;
      }).join('\n')}${importEdges.length > 50 ? `\n... and ${importEdges.length - 50} more` : ''}`,
      sourceFile: null,
      metadata: { count: edges.length },
    });
  }

  return chunks;
}

const MAX_CONTEXT_CHARS = 4000;

export async function searchKnowledge(repositoryId, query, maxResults = 5) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  const chunks = await KnowledgeChunk.find({ repositoryId });

  const scored = chunks.map((chunk) => {
    const content = (chunk.content || '').toLowerCase();
    const title = (chunk.title || '').toLowerCase();
    let score = 0;

    for (const word of words) {
      if (title.includes(word)) score += 3;
      if (content.includes(word)) score += 1;
    }

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.chunk);
}

export async function getKnowledgeContext(repositoryId, query) {
  const relevant = await searchKnowledge(repositoryId, query, 5);
  const repo = await Repository.findById(repositoryId);

  let context = `Repository: ${repo.fullName || repo.name}\n`;
  context += `Description: ${repo.description || 'N/A'}\n`;
  context += `Language: ${repo.language || 'Unknown'}\n\n`;

  let remaining = MAX_CONTEXT_CHARS - context.length;

  for (const chunk of relevant) {
    if (remaining <= 0) break;

    const header = `[${chunk.type.toUpperCase()}] ${chunk.title}\n`;
    let content = chunk.content || '';

    const maxContentLen = remaining - header.length - 2;
    if (maxContentLen <= 0) break;

    if (content.length > maxContentLen) {
      content = content.slice(0, maxContentLen - 100) + '\n... (truncated)';
    }

    context += header + content + '\n\n';
    remaining = MAX_CONTEXT_CHARS - context.length;
  }

  return context;
}
