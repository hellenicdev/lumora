import { generateOnboardingReport } from '../services/onboardingService.js';
import { calculateHealthScore } from '../services/healthService.js';
import { getSecurityReport } from '../services/securityService.js';
import { generateArchitectureDiagram } from '../services/architectureService.js';
import ShareableReport from '../models/ShareableReport.js';
import Repository from '../models/Repository.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { recordUsage } from '../middlewares/usage.js';
import crypto from 'crypto';

export async function getOnboardingReport(req, res) {
  try {
    const report = await generateOnboardingReport(req.params.id);
    await recordUsage(req, 'docGenerations');
    return success(res, { report }, 'Onboarding report generated');
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function shareReport(req, res) {
  try {
    const { type = 'onboarding', expiresInDays = null } = req.body;

    const repo = await Repository.findById(req.params.id);
    if (!repo) return error(res, 'Repository not found', 404);

    let reportData;
    switch (type) {
      case 'onboarding':
        reportData = await generateOnboardingReport(req.params.id);
        break;
      case 'health':
        reportData = { health: await calculateHealthScore(req.params.id) };
        break;
      case 'security':
        reportData = await getSecurityReport(req.params.id);
        break;
      case 'architecture':
        reportData = await generateArchitectureDiagram(req.params.id);
        break;
      default:
        return error(res, 'Invalid report type', 400);
    }

    const slug = crypto.randomBytes(8).toString('hex');
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

    const report = await ShareableReport.create({
      repositoryId: req.params.id,
      userId: req.user._id,
      slug,
      reportType: type,
      title: `${repo.fullName || repo.name} - ${type} report`,
      data: reportData,
      expiresAt,
    });

    return success(res, { report, shareUrl: `${slug}` }, 'Report created');
  } catch (err) {
    logger.error('Share report failed', { error: err.message });
    return error(res, err.message, 500);
  }
}

export async function getSharedReport(req, res) {
  try {
    const report = await ShareableReport.findOne({ slug: req.params.slug }).populate('repositoryId', 'name fullName');
    if (!report) return error(res, 'Report not found', 404);

    if (report.expiresAt && report.expiresAt < new Date()) {
      return error(res, 'Report has expired', 410);
    }

    report.views = (report.views || 0) + 1;
    await report.save();

    return success(res, { report });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function listSharedReports(req, res) {
  try {
    const reports = await ShareableReport.find({ userId: req.user._id })
      .populate('repositoryId', 'name fullName')
      .sort({ createdAt: -1 })
      .lean();

    return success(res, { reports });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function deleteSharedReport(req, res) {
  try {
    const report = await ShareableReport.findOneAndDelete({
      _id: req.params.reportId,
      userId: req.user._id,
    });
    if (!report) return error(res, 'Report not found', 404);
    return success(res, null, 'Report deleted');
  } catch (err) {
    return error(res, err.message, 500);
  }
}
