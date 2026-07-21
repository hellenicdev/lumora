import User from '../models/User.js';
import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import SecurityIncident from '../models/SecurityIncident.js';
import DocumentationVersion from '../models/DocumentationVersion.js';
import UsageRecord from '../models/UsageRecord.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import { logger } from '../utils/logger.js';

export async function ensureIndexes() {
  const models = [
    { model: User, indexes: [{ email: 1 }, { 'refreshTokens.token': 1 }, { githubId: 1 }] },
    { model: Repository, indexes: [{ userId: 1, updatedAt: -1 }, { userId: 1, fullName: 1 }, { fullName: 1 }] },
    { model: RepositorySnapshot, indexes: [{ repositoryId: 1, createdAt: -1 }, { 'tree.path': 1 }] },
    { model: KnowledgeChunk, indexes: [{ repositoryId: 1 }, { repositoryId: 1, file: 1 }, { 'keywords': 'text' }] },
    { model: ChatSession, indexes: [{ userId: 1, updatedAt: -1 }, { repositoryId: 1 }] },
    { model: ChatMessage, indexes: [{ sessionId: 1, createdAt: 1 }] },
    { model: SecurityIncident, indexes: [{ repositoryId: 1, status: 1 }, { severity: 1, createdAt: -1 }, { status: 1 }] },
    { model: DocumentationVersion, indexes: [{ repositoryId: 1, createdAt: -1 }, { repositoryId: 1, type: 1 }] },
    { model: UsageRecord, indexes: [{ userId: 1, month: 1, type: 1 }] },
    { model: Notification, indexes: [{ userId: 1, createdAt: -1 }, { userId: 1, read: 1 }] },
    { model: AuditLog, indexes: [{ userId: 1, createdAt: -1 }, { action: 1 }, { createdAt: -1 }] },
    { model: GraphNode, indexes: [{ repositoryId: 1, type: 1 }, { repositoryId: 1, name: 1 }] },
    { model: GraphEdge, indexes: [{ repositoryId: 1 }, { sourceId: 1, targetId: 1 }] },
  ];

  let total = 0;
  for (const { model, indexes } of models) {
    for (const index of indexes) {
      try {
        await model.collection.createIndex(index, { background: true });
        total++;
      } catch (err) {
        logger.warn('Index creation failed for ' + model.modelName, { index, error: err.message });
      }
    }
  }

  logger.info(`Ensured ${total} MongoDB indexes`);
}
