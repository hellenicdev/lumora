import { setupWebhook, disableWebhook, getWebhookStatus, handleGitHubWebhook } from '../services/webhookService.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function setup(req, res) {
  try {
    const result = await setupWebhook(req.params.id, req.user._id);
    return success(res, { webhook: result }, 'Webhook configured');
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function status(req, res) {
  try {
    const result = await getWebhookStatus(req.params.id, req.user._id);
    return success(res, { webhook: result });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function disable(req, res) {
  try {
    const result = await disableWebhook(req.params.id, req.user._id);
    return success(res, { webhook: result }, 'Webhook disabled');
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function handle(req, res) {
  try {
    const { token } = req.params;
    const payload = { ...req.body, headers: req.headers };
    const result = await handleGitHubWebhook(token, payload);
    return res.status(result.status).json({ message: result.message });
  } catch (err) {
    logger.error('Webhook handler error', { error: err.message });
    return res.status(500).json({ message: 'Internal error' });
  }
}
