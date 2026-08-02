import Repository from '../models/Repository.js';
import { generateOnboardingReport } from '../services/onboardingService.js';
import { calculateHealthScore } from '../services/healthService.js';
import { getSecurityReport } from '../services/securityService.js';
import { generateArchitectureDiagram } from '../services/architectureService.js';
import { success, error } from '../utils/response.js';
import { getPlan, recordUsage } from '../middlewares/usage.js';

function hasPermission(req, permission) {
  const permissions = req.apiKey?.permissions || [];
  return permissions.includes(permission);
}

export async function me(req, res) {
  return success(res, {
    user: req.user.toSafeObject(),
    plan: getPlan(req.user),
  });
}

export async function repositories(req, res) {
  if (!hasPermission(req, 'repositories:read')) {
    return error(res, 'This API key does not have the repositories:read permission', 403);
  }

  try {
    const repos = await Repository.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    return success(res, { repositories: repos });
  } catch (err) {
    return error(res, 'Failed to list repositories', 500);
  }
}

export async function report(req, res) {
  if (!hasPermission(req, 'reports:read')) {
    return error(res, 'This API key does not have the reports:read permission', 403);
  }

  try {
    const { type = 'onboarding' } = req.query;

    const repo = await Repository.findOne({
      _id: req.params.repositoryId,
      userId: req.user._id,
    }).lean();

    if (!repo) {
      return error(res, 'Repository not found', 404);
    }

    let reportData;
    switch (type) {
      case 'onboarding':
        reportData = await generateOnboardingReport(req.params.repositoryId);
        break;
      case 'health':
        reportData = { health: await calculateHealthScore(req.params.repositoryId) };
        break;
      case 'security':
        reportData = await getSecurityReport(req.params.repositoryId);
        break;
      case 'architecture':
        reportData = await generateArchitectureDiagram(req.params.repositoryId);
        break;
      default:
        return error(res, 'Invalid report type. Use onboarding, health, security or architecture.', 400);
    }

    await recordUsage(req, 'docGenerations');

    return success(res, {
      repositoryId: repo._id,
      fullName: repo.fullName || repo.name,
      type,
      report: reportData,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}
