import crypto from 'crypto';
import WebhookConfig from '../models/WebhookConfig.js';
import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { startReimport } from './importService.js';
import { getQueue } from '../jobs/queue.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

export async function setupWebhook(repositoryId, userId) {
  const repo = await Repository.findOne({ _id: repositoryId, userId });
  if (!repo) throw new Error('Repository not found');

  let configRecord = await WebhookConfig.findOne({ repositoryId });

  if (configRecord) {
    configRecord.secret = crypto.randomBytes(32).toString('hex');
    configRecord.active = true;
    await configRecord.save();
  } else {
    configRecord = await WebhookConfig.create({ repositoryId, userId });
  }

  const webhookUrl = `${getBackendUrl()}/api/webhooks/github/${configRecord.secret}`;

  return {
    webhookUrl,
    secret: configRecord.secret,
    active: configRecord.active,
    events: configRecord.events,
  };
}

export async function disableWebhook(repositoryId, userId) {
  const configRecord = await WebhookConfig.findOneAndUpdate(
    { repositoryId, userId },
    { active: false },
    { new: true }
  );
  if (!configRecord) throw new Error('Webhook not found');
  return configRecord;
}

export async function getWebhookStatus(repositoryId, userId) {
  const repo = await Repository.findOne({ _id: repositoryId, userId });
  if (!repo) throw new Error('Repository not found');

  const configRecord = await WebhookConfig.findOne({ repositoryId });
  if (!configRecord) return { active: false, events: [], lastDelivery: null, lastStatus: null };
  return {
    active: configRecord.active,
    events: configRecord.events,
    secret: configRecord.secret,
    lastDelivery: configRecord.lastDelivery,
    lastStatus: configRecord.lastStatus,
    webhookUrl: `${getBackendUrl()}/api/webhooks/github/${configRecord.secret}`,
  };
}

export async function handleGitHubWebhook(token, payload) {
  const configRecord = await WebhookConfig.findOne({ secret: token, active: true });
  if (!configRecord) {
    logger.warn('Webhook called with invalid or inactive token');
    return { status: 404, message: 'Webhook not found or inactive' };
  }

  const event = payload?.headers?.['x-github-event'] || 'push';

  if (!configRecord.events.includes(event)) {
    configRecord.lastDelivery = new Date();
    configRecord.lastStatus = 'success';
    await configRecord.save();
    return { status: 200, message: `Event '${event}' ignored (not configured)` };
  }

  const repo = await Repository.findById(configRecord.repositoryId);
  if (!repo) {
    logger.error('Webhook: repository not found', { repositoryId: configRecord.repositoryId });
    return { status: 404, message: 'Repository not found' };
  }

  const [owner, name] = repo.fullName.split('/');
  const branch = payload?.ref?.replace('refs/heads/', '') || repo.defaultBranch;

  try {
    await RepositorySnapshot.deleteMany({ repositoryId: repo._id });
    await Promise.all([
      GraphNode.deleteMany({ repositoryId: repo._id }),
      GraphEdge.deleteMany({ repositoryId: repo._id }),
      ApiEndpoint.deleteMany({ repositoryId: repo._id }),
      Dependency.deleteMany({ repositoryId: repo._id }),
      EnvironmentVariable.deleteMany({ repositoryId: repo._id }),
      KnowledgeChunk.deleteMany({ repositoryId: repo._id }),
    ]);

    const result = await startReimport(repo, configRecord.userId, owner, name, branch);

    const importQueue = getQueue('repository-import');
    importQueue.add({
      repositoryId: result.repository._id,
      userId: configRecord.userId,
      owner,
      repo: name,
      branch,
    });

    configRecord.lastDelivery = new Date();
    configRecord.lastStatus = 'success';
    await configRecord.save();

    logger.info('Webhook: reimport triggered', { repositoryId: repo._id, event });
    return { status: 200, message: 'Reimport triggered' };
  } catch (err) {
    configRecord.lastDelivery = new Date();
    configRecord.lastStatus = 'failure';
    await configRecord.save();
    logger.error('Webhook: reimport failed', { repositoryId: repo._id, error: err.message });
    return { status: 500, message: 'Reimport failed: ' + err.message };
  }
}

function getBackendUrl() {
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
  }
  if (config.frontendUrl && config.frontendUrl !== 'http://localhost:3060') {
    return config.frontendUrl.replace(/\/+$/, '');
  }
  return `http://localhost:${config.port}`;
}
