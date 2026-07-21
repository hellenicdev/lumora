import crypto from 'crypto';
import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import AnalysisJob from '../models/AnalysisJob.js';
import { getAccessTokenForUser, fetchFileContent } from '../github/client.js';
import { getIO } from '../socket/index.js';
import { logger } from '../utils/logger.js';
import { scanRepository, extractFileMetadata, isSupportedFile } from './scannerService.js';
import { buildGraph } from './graphService.js';

export async function startImport(userId, owner, repo, branch) {
  const accessToken = await getAccessTokenForUser(userId);

  const repoInfo = await fetchGitHubRepoInfo(accessToken, owner, repo);

  const repository = await Repository.create({
    userId,
    githubId: repoInfo.id,
    name: repoInfo.name,
    fullName: repoInfo.full_name,
    description: repoInfo.description,
    private: repoInfo.private,
    language: repoInfo.language,
    defaultBranch: branch || repoInfo.default_branch,
    cloneUrl: repoInfo.clone_url,
    analysisStatus: 'pending',
  });

  const job = await AnalysisJob.create({
    userId,
    repositoryId: repository._id,
    type: 'import',
    status: 'queued',
  });

  notifyUser(userId, 'info', 'Repository import started', `${repoInfo.full_name}`);

  return { repository, job };
}

export async function startReimport(repository, userId, owner, repo, branch) {
  const accessToken = await getAccessTokenForUser(userId);
  const repoInfo = await fetchGitHubRepoInfo(accessToken, owner, repo);

  const updated = await Repository.findByIdAndUpdate(repository._id, {
    description: repoInfo.description,
    language: repoInfo.language,
    defaultBranch: branch || repoInfo.default_branch,
    cloneUrl: repoInfo.clone_url,
    analysisStatus: 'pending',
  }, { new: true });

  const job = await AnalysisJob.create({
    userId,
    repositoryId: repository._id,
    type: 'import',
    status: 'queued',
  });

  notifyUser(userId, 'info', 'Repository reimport started', `${repoInfo.full_name}`);

  return { repository: updated, job };
}

export async function processImport(job) {
  const { repositoryId, userId, jobId } = job.data;
  const updateProgress = (progress) => updateJobProgress(jobId, repositoryId, userId, progress);

  try {
    await AnalysisJob.findByIdAndUpdate(jobId, { status: 'running', progress: 0 });
    await Repository.findByIdAndUpdate(repositoryId, { analysisStatus: 'analyzing' });

    updateProgress(5);

    const repository = await Repository.findById(repositoryId);
    const accessToken = await getAccessTokenForUser(userId);

    const repoData = await fetchGitHubRepoInfo(accessToken, repository.fullName.split('/')[0], repository.name);
    const defaultBranch = repository.defaultBranch;

    updateProgress(15);

    const tree = await fetchRepoTree(accessToken, repository.fullName.split('/')[0], repository.name, defaultBranch);

    updateProgress(30);

    const files = flattenTree(tree.tree);
    const fileCount = files.length;

    updateProgress(50);

    const snapshot = await RepositorySnapshot.create({
      repositoryId,
      commitHash: tree.sha,
      branch: defaultBranch,
      filesCount: fileCount,
      size: estimateSize(tree.tree),
      tree: tree.tree,
    });

    updateProgress(70);

    await Repository.findByIdAndUpdate(repositoryId, {
      lastCommit: tree.sha,
      filesCount: fileCount,
      size: estimateSize(tree.tree),
    });

    let analysisResults = { files: [], functions: [], classes: [], imports: [], routes: [], models: [], services: [] };
    try {
      analysisResults = await scanRepository(repositoryId, accessToken, repository, tree.tree || files);
    } catch (err) {
      logger.warn('Static analysis failed', { repositoryId, error: err.message });
    }

    updateProgress(80);

    try {
      await buildGraph(repositoryId, analysisResults);
    } catch (err) {
      logger.warn('Graph build failed', { repositoryId, error: err.message });
    }

    updateProgress(90);

    await AnalysisJob.findByIdAndUpdate(jobId, { status: 'completed', progress: 100 });
    await Repository.findByIdAndUpdate(repositoryId, { analysisStatus: 'completed' });

    notifyUser(userId, 'success', 'Repository imported', `${repository.fullName} imported successfully with ${fileCount} files.`);

    return { repositoryId, snapshotId: snapshot._id, filesCount: fileCount };
  } catch (err) {
    await AnalysisJob.findByIdAndUpdate(jobId, { status: 'failed', error: err.message });
    await Repository.findByIdAndUpdate(repositoryId, { analysisStatus: 'failed' });
    notifyUser(userId, 'error', 'Import failed', err.message);
    throw err;
  }
}

async function fetchGitHubRepoInfo(accessToken, owner, repo) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  return response.json();
}

async function fetchRepoTree(accessToken, owner, repo, branch) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  );
  if (!response.ok) throw new Error(`Failed to fetch tree: ${response.status}`);
  return response.json();
}

function flattenTree(tree) {
  return tree.filter((item) => item.type === 'blob');
}

function estimateSize(tree) {
  return tree.reduce((sum, item) => sum + (item.size || 0), 0);
}

function updateJobProgress(jobId, repositoryId, userId, progress) {
  AnalysisJob.findByIdAndUpdate(jobId, { progress }).catch(() => {});
  const io = getIO();
  io.to(`user:${userId}`).emit('analysis.progress', {
    jobId,
    repositoryId,
    progress,
  });
}

function notifyUser(userId, type, title, message) {
  const io = getIO();
  io.to(`user:${userId}`).emit('notification.new', { type, title, message });
}
