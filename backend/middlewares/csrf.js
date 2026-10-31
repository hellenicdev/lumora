import { isAllowedOrigin } from '../config/index.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Server-to-server callbacks do not come from the browser origin.
const EXEMPT = [
  /^\/api\/billing\/webhook$/,
  /^\/api\/webhooks\/github\//,
];

function requestOrigin(req) {
  const origin = req.get('origin');
  if (origin) return origin;
  const referer = req.get('referer');
  if (!referer) return '';
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

export function requireAllowedOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const path = req.originalUrl.split('?')[0];
  if (EXEMPT.some((pattern) => pattern.test(path))) return next();

  const origin = requestOrigin(req);
  if (origin && isAllowedOrigin(origin)) return next();

  const hasAuthCookie = Boolean(
    req.cookies?.lumora_access_token || req.cookies?.lumora_refresh_token
  );
  // Browsers attach these cookies cross-site and send Origin. Clients that
  // authenticate with a bearer token or API key (curl, integrations) do not.
  if (!origin && !hasAuthCookie) return next();

  return res.status(403).json({ success: false, error: 'Cross-site request blocked' });
}
