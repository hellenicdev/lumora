(function () {
  var API_BASE = (typeof LUMORA_CONFIG !== 'undefined') ? LUMORA_CONFIG.API_BASE : 'http://localhost:3070/api';
  var accessToken = localStorage.getItem('lumora-access-token');
  var refreshToken = localStorage.getItem('lumora-refresh-token');

  window.setTokens = function (access, refresh) {
    accessToken = access;
    refreshToken = refresh;
    if (access) {
      localStorage.setItem('lumora-access-token', access);
    } else {
      localStorage.removeItem('lumora-access-token');
    }
    if (refresh) {
      localStorage.setItem('lumora-refresh-token', refresh);
    } else {
      localStorage.removeItem('lumora-refresh-token');
    }
  };

  window.clearTokens = function () {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem('lumora-access-token');
    localStorage.removeItem('lumora-refresh-token');
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
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      var response = await fetch(API_BASE + endpoint, config);
      var contentType = response.headers.get('content-type') || '';
      var data = contentType.includes('json') ? await response.json() : {};

      if (!response.ok) {
        if (response.status === 401 && refreshToken) {
          var refreshed = await attemptRefresh();
          if (refreshed) {
            reqHeaders['Authorization'] = 'Bearer ' + accessToken;
            config.headers = reqHeaders;
            var retryResponse = await fetch(API_BASE + endpoint, config);
            var retryContentType = retryResponse.headers.get('content-type') || '';
            return retryContentType.includes('json') ? retryResponse.json() : {};
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
        body: JSON.stringify({ refreshToken: refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        window.location.href = '/lumora/login.html';
        return false;
      }

      var data = await response.json();
      setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    } catch (e) {
      clearTokens();
      window.location.href = '/lumora/login.html';
      return false;
    }
  }
})();
