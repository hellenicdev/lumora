import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import config from '../config/index.js';

export function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createRefreshTokenDocument(userId, token, rememberMe = false) {
  const expiresInMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return RefreshToken.create({
    userId,
    token,
    expiresAt: new Date(Date.now() + expiresInMs),
  });
}

export async function registerUser(email, password, name) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('Email already registered');
  }

  const verificationToken = generateVerificationToken();

  const user = await User.create({
    email,
    password,
    name: name || '',
    verificationToken,
    verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return { user: user.toSafeObject(), verificationToken };
}

export async function verifyEmail(token) {
  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error('Invalid or expired verification token');
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  return user.toSafeObject();
}

export async function loginUser(email, password) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  return user;
}

export async function refreshAccessToken(refreshTokenStr) {
  const stored = await RefreshToken.findOne({
    token: refreshTokenStr,
    revoked: false,
    expiresAt: { $gt: new Date() },
  });

  if (!stored) {
    throw new Error('Invalid or expired refresh token');
  }

  const user = await User.findById(stored.userId);
  if (!user) {
    throw new Error('User not found');
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken();

  stored.revoked = true;
  await stored.save();

  await createRefreshTokenDocument(user._id, newRefreshToken);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: user.toSafeObject() };
}

export async function logoutUser(refreshTokenStr) {
  await RefreshToken.updateOne(
    { token: refreshTokenStr },
    { revoked: true },
  );
}

export async function logoutEverywhere(userId) {
  await RefreshToken.updateMany(
    { userId, revoked: false },
    { revoked: true },
  );
}

export async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) {
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  return resetToken;
}

export async function resetPassword(token, newPassword) {
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  await RefreshToken.updateMany({ userId: user._id, revoked: false }, { revoked: true });

  return user.toSafeObject();
}
