import { listIntegrations, createIntegration, updateIntegration, deleteIntegration, testIntegration } from '../services/integrationService.js';
import { success, error } from '../utils/response.js';

export async function list(req, res) {
  try {
    const integrations = await listIntegrations(req.user._id);
    return success(res, { integrations });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function create(req, res) {
  try {
    const integration = await createIntegration(req.user._id, req.body);
    return success(res, { integration }, 'Integration created');
  } catch (err) {
    if (err.message.includes('Maximum')) return error(res, err.message, 400);
    return error(res, err.message, 500);
  }
}

export async function update(req, res) {
  try {
    const integration = await updateIntegration(req.user._id, req.params.id, req.body);
    return success(res, { integration }, 'Integration updated');
  } catch (err) {
    if (err.message === 'Integration not found') return error(res, err.message, 404);
    return error(res, err.message, 500);
  }
}

export async function remove(req, res) {
  try {
    await deleteIntegration(req.user._id, req.params.id);
    return success(res, null, 'Integration deleted');
  } catch (err) {
    if (err.message === 'Integration not found') return error(res, err.message, 404);
    return error(res, err.message, 500);
  }
}

export async function test(req, res) {
  try {
    const result = await testIntegration(req.user._id, req.params.id);
    return success(res, result, result.success ? 'Test successful' : 'Test failed');
  } catch (err) {
    return error(res, err.message, 500);
  }
}
