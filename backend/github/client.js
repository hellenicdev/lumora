import { Octokit } from 'octokit';
import { encrypt, decrypt, isEncryptionAvailable } from '../utils/encryption.js';
import User from '../models/User.js';

function getToken(user) {
  try {
    if (user.githubAccessToken) return decrypt(user.githubAccessToken);
    if (user.githubPat) return decrypt(user.githubPat);
  } catch {
    return null;
  }
  return null;
}

export async function getOctokitForUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('GitHub not connected');

  const token = getToken(user);
  if (!token) throw new Error('GitHub not connected');

  return new Octokit({ auth: token });
}

export async function getAccessTokenForUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('GitHub not connected');

  const token = getToken(user);
  if (!token) throw new Error('GitHub not connected');

  return token;
}

export async function storeGitHubToken(userId, token) {
  const stored = isEncryptionAvailable() ? encrypt(token) : token;
  await User.findByIdAndUpdate(userId, {
    githubAccessToken: stored,
    githubPat: null,
    githubConnected: true,
  });
}

export async function storeGitHubPat(userId, token) {
  const stored = isEncryptionAvailable() ? encrypt(token) : token;
  await User.findByIdAndUpdate(userId, {
    githubPat: stored,
    githubConnected: true,
  });
}

export async function removeGitHubConnection(userId) {
  await User.findByIdAndUpdate(userId, {
    githubAccessToken: null,
    githubPat: null,
    githubConnected: false,
    githubId: null,
    githubUsername: null,
  });
}

export async function validatePat(token) {
  const octokit = new Octokit({ auth: token });
  const { data: user } = await octokit.rest.users.getAuthenticated();
  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: 'updated',
    direction: 'desc',
  });
  return {
    user: { id: user.id, login: user.login, avatar: user.avatar_url, name: user.name },
    repositories: repos.map(function (r) {
      return {
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
      };
    }),
  };
}

export async function fetchRepoContents(userId, owner, repo, path = '') {
  const octokit = await getOctokitForUser(userId);
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });
  return response.data;
}

export async function fetchRepoTree(userId, owner, repo, branch = 'main') {
  const octokit = await getOctokitForUser(userId);
  const response = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: '1',
  });
  return response.data;
}

export async function fetchFileContent(userId, owner, repo, path, ref) {
  const octokit = await getOctokitForUser(userId);
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  if (response.data.type === 'file' && response.data.content) {
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  }

  return null;
}
