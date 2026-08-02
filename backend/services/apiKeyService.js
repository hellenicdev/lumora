import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';

const MAX_KEYS_PER_USER = 10;
const VALID_PERMISSIONS = ['repositories:read', 'reports:read'];

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function listApiKeys(userId) {
  return ApiKey.find({ userId }).select('-hashedKey').sort({ createdAt: -1 }).lean();
}

export async function createApiKey(userId, data) {
  const count = await ApiKey.countDocuments({ userId });
  if (count >= MAX_KEYS_PER_USER) {
    throw new Error('Maximum 10 API keys allowed');
  }

  const rawKey = `lum_${crypto.randomBytes(32).toString('base64url')}`;

  const permissions = Array.isArray(data.permissions)
    ? data.permissions.filter(p => VALID_PERMISSIONS.includes(p))
    : [];
  if (permissions.length === 0) {
    throw new Error('At least one permission is required');
  }

  const apiKey = await ApiKey.create({
    userId,
    name: String(data.name || '').trim().slice(0, 100) || 'Default key',
    hashedKey: hashApiKey(rawKey),
    permissions,
  });

  const { hashedKey, ...safeKey } = apiKey.toObject();
  return { apiKey: safeKey, rawKey };
}

export async function updateApiKey(userId, keyId, data) {
  const update = {};
  if (data.name !== undefined) update.name = String(data.name).trim().slice(0, 100);
  if (Array.isArray(data.permissions)) {
    const permissions = data.permissions.filter(p => VALID_PERMISSIONS.includes(p));
    if (permissions.length === 0) {
      throw new Error('At least one permission is required');
    }
    update.permissions = permissions;
  }

  if (Object.keys(update).length === 0) {
    throw new Error('Nothing to update');
  }

  const apiKey = await ApiKey.findOneAndUpdate(
    { _id: keyId, userId },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!apiKey) throw new Error('API key not found');
  const { hashedKey, ...safeKey } = apiKey.toObject();
  return safeKey;
}

export async function deleteApiKey(userId, keyId) {
  const apiKey = await ApiKey.findOneAndDelete({ _id: keyId, userId });
  if (!apiKey) throw new Error('API key not found');
  return apiKey;
}
