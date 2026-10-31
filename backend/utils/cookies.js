import config from '../config/index.js';

export function authCookieOptions() {
  const isProd = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // The site is https://hellenicdev.eu and the API is on onrender.com, so
    // session cookies are cross-site. SameSite=None is what lets the browser
    // send them on credentialed fetch. State-changing routes reject unexpected
    // Origin headers instead of relying on SameSite=Lax, which would drop them.
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
}
