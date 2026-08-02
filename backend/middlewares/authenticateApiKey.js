import ApiKey from '../models/ApiKey.js';
import User from '../models/User.js';
import { hashApiKey } from '../services/apiKeyService.js';

export async function authenticateApiKey(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    let key = '';
    if (authHeader.startsWith('Bearer ')) {
      key = authHeader.split(' ')[1];
    } else if (req.headers['x-api-key']) {
      key = req.headers['x-api-key'];
    }

    if (!key) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const apiKey = await ApiKey.findOne({ hashedKey: hashApiKey(key) });
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    const user = await User.findById(apiKey.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    ApiKey.updateOne({ _id: apiKey._id }, { lastUsed: new Date() }).catch(() => {});

    req.apiKey = apiKey;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
}
