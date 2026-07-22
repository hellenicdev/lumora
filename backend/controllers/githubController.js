import crypto from 'crypto';
import config from '../config/index.js';
import User from '../models/User.js';
import * as githubOAuth from '../github/oauth.js';
import * as authService from '../services/authService.js';
import { storeGitHubToken } from '../github/client.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const pendingStates = new Map();

export function login(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { type: 'login' });
  setTimeout(function () { pendingStates.delete(state); }, 600000);
  const url = githubOAuth.getAuthorizationUrl(state);
  return res.redirect(url);
}

export function connect(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { type: 'connect', userId: req.user._id.toString() });
  setTimeout(function () { pendingStates.delete(state); }, 600000);
  const url = githubOAuth.getAuthorizationUrl(state);
  return success(res, { url, state });
}

export async function callback(req, res) {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${config.frontendUrl}/login.html?github=error&msg=no_code`);
    }

    const stateData = pendingStates.get(state);
    if (!stateData) {
      return res.redirect(`${config.frontendUrl}/login.html?github=error&msg=expired`);
    }

    pendingStates.delete(state);

    const accessToken = await githubOAuth.exchangeCodeForToken(code);
    const githubUser = await githubOAuth.fetchGitHubUser(accessToken);

    if (stateData.type === 'login') {
      let user = await User.findOne({ githubId: String(githubUser.id) });

      if (!user) {
        const email = githubUser.email || `${githubUser.login}@github.local`;
        user = await User.create({
          email,
          name: githubUser.name || githubUser.login,
          password: crypto.randomBytes(32).toString('hex'),
          githubId: String(githubUser.id),
          githubUsername: githubUser.login,
          githubConnected: true,
          avatar: githubUser.avatar_url,
          isVerified: true,
        });
        logger.info('User registered via GitHub', { githubId: githubUser.id, username: githubUser.login });
      }

      await storeGitHubToken(user._id, accessToken);
      user.githubConnected = true;
      user.githubUsername = githubUser.login;
      user.avatar = githubUser.avatar_url || user.avatar;
      await user.save();

      const jwtToken = authService.generateAccessToken(user);
      const refreshTokenStr = authService.generateRefreshToken();
      await authService.createRefreshTokenDocument(user._id, refreshTokenStr, true);

      return res.redirect(
        `${config.frontendUrl}/github-callback.html#access_token=${jwtToken}&refresh_token=${refreshTokenStr}`
      );
    }

    const userId = stateData.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect(`${config.frontendUrl}/dashboard.html?github=error&msg=user_not_found`);
    }

    user.githubId = String(githubUser.id);
    user.githubUsername = githubUser.login;
    user.avatar = githubUser.avatar_url || user.avatar;
    await storeGitHubToken(user._id, accessToken);
    await user.save();

    logger.info('GitHub connected', { userId: user._id, username: githubUser.login });

    return res.redirect(`${config.frontendUrl}/dashboard.html?github=connected`);
  } catch (err) {
    logger.error('GitHub callback failed', { error: err.message });
    return res.redirect(`${config.frontendUrl}/login.html?github=error`);
  }
}

export async function getRepositories(req, res) {
  try {
    const repos = await githubOAuth.fetchUserRepositories(
      await (await import('../github/client.js')).getAccessTokenForUser(req.user._id),
    );

    const mapped = repos.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      language: r.language,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
    }));

    return success(res, { repositories: mapped });
  } catch (err) {
    return error(res, 'Failed to fetch repositories: ' + err.message, 500);
  }
}

export async function disconnect(req, res) {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      githubAccessToken: undefined,
      githubConnected: false,
      githubId: undefined,
      githubUsername: undefined,
    });
    return success(res, null, 'GitHub disconnected');
  } catch (err) {
    return error(res, 'Failed to disconnect GitHub', 500);
  }
}

export async function status(req, res) {
  try {
    const user = await User.findById(req.user._id);
    return success(res, {
      connected: user.githubConnected || false,
      username: user.githubUsername || null,
      avatar: user.avatar || null,
    });
  } catch (err) {
    return error(res, 'Failed to get status', 500);
  }
}
