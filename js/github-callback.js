(function () {
  var hash = window.location.hash.substring(1);
  var params = new URLSearchParams(hash);
  var accessToken = params.get('access_token');
  var refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken && typeof setTokens === 'function') {
    setTokens(accessToken, refreshToken);
    window.location.replace('./dashboard.html');
  } else {
    window.location.replace('./login.html?github=error');
  }
})();
