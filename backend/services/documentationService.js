import DocumentationVersion from '../models/DocumentationVersion.js';
import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { generateReadme, generateApiDocs } from './readmeGenerator.js';
import { generateWiki } from './wikiGenerator.js';
import { buildKnowledgeBase } from './knowledgeService.js';
import { getIO } from '../socket/index.js';
import { logger } from '../utils/logger.js';

export async function generateAllDocs(repositoryId, userId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  notifyUser(userId, 'info', 'Documentation generation started', repo.fullName);

  await buildKnowledgeBase(repositoryId, userId);

  notifyProgress(userId, repositoryId, 20);

  const readme = await generateReadme(repositoryId);
  await DocumentationVersion.create({
    repositoryId,
    type: 'README',
    title: 'README.md',
    content: readme,
    commitHash: repo.lastCommit,
    generatedBy: 'ai',
  });

  notifyProgress(userId, repositoryId, 40);

  const apiDocs = await generateApiDocs(repositoryId);
  await DocumentationVersion.create({
    repositoryId,
    type: 'API_DOC',
    title: 'API Documentation',
    content: apiDocs,
    commitHash: repo.lastCommit,
    generatedBy: 'ai',
  });

  notifyProgress(userId, repositoryId, 60);

  const wikiPages = await generateWiki(repositoryId);
  for (const page of wikiPages) {
    await DocumentationVersion.create({
      repositoryId,
      type: 'WIKI',
      title: page.title,
      content: page.content,
      commitHash: repo.lastCommit,
      generatedBy: 'ai',
    });
  }

  notifyProgress(userId, repositoryId, 80);

  const architectureDoc = await generateArchitectureDoc(repositoryId, repo);
  await DocumentationVersion.create({
    repositoryId,
    type: 'ARCHITECTURE',
    title: 'Architecture Overview',
    content: architectureDoc,
    commitHash: repo.lastCommit,
    generatedBy: 'ai',
  });

  notifyProgress(userId, repositoryId, 100);

  notifyUser(userId, 'success', 'Documentation generated', `${repo.fullName} — README, Wiki, API docs, and architecture docs created.`);

  return { readme, wiki: wikiPages, apiDocs, architecture: architectureDoc };
}

