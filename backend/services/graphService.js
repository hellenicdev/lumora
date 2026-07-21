import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';

export async function buildGraph(repositoryId, analysisResults) {
  const { files, functions, classes, imports, routes, models, services } = analysisResults;

  const nodeMap = {};

  for (const file of files) {
    const node = await GraphNode.create({
      repositoryId,
      type: 'file',
      name: file.path,
      file: file.path,
      metadata: { size: file.size, extension: file.extension },
    });
    nodeMap[`file:${file.path}`] = node._id;
  }

  for (const fn of functions) {
    const node = await GraphNode.create({
      repositoryId,
      type: 'function',
      name: `${fn.name} (${fn.file})`,
      file: fn.file,
      metadata: { parameters: fn.parameters },
    });
    nodeMap[`function:${fn.name}:${fn.file}`] = node._id;

    if (nodeMap[`file:${fn.file}`]) {
      await createEdge(repositoryId, nodeMap[`file:${fn.file}`], node._id, 'CONTAINS');
    }
  }

  for (const cls of classes) {
    const node = await GraphNode.create({
      repositoryId,
      type: 'class',
      name: `${cls.name} (${cls.file})`,
      file: cls.file,
      metadata: { extends: cls.extends },
    });
    nodeMap[`class:${cls.name}:${cls.file}`] = node._id;

    if (nodeMap[`file:${cls.file}`]) {
      await createEdge(repositoryId, nodeMap[`file:${cls.file}`], node._id, 'CONTAINS');
    }
  }

  for (const route of routes) {
    const node = await GraphNode.create({
      repositoryId,
      type: 'route',
      name: `${route.method} ${route.path}`,
      file: route.file,
      metadata: { method: route.method, path: route.path },
    });
    nodeMap[`route:${route.method}:${route.path}`] = node._id;

    if (nodeMap[`file:${route.file}`]) {
      await createEdge(repositoryId, nodeMap[`file:${route.file}`], node._id, 'CONTAINS');
    }
  }

  for (const imp of imports) {
    if (nodeMap[`file:${imp.file}`]) {
      const target = nodeMap[`file:${imp.source}`];
      if (target) {
        await createEdge(repositoryId, nodeMap[`file:${imp.file}`], target, 'IMPORTS');
      }
    }
  }

  return true;
}

async function createEdge(repositoryId, sourceId, targetId, type) {
  try {
    await GraphEdge.create({ repositoryId, sourceId, targetId, type });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

export async function getGraph(repositoryId) {
  const nodes = await GraphNode.find({ repositoryId }).lean();
  const edges = await GraphEdge.find({ repositoryId }).lean();
  return { nodes, edges };
}
