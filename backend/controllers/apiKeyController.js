import * as apiKeyService from '../services/apiKeyService.js';
import { success, error } from '../utils/response.js';
import { logAuditEvent } from '../utils/audit.js';

export async function list(req, res) {
  try {
    const apiKeys = await apiKeyService.listApiKeys(req.user._id);
    return success(res, { apiKeys });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function create(req, res) {
  try {
    const { apiKey, rawKey } = await apiKeyService.createApiKey(req.user._id, req.body);

    await logAuditEvent({
      userId: req.user._id,
      action: 'api_key.create',
      resource: 'api_key',
      resourceId: apiKey._id,
      details: { name: apiKey.name, permissions: apiKey.permissions },
      req,
    });

    return success(res, { apiKey, key: rawKey }, 'API key generated. Store it securely — it will not be shown again.', 201);
  } catch (err) {
    if (err.message.includes('Maximum') || err.message.includes('permission')) {
      return error(res, err.message, 400);
    }
    return error(res, err.message, 500);
  }
}

export async function update(req, res) {
  try {
    const apiKey = await apiKeyService.updateApiKey(req.user._id, req.params.id, req.body);
    return success(res, { apiKey }, 'API key updated');
  } catch (err) {
    if (err.message === 'API key not found') return error(res, err.message, 404);
    if (err.message.includes('permission') || err.message === 'Nothing to update') return error(res, err.message, 400);
    return error(res, err.message, 500);
  }
}

export async function remove(req, res) {
  try {
    await apiKeyService.deleteApiKey(req.user._id, req.params.id);

    await logAuditEvent({
      userId: req.user._id,
      action: 'api_key.delete',
      resource: 'api_key',
      resourceId: req.params.id,
      req,
    });

    return success(res, null, 'API key revoked');
  } catch (err) {
    if (err.message === 'API key not found') return error(res, err.message, 404);
    return error(res, err.message, 500);
  }
}
