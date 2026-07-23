import config from '../config/index.js';

export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'repo,user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export function getLoginAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'repo,user:email',
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function fetchGitHubEmail(accessToken) {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) return null;

  const emails = await response.json();
  const primary = emails.find(function (e) { return e.primary && e.verified; });
  return primary ? primary.email : (emails[0] ? emails[0].email : null);
}

export async function exchangeCodeForToken(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
      redirect_uri: config.github.callbackUrl,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || 'GitHub OAuth failed');
  }

  return data.access_token;
}

export async function fetchGitHubUser(accessToken) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user');
  }

  return response.json();
}

export async function fetchUserRepositories(accessToken) {
  const repos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    const data = await response.json();
    repos.push(...data);
    hasMore = data.length === 100;
    page++;
  }

  return repos;
}
