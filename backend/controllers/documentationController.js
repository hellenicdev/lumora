import DocumentationVersion from '../models/DocumentationVersion.js';
import { generateAllDocs, generateDocByType } from '../services/documentationService.js';
import { detectDrift, generateQualityScore } from '../services/driftDetection.js';
import { getQueue } from '../jobs/queue.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { recordUsage } from '../middlewares/usage.js';
import { logAuditEvent } from '../utils/audit.js';

export async function listDocs(req, res) {
  try {
    const docs = await DocumentationVersion.find({ repositoryId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    const grouped = {};
    for (const doc of docs) {
      if (!grouped[doc.type]) grouped[doc.type] = [];
      grouped[doc.type].push(doc);
    }

    return success(res, { docs, grouped });
  } catch (err) {
    return error(res, 'Failed to list documentation', 500);
  }
}

export async function generateAll(req, res) {
  try {
    const result = await generateAllDocs(req.params.id, req.user._id);
    await recordUsage(req, 'docGenerations');
    await logAuditEvent({
      userId: req.user._id,
      action: 'documentation.generated',
      resource: 'DocumentationVersion',
      details: { repositoryId: req.params.id, types: 'all' },
      req,
    });
    return success(res, result, 'Documentation generated successfully');
  } catch (err) {
    logger.error('Documentation generation failed', { repositoryId: req.params.id, error: err.message });
    return error(res, 'Failed to generate documentation: ' + err.message, 500);
  }
}

export async function generateByType(req, res) {
  try {
    const { type } = req.params;
    const validTypes = ['README', 'WIKI', 'API_DOC', 'ARCHITECTURE'];

    if (!validTypes.includes(type)) {
      return error(res, 'Invalid documentation type', 400);
    }

    const result = await generateDocByType(req.params.id, type, req.user._id);
    await recordUsage(req, 'docGenerations');
    await logAuditEvent({
      userId: req.user._id,
      action: 'documentation.generated',
      resource: 'DocumentationVersion',
      details: { repositoryId: req.params.id, type },
      req,
    });
    return success(res, result, `${type} generated successfully`);
  } catch (err) {
    logger.error('Documentation type generation failed', { repositoryId: req.params.id, type: req.params.type, error: err.message });
    return error(res, 'Failed to generate documentation: ' + err.message, 500);
  }
}

export async function getDocByType(req, res) {
  try {
    const doc = await DocumentationVersion.findOne({
      repositoryId: req.params.id,
      type: req.params.type,
    }).sort({ createdAt: -1 }).lean();

    if (!doc) {
      return success(res, { doc: null }, 'No documentation found');
    }

    return success(res, { doc });
  } catch (err) {
    return error(res, 'Failed to get documentation', 500);
  }
}

export async function getHistory(req, res) {
  try {
    const docs = await DocumentationVersion.find({
      repositoryId: req.params.id,
    }).sort({ createdAt: -1 }).limit(20).lean();

    return success(res, { history: docs });
  } catch (err) {
    return error(res, 'Failed to get history', 500);
  }
}

export async function checkDrift(req, res) {
  try {
    const result = await detectDrift(req.params.id);
    return success(res, result);
  } catch (err) {
    return error(res, 'Failed to check drift', 500);
  }
}

export async function getQualityScore(req, res) {
  try {
    const result = await generateQualityScore(req.params.id);
    return success(res, result);
  } catch (err) {
    return error(res, 'Failed to get quality score', 500);
  }
}

export async function getDocVersions(req, res) {
  try {
    const docs = await DocumentationVersion.find({
      repositoryId: req.params.id,
      type: req.params.type,
    }).sort({ createdAt: -1 }).lean();

    return success(res, { versions: docs });
  } catch (err) {
    return error(res, 'Failed to get versions', 500);
  }
}
