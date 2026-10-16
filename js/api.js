(function () {
  var API_BASE = (typeof LUMORA_CONFIG !== 'undefined') ? LUMORA_CONFIG.API_BASE : 'http://localhost:3070/api';
  window.API_BASE = API_BASE;
  // Tokens are now stored in secure HttpOnly cookies by the backend.
  // Keep thin wrappers for compatibility with older call sites.
  var accessToken = null;
  var refreshToken = null;

  window.setTokens = function (access, refresh) {
    accessToken = access || null;
    refreshToken = refresh || null;
  };

  window.clearTokens = function () {
    accessToken = null;
    refreshToken = null;
  };

  window.getAccessToken = function () {
    return accessToken;
  };

  window.apiRequest = async function (endpoint, options) {
    options = options || {};
    var method = options.method || 'GET';
    var body = options.body;
    var headers = options.headers || {};
    var auth = options.auth !== false;

    var reqHeaders = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };
    for (var key in headers) {
      if (headers.hasOwnProperty(key)) reqHeaders[key] = headers[key];
    }

    if (auth && accessToken) {
      reqHeaders['Authorization'] = 'Bearer ' + accessToken;
    }

    var config = {
      method: method,
      headers: reqHeaders,
      credentials: 'include',
      cache: 'no-store',
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      var response = await fetch(API_BASE + endpoint, config);
      var contentType = response.headers.get('content-type') || '';
      var data = contentType.includes('json') ? await response.json() : {};

      if (!response.ok) {
        if (response.status === 401) {
          var refreshed = await attemptRefresh();
          if (refreshed) {
            reqHeaders['Authorization'] = 'Bearer ' + accessToken;
            config.headers = reqHeaders;
            var retryResponse = await fetch(API_BASE + endpoint, config);
            var retryContentType = retryResponse.headers.get('content-type') || '';
            var retryData = retryContentType.includes('json') ? await retryResponse.json() : {};
            if (!retryResponse.ok) {
              throw new Error(retryData.error || 'Request failed');
            }
            return retryData;
          }
        }
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Unable to connect to server');
      }
      throw err;
    }
  };

  async function attemptRefresh() {
    try {
      var response = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        clearTokens();
        window.location.href = '/lumora/login.html';
        return false;
      }

      var data = await response.json();
      if (data && data.data && data.data.accessToken) {
        setTokens(data.data.accessToken, data.data.refreshToken);
      }
      return true;
    } catch (e) {
      clearTokens();
      window.location.href = '/lumora/login.html';
      return false;
    }
  }
})();
