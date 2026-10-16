import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    const cookieToken = req.cookies && req.cookies.lumora_access_token;
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    let token = null;
    if (cookieToken) {
      try {
        jwt.verify(cookieToken, config.jwt.secret);
        token = cookieToken;
      } catch (err) {
        // Fall back to an explicitly supplied bearer token when the cookie is
        // expired/tampered/malformed.
        token = bearerToken;
      }
    } else {
      token = bearerToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}
