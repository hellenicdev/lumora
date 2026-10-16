import * as authService from '../services/authService.js';
import { sendEmail, buildVerificationEmail, buildPasswordResetEmail } from '../services/emailService.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Integration from '../models/Integration.js';
import WebhookConfig from '../models/WebhookConfig.js';
import ShareableReport from '../models/ShareableReport.js';
import UsageRecord from '../models/UsageRecord.js';
import AnalysisJob from '../models/AnalysisJob.js';
import RefreshToken from '../models/RefreshToken.js';
import ChatSession from '../models/ChatSession.js';
import Settings from '../models/Settings.js';
import ApiKey from '../models/ApiKey.js';
import Notification from '../models/Notification.js';
import Organization from '../models/Organization.js';
import Repository from '../models/Repository.js';
import SecurityIncident from '../models/SecurityIncident.js';
import { getUsage, PLAN_LIMITS } from '../services/usageService.js';
import { getPlan } from '../middlewares/usage.js';

export async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    const result = await authService.registerUser(email, password, name);
    const accessToken = authService.generateAccessToken(result.user);
    const refreshTokenStr = authService.generateRefreshToken();
    await authService.createRefreshTokenDocument(result.user.id, refreshTokenStr, false);

    const verificationLink = `${config.frontendUrl}/verify-email.html?token=${result.verificationToken}`;
    const emailData = buildVerificationEmail(verificationLink);
    await sendEmail({ to: email, ...emailData });

    logger.info('User registered', { email });

    const isProd = config.nodeEnv === 'production';
    const cookieBase = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };
    res.cookie('lumora_access_token', accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    res.cookie('lumora_refresh_token', refreshTokenStr, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return success(res, {
      user: result.user,
    }, 'Registration successful. Please verify your email.', 201);
  } catch (err) {
    if (err.message === 'Email already registered') {
      return error(res, err.message, 409);
    }
    logger.error('Registration failed', { error: err.message });
    return error(res, 'Registration failed', 500);
  }
}

export async function login(req, res) {
  try {
    const { email, password, rememberMe } = req.body;

    const user = await authService.loginUser(email, password);
    const accessToken = authService.generateAccessToken(user);
    const refreshTokenStr = authService.generateRefreshToken();
    await authService.createRefreshTokenDocument(user._id, refreshTokenStr, rememberMe);

    const isProd = config.nodeEnv === 'production';
    const cookieBase = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };
    const refreshMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    res.cookie('lumora_access_token', accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    res.cookie('lumora_refresh_token', refreshTokenStr, { ...cookieBase, maxAge: refreshMaxAge });

    logger.info('User logged in', { email });

    return success(res, {
      user: user.toSafeObject(),
    }, 'Login successful');
  } catch (err) {
    if (err.message === 'Invalid email or password') {
      return error(res, err.message, 401);
    }
    logger.error('Login failed', { error: err.message });
    return error(res, 'Login failed', 500);
  }
}

export async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.lumora_refresh_token || req.body?.refreshToken;
    if (!refreshToken) {
      return error(res, 'Refresh token required', 400);
    }

    const result = await authService.refreshAccessToken(refreshToken);

    const isProd = config.nodeEnv === 'production';
    const cookieBase = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };
    const refreshMaxAge = result.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    res.cookie('lumora_access_token', result.accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    res.cookie('lumora_refresh_token', result.refreshToken, { ...cookieBase, maxAge: refreshMaxAge });
    return success(res, { user: result.user }, 'Token refreshed');
  } catch (err) {
    return error(res, err.message, 401);
  }
}

export async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.lumora_refresh_token || req.body?.refreshToken;
    if (refreshToken) {
      await authService.logoutUser(refreshToken);
    }
    const isProd = config.nodeEnv === 'production';
    const cookieBase = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };
    res.clearCookie('lumora_access_token', cookieBase);
    res.clearCookie('lumora_refresh_token', cookieBase);
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    return error(res, 'Logout failed', 500);
  }
}

