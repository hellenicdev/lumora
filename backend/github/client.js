import { Octokit } from 'octokit';
import { encrypt, decrypt } from '../utils/encryption.js';
import User from '../models/User.js';

export async function getOctokitForUser(userId) {
  const user = await User.findById(userId);
  if (!user || !user.githubAccessToken) {
    throw new Error('GitHub not connected');
  }

  const token = decrypt(user.githubAccessToken);
  return new Octokit({ auth: token });
}

export async function getAccessTokenForUser(userId) {
  const user = await User.findById(userId);
  if (!user || !user.githubAccessToken) {
    throw new Error('GitHub not connected');
  }

  return decrypt(user.githubAccessToken);
}

export async function storeGitHubToken(userId, token) {
  const encrypted = encrypt(token);
  await User.findByIdAndUpdate(userId, {
    githubAccessToken: encrypted,
    githubConnected: true,
  });
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