async function generateArchitectureDoc(repositoryId, repo) {
  var snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 }).lean();
  var nodes = await GraphNode.find({ repositoryId }).lean();
  var edges = await GraphEdge.find({ repositoryId }).lean();
  var archChunks = await KnowledgeChunk.find({ repositoryId, type: 'architecture' }).lean();

  var lines = [];
  lines.push('# Architecture Overview — ' + (repo.fullName || repo.name));
  lines.push('');
  if (repo.description) {
    lines.push('> ' + repo.description);
    lines.push('');
  }

  lines.push('## Project Summary');
  lines.push('');
  lines.push('- **Language**: ' + (repo.language || 'Unknown'));
  lines.push('- **Files**: ' + (repo.filesCount || (snapshot && snapshot.tree ? snapshot.tree.filter(function (f) { return f.type === 'blob'; }).length : 'N/A')));
  lines.push('- **Default Branch**: ' + (repo.defaultBranch || 'main'));
  if (repo.size) lines.push('- **Repository Size**: ' + formatSize(repo.size));
  lines.push('');

  if (snapshot && snapshot.tree && snapshot.tree.length > 0) {
    var dirs = {};
    var exts = {};
    var totalSize = 0;
    var fileCount = 0;

    snapshot.tree.forEach(function (item) {
      if (item.type !== 'blob') return;
      fileCount++;
      if (item.size) totalSize += item.size;
      var parts = item.path.split('/');
      if (parts.length > 1) {
        var root = parts[0];
        dirs[root] = (dirs[root] || 0) + 1;
      }
      var dot = item.path.lastIndexOf('.');
      if (dot > 0) {
        var ext = item.path.substring(dot).toLowerCase();
        exts[ext] = (exts[ext] || 0) + 1;
      }
    });

    var topDirs = Object.keys(dirs).sort(function (a, b) { return dirs[b] - dirs[a]; }).slice(0, 8);
    var topExts = Object.keys(exts).sort(function (a, b) { return exts[b] - exts[a]; }).slice(0, 8);

    lines.push('## File Structure');
    lines.push('');
    lines.push('| Directory | Files |');
    lines.push('|-----------|-------|');
    topDirs.forEach(function (d) {
      lines.push('| `' + d + '/` | ' + dirs[d] + ' |');
    });
    lines.push('');

    lines.push('## File Types');
    lines.push('');
    lines.push('| Extension | Count |');
    lines.push('|-----------|-------|');
    topExts.forEach(function (ext) {
      lines.push('| `' + ext + '` | ' + exts[ext] + ' |');
    });
    lines.push('');
  }

  var routeNodes = nodes.filter(function (n) { return n.type === 'route'; });
  var modelNodes = nodes.filter(function (n) { return n.type === 'model'; });
  var serviceNodes = nodes.filter(function (n) { return n.type === 'service'; });
  var classNodes = nodes.filter(function (n) { return n.type === 'class'; });
  var funcNodes = nodes.filter(function (n) { return n.type === 'function'; });
  var depNodes = nodes.filter(function (n) { return n.type === 'dependency'; });

  if (routeNodes.length > 0) {
    lines.push('## API Routes');
    lines.push('');
    lines.push('| Route | File |');
    lines.push('|-------|------|');
    routeNodes.forEach(function (r) {
      lines.push('| `' + (r.name || '') + '` | `' + (r.file || '') + '` |');
    });
    lines.push('');
  }

  if (modelNodes.length > 0) {
    lines.push('## Data Models');
    lines.push('');
    modelNodes.forEach(function (m) {
      var meta = m.metadata || {};
      lines.push('- **' + m.name + '**' + (meta.fields ? ' — Fields: ' + Object.keys(meta.fields).join(', ') : '') + (m.file ? ' (`' + m.file + '`)' : ''));
    });
    lines.push('');
  }

  if (serviceNodes.length > 0) {
    lines.push('## Services');
    lines.push('');
    serviceNodes.forEach(function (s) {
      lines.push('- **' + s.name + '**' + (s.file ? ' (`' + s.file + '`)' : ''));
    });
    lines.push('');
  }

  if (classNodes.length > 0) {
    lines.push('## Classes');
    lines.push('');
    classNodes.forEach(function (c) {
      lines.push('- **' + c.name + '**' + (c.file ? ' (`' + c.file + '`)' : ''));
    });
    lines.push('');
  }

  if (funcNodes.length > 0) {
    lines.push('## Key Functions');
    lines.push('');
    funcNodes.slice(0, 20).forEach(function (f) {
      lines.push('- `' + f.name + '`' + (f.file ? ' — `' + f.file + '`' : ''));
    });
    if (funcNodes.length > 20) {
      lines.push('- *... and ' + (funcNodes.length - 20) + ' more functions*');
    }
    lines.push('');
  }

  if (depNodes.length > 0) {
    lines.push('## Dependencies');
    lines.push('');
    depNodes.slice(0, 30).forEach(function (d) {
      var meta = d.metadata || {};
      lines.push('- **' + d.name + '**' + (meta.version ? ' ' + meta.version : '') + (d.file ? ' — `' + d.file + '`' : ''));
    });
    if (depNodes.length > 30) {
      lines.push('- *... and ' + (depNodes.length - 30) + ' more dependencies*');
    }
    lines.push('');
  }

  if (edges.length > 0) {
    var edgeTypes = {};
    edges.forEach(function (e) {
      edgeTypes[e.type] = (edgeTypes[e.type] || 0) + 1;
    });

    lines.push('## Module Relationships');
    lines.push('');
    lines.push('| Relationship Type | Count |');
    lines.push('|-------------------|-------|');
    Object.keys(edgeTypes).sort().forEach(function (t) {
      lines.push('| `' + t + '` | ' + edgeTypes[t] + ' |');
    });
    lines.push('');
  }

  if (archChunks.length > 0) {
    lines.push('## Architecture Notes');
    lines.push('');
    archChunks.forEach(function (chunk) {
      lines.push('### ' + chunk.title);
      lines.push('');
      lines.push(chunk.content.substring(0, 500));
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');
  lines.push('*Architecture documentation auto-generated by Lumora AI.*');

  return lines.join('\n');
}

function formatSize(bytes) {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export async function generateDocByType(repositoryId, type, userId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  let content;
  let title;

  switch (type) {
    case 'README':
      content = await generateReadme(repositoryId);
      title = 'README.md';
      break;
    case 'API_DOC':
      content = await generateApiDocs(repositoryId);
      title = 'API Documentation';
      break;
    case 'ARCHITECTURE':
      content = await generateArchitectureDoc(repositoryId, repo);
      title = 'Architecture Overview';
      break;
    case 'WIKI': {
      const pages = await generateWiki(repositoryId);
      for (const page of pages) {
        await DocumentationVersion.create({
          repositoryId,
          type: 'WIKI',
          title: page.title,
          content: page.content,
          commitHash: repo.lastCommit,
          generatedBy: 'ai',
        });
      }
      notifyUser(userId, 'success', 'Wiki generated', `Wiki pages created for ${repo.fullName}`);
      return { wiki: pages };
    }
    default:
      throw new Error('Invalid documentation type');
  }

  const doc = await DocumentationVersion.create({
    repositoryId,
    type,
    title,
    content,
    commitHash: repo.lastCommit,
    generatedBy: 'ai',
  });

  notifyUser(userId, 'success', `${title} generated`, `Documentation updated for ${repo.fullName}`);

  return { [type.toLowerCase()]: doc };
}

function notifyUser(userId, type, title, message) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('notification.new', { type, title, message });
  } catch {}
}

function notifyProgress(userId, repositoryId, progress) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('analysis.progress', {
      repositoryId,
      progress,
      type: 'documentation',
    });
  } catch {}
}
