import UsageRecord from '../models/UsageRecord.js';

const PLAN_LIMITS = {
  free: {
    repositories: 1,
    aiQuestions: 15,
    docGenerations: 5,
    securityScans: 4,
    teamMembers: 0,
  },
  pro: {
    repositories: Infinity,
    aiQuestions: 10000,
    docGenerations: 100,
    securityScans: 30,
    teamMembers: 0,
  },
  team: {
    repositories: Infinity,
    aiQuestions: Infinity,
    docGenerations: Infinity,
    securityScans: Infinity,
    teamMembers: 10,
  },
  enterprise: {
    repositories: Infinity,
    aiQuestions: Infinity,
    docGenerations: Infinity,
    securityScans: Infinity,
    teamMembers: Infinity,
  },
};

export async function trackUsage(userId, type) {
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);

  await UsageRecord.findOneAndUpdate(
    { userId, type, month },
    { $inc: { count: 1 } },
    { upsert: true },
  );
}

export async function getUsage(userId) {
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);

  const records = await UsageRecord.find({ userId, month }).lean();

  const usage = {
    repositories: 0,
    aiQuestions: 0,
    docGenerations: 0,
    securityScans: 0,
  };

  for (const r of records) {
    if (usage[r.type] !== undefined) {
      usage[r.type] = r.count;
    }
  }

  return usage;
}

export async function checkLimit(userId, plan, type) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const limit = limits[type];
  if (limit === Infinity) return { allowed: true };

  const usage = await getUsage(userId);
  const current = usage[type] || 0;

  return {
    allowed: current < limit,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  };
}

export { PLAN_LIMITS };
