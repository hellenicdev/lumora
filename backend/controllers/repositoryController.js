import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import AnalysisJob from '../models/AnalysisJob.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { startImport, startReimport, processImport } from '../services/importService.js';
import { getGraph, buildGraph } from '../services/graphService.js';
import { scanRepository } from '../services/scannerService.js';
import { getAccessTokenForUser, fetchFileContent } from '../github/client.js';
import { getQueue } from '../jobs/queue.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAuditEvent } from '../utils/audit.js';
import { recordUsage } from '../middlewares/usage.js';

export async function list(req, res) {
  try {
    const repos = await Repository.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    return success(res, { repositories: repos });
  } catch (err) {
    return error(res, 'Failed to list repositories', 500);
  }
}

export async function getById(req, res) {
  try {
    const repo = await Repository.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!repo) {
      return error(res, 'Repository not found', 404);
    }

    const snapshot = await RepositorySnapshot.findOne({ repositoryId: repo._id })
      .sort({ createdAt: -1 })
      .lean();

    return success(res, { repository: repo, snapshot });
  } catch (err) {
    return error(res, 'Failed to get repository', 500);
  }
}

export async function importRepo(req, res) {
  try {
    const { owner, repo, branch } = req.body;

    if (!owner || !repo) {
      return error(res, 'Owner and repository name required', 400);
    }

    const existing = await Repository.findOne({
      userId: req.user._id,
      fullName: `${owner}/${repo}`,
    });

    if (existing) {
      return error(res, 'Repository already imported', 409);
    }

    const result = await startImport(req.user._id, owner, repo, branch);

    const importQueue = getQueue('repository-import');
    importQueue.add({
      repositoryId: result.repository._id,
      userId: req.user._id,
      owner,
      repo,
      branch: branch || 'main',
      jobId: result.job._id,
    });

    await recordUsage(req, 'repositories');

    await logAuditEvent({
      userId: req.user._id,
      action: 'repository.imported',
      resource: 'Repository',
      resourceId: result.repository._id,
      details: { owner, repo, name: result.repository.fullName },
      req,
    });

    logger.info('Repository import queued', { repositoryId: result.repository._id });

    return success(res, {
      repository: result.repository,
      job: result.job,
    }, 'Import started', 202);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function getFiles(req, res) {
  try {
    const repo = await Repository.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!repo) {
      return error(res, 'Repository not found', 404);
    }

    const snapshot = await RepositorySnapshot.findOne({ repositoryId: repo._id })
      .sort({ createdAt: -1 });

    if (!snapshot || !snapshot.tree) {
      return success(res, { files: [] });
    }

    const files = snapshot.tree
      .filter((item) => item.type === 'blob')
      .map((item) => ({
        path: item.path,
        mode: item.mode,
        size: item.size,
        sha: item.sha,
        url: item.url,
      }));

    return success(res, { files, tree: snapshot.tree });
  } catch (err) {
    return error(res, 'Failed to get files', 500);
  }
}

export async function getRoutes(req, res) {
  try {
    const endpoints = await ApiEndpoint.find({ repositoryId: req.params.id }).lean();
    return success(res, { routes: endpoints });
  } catch (err) {
    return error(res, 'Failed to get routes', 500);
  }
}

export async function getDependencies(req, res) {
  try {
    const deps = await Dependency.find({ repositoryId: req.params.id }).lean();
    return success(res, { dependencies: deps });
  } catch (err) {
    return error(res, 'Failed to get dependencies', 500);
  }
}

export async function getEnvVars(req, res) {
  try {
    const envVars = await EnvironmentVariable.find({ repositoryId: req.params.id }).lean();
    return success(res, { environmentVariables: envVars });
  } catch (err) {
    return error(res, 'Failed to get environment variables', 500);
  }
}

export async function getGraphData(req, res) {
  try {
    let graph = await getGraph(req.params.id);

    if (!graph.nodes || graph.nodes.length === 0) {
      try {
        const repo = await Repository.findOne({ _id: req.params.id, userId: req.user._id });
        if (!repo || !repo.fullName) return success(res, { graph });

        const snapshot = await RepositorySnapshot.findOne({ repositoryId: repo._id }).sort({ createdAt: -1 });
        const tree = snapshot && snapshot.tree && snapshot.tree.length > 0 ? snapshot.tree : null;

        if (tree) {
          const accessToken = await getAccessTokenForUser(req.user._id);
          const [owner, name] = repo.fullName.split('/');
          const repoInfo = { ...repo.toObject(), name, fullName: repo.fullName };
          const results = await scanRepository(req.params.id, accessToken, repoInfo, tree);
          await buildGraph(req.params.id, results);
          graph = await getGraph(req.params.id);
        }
      } catch (buildErr) {
        logger.warn('On-demand graph build failed', { repositoryId: req.params.id, error: buildErr.message });
      }
    }

    return success(res, { graph });
  } catch (err) {
    return error(res, 'Failed to get graph data', 500);
  }
}

export async function resync(req, res) {
  try {
    const repo = await Repository.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!repo) {
      return error(res, 'Repository not found', 404);
    }

    const [owner, name] = repo.fullName.split('/');

    await Promise.all([
      RepositorySnapshot.deleteMany({ repositoryId: repo._id }),
      GraphNode.deleteMany({ repositoryId: repo._id }),
      GraphEdge.deleteMany({ repositoryId: repo._id }),
      ApiEndpoint.deleteMany({ repositoryId: repo._id }),
      Dependency.deleteMany({ repositoryId: repo._id }),
      EnvironmentVariable.deleteMany({ repositoryId: repo._id }),
      KnowledgeChunk.deleteMany({ repositoryId: repo._id }),
    ]);

    const result = await startReimport(repo, req.user._id, owner, name, repo.defaultBranch);

    const importQueue = getQueue('repository-import');
    importQueue.add({
      repositoryId: result.repository._id,
      userId: req.user._id,
      owner,
      repo: name,
      branch: repo.defaultBranch,
      jobId: result.job._id,
    });

    return success(res, { repository: result.repository, job: result.job }, 'Resync started', 202);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function deleteRepo(req, res) {
  try {
    const repo = await Repository.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!repo) {
      return error(res, 'Repository not found', 404);
    }

    await Promise.all([
      RepositorySnapshot.deleteMany({ repositoryId: repo._id }),
      ApiEndpoint.deleteMany({ repositoryId: repo._id }),
      Dependency.deleteMany({ repositoryId: repo._id }),
      EnvironmentVariable.deleteMany({ repositoryId: repo._id }),
    ]);

    await logAuditEvent({
      userId: req.user._id,
      action: 'repository.deleted',
      resource: 'Repository',
      resourceId: repo._id,
      details: { fullName: repo.fullName },
      req,
    });

    return success(res, null, 'Repository deleted');
  } catch (err) {
    return error(res, 'Failed to delete repository', 500);
  }
}

export async function getFileContent(req, res) {
  try {
    const repo = await Repository.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!repo) {
      return error(res, 'Repository not found', 404);
    }

    const [owner, name] = repo.fullName.split('/');
    const content = await fetchFileContent(
      req.user._id,
      owner,
      name,
      req.query.path,
      req.query.ref || repo.lastCommit || repo.defaultBranch,
    );

    return success(res, { content });
  } catch (err) {
    return error(res, 'Failed to get file content', 500);
  }
}
