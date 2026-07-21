(function () {
  var host = window.location.hostname;
  var protocol = window.location.protocol;

  var isProduction = host !== 'localhost' && host !== '127.0.0.1' && !/^10\.\d+\.\d+\.\d+$/.test(host) && !/^192\.168\.\d+\.\d+$/.test(host);

  var apiBase, wsUrl, turnstileKey;

  if (isProduction) {
    apiBase = 'https://lumora-api.onrender.com/api';
    wsUrl = 'wss://lumora-api.onrender.com';
    turnstileKey = '0x4AAAAAADx1vc3kAwIOgXhw';
  } else {
    apiBase = protocol + '//' + host + ':3070/api';
    wsUrl = (protocol === 'https:' ? 'wss:' : 'ws:') + '//' + host + ':3070';
    turnstileKey = null;
  }

  window.LUMORA_CONFIG = {
    API_BASE: apiBase,
    WS_URL: wsUrl,
    isProduction: isProduction,
    TURNSTILE_SITE_KEY: turnstileKey,
  };
})();
