(function () {
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');
  var apiBase = (typeof LUMORA_CONFIG !== 'undefined') ? LUMORA_CONFIG.API_BASE : 'http://localhost:3070/api';
  var statusEl = document.getElementById('verifyStatus');
  var footerEl = document.getElementById('verifyFooter');

  if (!token) {
    if (statusEl) statusEl.innerHTML = '<p style="color:var(--error)">Invalid verification link.</p>';
    if (footerEl) footerEl.style.display = 'block';
    return;
  }

  fetch(apiBase + '/auth/verify-email/' + encodeURIComponent(token))
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!statusEl) return;
      if (data.success) {
        statusEl.innerHTML = '<p style="color:var(--success);font-size:18px;font-weight:600">Email verified!</p><p style="color:var(--text-secondary);margin-top:8px">You can now log in to your account.</p>';
      } else {
        statusEl.innerHTML = '<p style="color:var(--error)">' + escHtml(data.error || 'Verification failed') + '</p>';
      }
      if (footerEl) footerEl.style.display = 'block';
    })
    .catch(function () {
      if (statusEl) statusEl.innerHTML = '<p style="color:var(--error)">Connection error. Please try again.</p>';
      if (footerEl) footerEl.style.display = 'block';
    });
})();
