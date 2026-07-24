import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';

export async function generateArchitectureDiagram(repositoryId) {
  const nodes = await GraphNode.find({ repositoryId }).lean();
  const edges = await GraphEdge.find({ repositoryId }).lean();
  const endpoints = await ApiEndpoint.find({ repositoryId }).lean();
  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 }).lean();

  const moduleMap = {};

  nodes.forEach((n) => {
    const mod = n.module || 'unknown';
    if (!moduleMap[mod]) {
      moduleMap[mod] = { name: mod, files: [], fileCount: 0, type: mod === 'unknown' ? 'other' : n.type || 'module' };
    }
    moduleMap[mod].files.push(n.name || n.path);
    moduleMap[mod].fileCount = moduleMap[mod].files.length;
  });

  const modules = Object.values(moduleMap);
  const connections = edges.map((e) => ({
    source: e.source,
    target: e.target,
    type: e.type || 'import',
    weight: e.weight || 1,
  }));

  const endpointGroups = {};
  endpoints.forEach((e) => {
    const group = e.path ? e.path.split('/')[1] || 'other' : 'other';
    if (!endpointGroups[group]) endpointGroups[group] = [];
    endpointGroups[group].push({ method: e.method, path: e.path, description: e.description });
  });

  const moduleConnections = {};
  edges.forEach((e) => {
    const src = e.sourceModule || 'unknown';
    const tgt = e.targetModule || 'unknown';
    if (src !== tgt) {
      const key = `${src}->${tgt}`;
      moduleConnections[key] = (moduleConnections[key] || 0) + 1;
    }
  });

  const moduleEdges = Object.entries(moduleConnections)
    .map(([key, weight]) => {
      const [source, target] = key.split('->');
      return { source, target, weight };
    })
    .sort((a, b) => b.weight - a.weight);

  const tree = buildTree(snapshot?.tree || []);
  const totalFiles = snapshot?.tree?.filter((f) => f.type === 'blob').length || 0;

  return {
    modules,
    moduleEdges,
    connections,
    apiEndpoints: endpointGroups,
    tree,
    totalFiles,
    stats: {
      totalModules: modules.length,
      totalConnections: edges.length,
      totalEndpoints: endpoints.length,
      moduleEdgesCount: moduleEdges.length,
    },
  };
}

function buildTree(files) {
  const root = { name: '/', type: 'directory', children: {} };

  const safeFiles = Array.isArray(files) ? files : [];

  safeFiles.forEach((f) => {
    if (!f.path) return;
    const parts = f.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1 && f.type === 'blob';
      const name = parts[i];
      if (isFile) {
        if (!current.children[name]) {
          current.children[name] = { name, type: 'file', path: f.path };
        }
      } else {
        if (!current.children[name]) {
          current.children[name] = { name, type: 'directory', children: {} };
        }
        current = current.children[name];
      }
    }
  });

  function prune(node) {
    if (node.type === 'file') return node;
    const kids = Object.values(node.children).map(prune);
    return { ...node, children: kids };
  }

  return prune(root);
}

export async function getArchitectureInsights(repositoryId) {
  const diagram = await generateArchitectureDiagram(repositoryId);

  const insights = [];

  if (diagram.modules.length === 0) {
    insights.push({ type: 'warning', message: 'No modules detected. Repository may not be fully analyzed.' });
  } else if (diagram.modules.length === 1) {
    insights.push({ type: 'info', message: 'Single module architecture — consider splitting into smaller modules.' });
  } else if (diagram.modules.length > 10) {
    insights.push({ type: 'good', message: `Well-modularized: ${diagram.modules.length} modules detected.` });
  }

  const highCoupled = diagram.moduleEdges.filter((e) => e.weight > 5);
  if (highCoupled.length > 0) {
    highCoupled.forEach((e) => {
      insights.push({
        type: 'warning',
        message: `High coupling between '${e.source}' and '${e.target}' (${e.weight} connections). Consider refactoring.`,
      });
    });
  }

  const unconnected = diagram.modules
    .filter((m) => !diagram.moduleEdges.some((e) => e.source === m.name || e.target === m.name))
    .map((m) => m.name);
  if (unconnected.length > 0) {
    insights.push({
      type: 'warning',
      message: `Disconnected modules: ${unconnected.join(', ')}. They may be unused or dead code.`,
    });
  }

  const endpointCount = diagram.totalEndpoints;
  if (endpointCount === 0) {
    insights.push({ type: 'info', message: 'No API endpoints detected. This may be a library or frontend project.' });
  } else if (endpointCount > 30) {
    insights.push({ type: 'warning', message: `Large API surface: ${endpointCount} endpoints. Consider versioning and grouping.` });
  }

  return insights;
}
