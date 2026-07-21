import * as authService from '../services/authService.js';
import { sendEmail, buildVerificationEmail, buildPasswordResetEmail } from '../services/emailService.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';
import User from '../models/User.js';
import { getUsage, PLAN_LIMITS } from '../services/usageService.js';
import { getPlan } from '../middlewares/usage.js';

export async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    const result = await authService.registerUser(email, password, name);
    const accessToken = authService.generateAccessToken(result.user);
    const refreshTokenStr = authService.generateRefreshToken();
    await authService.createRefreshTokenDocument(result.user.id, refreshTokenStr, false);

    const verificationLink = `${config.frontendUrl}/verify-email?token=${result.verificationToken}`;
    const emailData = buildVerificationEmail(verificationLink);
    await sendEmail({ to: email, ...emailData });

    logger.info('User registered', { email });

    return success(res, {
      user: result.user,
      accessToken,
      refreshToken: refreshTokenStr,
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

    logger.info('User logged in', { email });

    return success(res, {
      user: user.toSafeObject(),
      accessToken,
      refreshToken: refreshTokenStr,
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
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return error(res, 'Refresh token required', 400);
    }

    const result = await authService.refreshAccessToken(refreshToken);
    return success(res, result, 'Token refreshed');
  } catch (err) {
    return error(res, err.message, 401);
  }
}

export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logoutUser(refreshToken);
    }
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    return error(res, 'Logout failed', 500);
  }
}

export async function logoutEverywhere(req, res) {
  try {
    await authService.logoutEverywhere(req.user._id);
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
      const resetLink = `${config.frontendUrl}/reset-password?token=${resetToken}`;
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

export async function activatePro(req, res) {
  try {
    const { code } = req.body;
    if (!code || code !== 'TESTINGISFUN') {
      return error(res, 'Invalid activation code', 400);
    }

    if (req.user.role === 'pro') {
      return error(res, 'Pro is already activated on this account', 400);
    }

    req.user.role = 'pro';
    await req.user.save();

    logger.info('Pro activated', { userId: req.user._id, email: req.user.email });

    return success(res, { user: req.user.toSafeObject() }, 'Pro plan activated successfully');
  } catch (err) {
    logger.error('Pro activation failed', { error: err.message });
    return error(res, 'Activation failed', 500);
  }
}
