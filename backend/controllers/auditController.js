import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';

export async function getAuditLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const action = req.query.action || null;
    const resource = req.query.resource || null;

    const filter = { userId: req.user._id };
    if (action) filter.action = action;
    if (resource) filter.resource = resource;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    const actions = await AuditLog.distinct('action', { userId: req.user._id });

    return success(res, {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: { actions },
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}
