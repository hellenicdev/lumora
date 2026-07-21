import { trackUsage, checkLimit } from '../services/usageService.js';
import { error } from '../utils/response.js';

const ROLE_PLAN_MAP = {
  guest: 'free',
  user: 'free',
  pro: 'pro',
  team_admin: 'team',
  system_admin: 'enterprise',
};

function getPlan(user) {
  return ROLE_PLAN_MAP[user.role] || 'free';
}

export function enforceLimit(type) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next();

      const plan = getPlan(req.user);
      const result = await checkLimit(req.user._id, plan, type);

      if (!result.allowed) {
        return error(res, `You have reached your ${plan} plan limit for ${type}. Upgrade to continue.`, 403);
      }

      req._usageLimit = result;
      next();
    } catch {
      next();
    }
  };
}

export async function recordUsage(req, type) {
  try {
    if (req.user) {
      await trackUsage(req.user._id, type);
    }
  } catch {}
}

export { getPlan };
