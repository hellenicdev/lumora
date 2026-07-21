import { generateCompletion } from './aiService.js';
import { getKnowledgeContext } from './knowledgeService.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import Repository from '../models/Repository.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import { logger } from '../utils/logger.js';

export async function generateReadme(repositoryId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const chunks = await KnowledgeChunk.find({ repositoryId });
  const endpoints = await ApiEndpoint.find({ repositoryId });
  const deps = await Dependency.find({ repositoryId });
  const envVars = await EnvironmentVariable.find({ repositoryId });

  const repoContext = buildRepoContext(repo, chunks, endpoints, deps, envVars);

  const prompt = `Generate a professional README.md for the following repository. 
The README must be comprehensive, well-structured, and suitable for open-source or private projects.

Repository Information:
${repoContext}

Generate a complete README with these sections:
1. Project title and short description
2. Features
3. Tech Stack
4. Installation guide
5. Environment variables configuration
6. API documentation (if applicable)
7. Project structure / folder layout
8. Deployment guide
9. Contributing guidelines (brief)
10. License

Use proper markdown formatting. Be specific — reference actual files, endpoints, and technologies detected in the repository.`;

  try {
    const content = await generateCompletion(prompt, {
      temperature: 0.3,
      maxTokens: 2048,
      systemPrompt: 'You are Lumora, an AI documentation engineer. Generate accurate, production-quality README files based on real repository analysis data. Be specific. Use markdown.',
    });

    return content;
  } catch (err) {
    logger.error('README generation failed', { repositoryId, error: err.message });
    throw err;
  }
}

const MAX_README_CONTEXT = 3000;

function buildRepoContext(repo, chunks, endpoints, deps, envVars) {
  let context = `Name: ${repo.fullName || repo.name}\n`;
  context += `Description: ${repo.description || 'N/A'}\n`;
  context += `Language: ${repo.language || 'Unknown'}\n`;
  context += `Files: ${repo.filesCount || '?'}\n\n`;

  const architectureChunks = chunks.filter((c) => c.type === 'architecture');
  if (architectureChunks.length > 0) {
    context += '=== Architecture ===\n';
    for (const chunk of architectureChunks) {
      if (context.length > MAX_README_CONTEXT) break;
      let content = chunk.content;
      const remaining = MAX_README_CONTEXT - context.length;
      if (content.length > remaining - 100) {
        content = content.slice(0, Math.max(remaining - 100, 100)) + '\n... (truncated)';
      }
      context += content + '\n\n';
    }
  }

  if (endpoints.length > 0 && context.length < MAX_README_CONTEXT) {
    context += '=== API Endpoints ===\n';
    const listed = endpoints.slice(0, 20);
    context += listed.map((e) => `${e.method} ${e.path} (${e.file || 'Unknown'})`).join('\n');
    if (endpoints.length > 20) context += `\n... and ${endpoints.length - 20} more`;
    context += '\n\n';
  }

  if (deps.length > 0 && context.length < MAX_README_CONTEXT) {
    context += '=== Dependencies ===\n';
    const prod = deps.filter((d) => d.type === 'production');
    const dev = deps.filter((d) => d.type === 'development');
    const allProd = prod.map((d) => d.name).join(', ');
    const allDev = dev.map((d) => d.name).join(', ');
    const prodStr = allProd.length > 500 ? allProd.slice(0, 500) + '...' : allProd;
    const devStr = allDev.length > 500 ? allDev.slice(0, 500) + '...' : allDev;
    if (prod.length > 0) context += `Production (${prod.length}): ${prodStr}\n`;
    if (dev.length > 0) context += `Development (${dev.length}): ${devStr}\n`;
    context += '\n';
  }

  if (envVars.length > 0 && context.length < MAX_README_CONTEXT) {
    context += '=== Environment Variables ===\n';
    for (const v of envVars) {
      if (context.length > MAX_README_CONTEXT) break;
      context += `${v.name} — ${v.purpose || 'No description'}\n`;
    }
  }

  return context;
}

export async function generateApiDocs(repositoryId) {
  const endpoints = await ApiEndpoint.find({ repositoryId });
  const repo = await Repository.findById(repositoryId);

  if (endpoints.length === 0) {
    return '# API Documentation\n\nNo API endpoints were detected in this repository.';
  }

  let docs = `# API Documentation — ${repo.fullName || repo.name}\n\n`;
  docs += `Auto-generated from source code analysis.\n\n`;
  docs += `## Overview\n\n`;
  docs += `Total endpoints: ${endpoints.length}\n\n`;

  const grouped = {};
  for (const ep of endpoints) {
    const base = '/' + ep.path.split('/').filter(Boolean).slice(0, 2).join('/');
    if (!grouped[base]) grouped[base] = [];
    grouped[base].push(ep);
  }

  for (const [group, eps] of Object.entries(grouped)) {
    docs += `## ${group}\n\n`;
    for (const ep of eps) {
      docs += `### ${ep.method} \`${ep.path}\`\n\n`;
      if (ep.description) docs += `${ep.description}\n\n`;
      docs += `**File:** \`${ep.file || 'Unknown'}\`\n`;
      if (ep.function) docs += `**Handler:** \`${ep.function}\`\n`;
      if (ep.middleware && ep.middleware.length > 0) {
        docs += `**Middleware:** ${ep.middleware.map((m) => `\`${m}\``).join(', ')}\n`;
      }
      docs += `\n---\n\n`;
    }
  }

  return docs;
}
