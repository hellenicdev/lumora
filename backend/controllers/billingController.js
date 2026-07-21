import * as kofi from '../services/kofi.js';
import User from '../models/User.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

export async function getPlans(req, res) {
  try {
    const plans = await kofi.getPlans();
    return success(res, { plans });
  } catch (err) {
    return error(res, 'Failed to load plans', 500);
  }
}

export async function getSubscription(req, res) {
  return success(res, {
    subscription: req.user.role === 'pro' || req.user.role === 'team_admin' ? {
      plan: req.user.role === 'team_admin' ? 'team' : 'pro',
      status: 'active',
    } : null,
  });
}

export async function webhook(req, res) {
  const body = req.body;

  if (!kofi.verifyWebhook(body)) {
    logger.warn('Ko-fi webhook verification failed');
    return res.status(401).json({ error: 'Invalid verification token' });
  }

  const data = body.data || {};
  const email = data.email;
  const tierName = data.tier_name || '';
  const type = body.type || body.event || '';

  logger.info('Ko-fi webhook received', { type, tier: tierName, email });

  try {
    const isSubStarted = type.toLowerCase().includes('subscription') &&
      (type.toLowerCase().includes('start') || type.toLowerCase().includes('new'));

    if (isSubStarted && email) {
      const role = tierName.toLowerCase().includes('team') ? 'team_admin' : 'pro';
      const result = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: { role } },
      );
      if (result) {
        logger.info('Ko-fi subscription activated', { email, role });
      } else {
        logger.warn('Ko-fi subscriber not found in Lumora', { email });
      }
    }

    const isSubStopped = type.toLowerCase().includes('subscription') &&
      (type.toLowerCase().includes('stop') || type.toLowerCase().includes('cancel') || type.toLowerCase().includes('end'));

    if (isSubStopped && email) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user && (user.role === 'pro' || user.role === 'team_admin')) {
        user.role = 'user';
        await user.save();
        logger.info('Ko-fi subscription ended, user downgraded', { email });
      }
    }
  } catch (err) {
    logger.error('Ko-fi webhook handler error', { error: err.message });
  }

  res.json({ received: true });
}

export async function getKoFiLink(req, res) {
  try {
    const { plan } = req.query;
    if (!plan) return error(res, 'Plan parameter required', 400);

    const plans = await kofi.getPlans();
    const found = plans.find(p => p.id === plan);
    if (!found || !found.kofiUrl) return error(res, 'Plan not found or not available', 404);

    return success(res, { url: found.kofiUrl });
  } catch (err) {
    return error(res, 'Failed to get payment link', 500);
  }
}
