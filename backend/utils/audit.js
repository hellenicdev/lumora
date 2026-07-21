import AuditLog from '../models/AuditLog.js';

export async function logAuditEvent({ userId, action, resource, resourceId, details, req }) {
  try {
    await AuditLog.create({
      userId,
      action,
      resource,
      resourceId,
      details,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