export async function logoutEverywhere(req, res) {
  try {
    await authService.logoutEverywhere(req.user._id);
    const isProd = config.nodeEnv === 'production';
    const cookieBase = { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' };
    res.clearCookie('lumora_access_token', cookieBase);
    res.clearCookie('lumora_refresh_token', cookieBase);
    return success(res, null, 'Logged out everywhere');
  } catch (err) {
    return error(res, 'Logout failed', 500);
  }
}

export async function verifyEmail(req, res) {
  try {
    const { token } = req.params;
    const user = await authService.verifyEmail(token);
    return success(res, { user }, 'Email verified successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const resetToken = await authService.forgotPassword(email);

    if (resetToken) {
      const resetLink = `${config.frontendUrl}/reset-password.html?token=${resetToken}`;
      const emailData = buildPasswordResetEmail(resetLink);
      await sendEmail({ to: email, ...emailData });
    }

    return success(res, null, 'If that email exists, a reset link has been sent');
  } catch (err) {
    return error(res, 'Failed to send reset email', 500);
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    const user = await authService.resetPassword(token, password);
    return success(res, { user }, 'Password reset successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
}

export async function getMe(req, res) {
  return success(res, { user: req.user.toSafeObject() });
}

export async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (name !== undefined) req.user.name = name;
    await req.user.save();
    return success(res, { user: req.user.toSafeObject() }, 'Profile updated');
  } catch (err) {
    return error(res, 'Failed to update profile', 500);
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
      return error(res, 'Current password is incorrect', 400);
    }
    req.user.password = newPassword;
    await req.user.save();
    await authService.logoutEverywhere(req.user._id);
    const isProd = config.nodeEnv === 'production';
    const cookieBase = { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' };
    res.clearCookie('lumora_access_token', cookieBase);
    res.clearCookie('lumora_refresh_token', cookieBase);
    return success(res, null, 'Password changed. Please login again.');
  } catch (err) {
    return error(res, 'Failed to change password', 500);
  }
}

export async function getMyUsage(req, res) {
  try {
    const plan = getPlan(req.user);
    const usage = await getUsage(req.user._id);
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    return success(res, { plan, usage, limits });
  } catch (err) {
    logger.error('Failed to get usage', { error: err.message });
    return error(res, 'Failed to get usage', 500);
  }
}

export async function getDashboardStats(req, res) {
  try {
    const Repository = (await import('../models/Repository.js')).default;
    const DocumentationVersion = (await import('../models/DocumentationVersion.js')).default;

    const repos = await Repository.find({ userId: req.user._id }).lean();
    const repoCount = repos.length;
    const analysisCount = repos.filter(r => r.analysisStatus === 'completed').length;

    const repoIds = repos.map(r => r._id);
    const docCount = repoIds.length > 0
      ? await DocumentationVersion.countDocuments({ repositoryId: { $in: repoIds } })
      : 0;

    const completedRepos = repos.filter(r => r.analysisStatus === 'completed');
    const healthScore = completedRepos.length > 0
      ? Math.round(completedRepos.reduce((sum, r) => sum + (r.healthScore || 0), 0) / completedRepos.length)
      : null;

    return success(res, {
      repositories: repoCount,
      analyses: analysisCount,
      documents: docCount,
      healthScore,
    });
  } catch (err) {
    logger.error('Failed to get dashboard stats', { error: err.message });
    return error(res, 'Failed to get dashboard stats', 500);
  }
}

export async function activatePlan(req, res) {
  try {
    const { code } = req.body;
    if (!code) return error(res, 'Activation code required', 400);

    const codes = {
      'TESTINGISFUN': 'pro',
      'TEAMWORKISFUN': 'team_admin',
    };

    const targetRole = codes[code];
    if (!targetRole) {
      return error(res, 'Invalid activation code', 400);
    }

    if (req.user.role === targetRole) {
      return error(res, `${code === 'TESTINGISFUN' ? 'Pro' : 'Team'} is already activated on this account`, 400);
    }

    req.user.role = targetRole;
    await req.user.save();

    logger.info('Plan activated', { userId: req.user._id, email: req.user.email, role: targetRole });

    return success(res, { user: req.user.toSafeObject() }, `${code === 'TESTINGISFUN' ? 'Pro' : 'Team'} plan activated successfully`);
  } catch (err) {
    logger.error('Plan activation failed', { error: err.message });
    return error(res, 'Activation failed', 500);
  }
}

export async function exportData(req, res) {
  try {
    const userId = req.user._id;
    const user = req.user;

    const [
      repositories,
      integrations,
      auditLogs,
      webhooks,
      reports,
      usageRecords,
      analysisJobs,
      refreshTokens,
      chatSessions,
      settings,
      apiKeys,
      notifications,
      securityIncidents,
      organizationsOwned,
      organizationsMember,
    ] = await Promise.all([
      Repository.find({ userId }).lean(),
      Integration.find({ userId }).lean(),
      AuditLog.find({ userId }).lean(),
      WebhookConfig.find({ userId }).lean(),
      ShareableReport.find({ userId }).lean(),
      UsageRecord.find({ userId }).lean(),
      AnalysisJob.find({ userId }).lean(),
      RefreshToken.find({ userId }).lean(),
      Settings.findOne({ userId }).lean(),
      ApiKey.find({ userId }).lean(),
      Notification.find({ userId }).lean(),
      SecurityIncident.find({ resolvedBy: userId }).lean(),
      Organization.find({ ownerId: userId }).lean(),
      Organization.find({ 'members.userId': userId }).lean(),
    ]);

    const data = {
      account: user.toSafeObject(),
      repositories,
      integrations,
      auditLogs,
      webhooks,
      shareableReports: reports,
      usageRecords,
      analysisJobs,
      refreshTokens,
      chatSessions,
      settings,
      apiKeys,
      notifications,
      securityIncidents,
      organizations: {
        owned: organizationsOwned,
        memberOf: organizationsMember,
      },
      exportedAt: new Date().toISOString(),
    };

    logger.info('Data exported', { userId });
    return success(res, data, 'Data exported successfully');
  } catch (err) {
    logger.error('Data export failed', { error: err.message });
    return error(res, 'Failed to export data', 500);
  }
}

export async function deleteAccount(req, res) {
  try {
    const userId = req.user._id;

    const userObjectId = userId;

    const repoIds = await Repository.find({ userId: userObjectId }).distinct('_id');

    await Promise.all([
      Repository.deleteMany({ userId: userObjectId }),
      Integration.deleteMany({ userId: userObjectId }),
      AuditLog.deleteMany({ userId: userObjectId }),
      WebhookConfig.deleteMany({ userId: userObjectId }),
      ShareableReport.deleteMany({ userId: userObjectId }),
      UsageRecord.deleteMany({ userId: userObjectId }),
      AnalysisJob.deleteMany({ userId: userObjectId }),
      RefreshToken.deleteMany({ userId: userObjectId }),
      ChatSession.deleteMany({ userId: userObjectId }),
      Settings.deleteMany({ userId: userObjectId }),
      ApiKey.deleteMany({ userId: userObjectId }),
      Notification.deleteMany({ userId: userObjectId }),
      SecurityIncident.updateMany({ resolvedBy: userObjectId }, { $set: { resolvedBy: null } }),
      Organization.updateMany({ ownerId: userObjectId }, { $set: { ownerId: null } }),
      Organization.updateMany(
        { 'members.userId': userObjectId },
        { $pull: { members: { userId: userObjectId } } },
      ),
      Organization.updateMany(
        { 'pendingInvitations.invitedBy': userObjectId },
        { $pull: { pendingInvitations: { invitedBy: userObjectId } } },
      ),
      User.deleteOne({ _id: userObjectId }),
    ]);

    if (repoIds.length > 0) {
      try {
        const { deleteRepoData } = await import('../services/repositoryService.js');
        await Promise.all(repoIds.map(id => deleteRepoData(id).catch(() => {})));
      } catch {}
    }

    logger.info('Account deleted', { userId });
    return success(res, null, 'Account and all associated data deleted permanently');
  } catch (err) {
    logger.error('Account deletion failed', { error: err.message });
    return error(res, 'Failed to delete account', 500);
  }
}
