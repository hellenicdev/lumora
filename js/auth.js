(function () {
  var API_BASE = (typeof LUMORA_CONFIG !== 'undefined') ? LUMORA_CONFIG.API_BASE : 'http://localhost:3070/api';
  var TURNSTILE_KEY = (typeof LUMORA_CONFIG !== 'undefined') ? LUMORA_CONFIG.TURNSTILE_SITE_KEY : null;

  function initTurnstile() {
    var widget = document.getElementById('turnstileWidget');
    if (!widget || !TURNSTILE_KEY) return;
    if (window.turnstile) {
      turnstile.render(widget, { sitekey: TURNSTILE_KEY });
    } else {
      var attempts = 0;
      var maxAttempts = 10;
      var check = setInterval(function () {
        attempts++;
        if (window.turnstile) {
          turnstile.render(widget, { sitekey: TURNSTILE_KEY });
          clearInterval(check);
        } else if (attempts >= maxAttempts) {
          clearInterval(check);
          showToast('CAPTCHA verification unavailable. Please refresh the page.', 'warning');
        }
      }, 200);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTurnstile();

    var loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    var registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    var forgotForm = document.getElementById('forgotForm');
    if (forgotForm) forgotForm.addEventListener('submit', handleForgotPassword);

    var resetForm = document.getElementById('resetForm');
    if (resetForm) {
      var tokenInput = document.getElementById('token');
      var params = new URLSearchParams(window.location.search);
      var rawToken = params.get('token') || '';
      try {
        rawToken = decodeURIComponent(rawToken);
      } catch (e) {
        // ignore invalid encoding
      }
      if (tokenInput) tokenInput.value = rawToken;
      resetForm.addEventListener('submit', handleResetPassword);
    }
  });

  function showAlert(message, type) {
    var alert = document.getElementById('alert');
    if (!alert) return;
    alert.textContent = message;
    alert.className = 'alert alert-' + type;
  }

  function getTurnstileToken() {
    var tokenEl = document.querySelector('[name="cf-turnstile-response"]');
    return tokenEl ? tokenEl.value : '';
  }

  async function handleLogin(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
      var email = document.getElementById('email');
      var password = document.getElementById('password');
      var rememberMe = document.getElementById('rememberMe');
      if (!email || !password) return;

      var response = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value,
          password: password.value,
          rememberMe: rememberMe ? rememberMe.checked : false,
          turnstileToken: getTurnstileToken(),
        }),
      });

      var data = await response.json();

      if (!data.success) {
        showAlert(data.error, 'error');
        btn.disabled = false;
        btn.textContent = 'Log in';
        if (window.turnstile) turnstile.reset();
        return;
      }

      setTokens(data.data.accessToken, data.data.refreshToken);
      window.location.href = '/dashboard.html';
    } catch (err) {
      showAlert('Connection error. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    var password = document.getElementById('password');
    var confirmPassword = document.getElementById('confirmPassword');
    if (!password || !confirmPassword) return;

    if (password.value !== confirmPassword.value) {
      showAlert('Passwords do not match', 'error');
      return;
    }

    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      var name = document.getElementById('name');
      var email = document.getElementById('email');
      if (!name || !email) return;

      var response = await fetch(API_BASE + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.value,
          email: email.value,
          password: password.value,
          turnstileToken: getTurnstileToken(),
        }),
      });

      var data = await response.json();

      if (!data.success) {
        showAlert(data.error, 'error');
        btn.disabled = false;
        btn.textContent = 'Create account';
        if (window.turnstile) turnstile.reset();
        return;
      }

      setTokens(data.data.accessToken, data.data.refreshToken);
      showAlert('Account created! Check your email to verify.', 'success');
      setTimeout(function () { window.location.href = '/dashboard.html'; }, 2000);
    } catch (err) {
      showAlert('Connection error. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      var email = document.getElementById('email');
      if (!email) return;

      var response = await fetch(API_BASE + '/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value,
          turnstileToken: getTurnstileToken(),
        }),
      });

      var data = await response.json();
      showAlert(!data.success ? data.error : 'If that email exists, a reset link has been sent.', data.success ? 'success' : 'error');
      btn.disabled = false;
      btn.textContent = 'Send reset link';
    } catch (e) {
      showAlert('Connection error. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send reset link';
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    var password = document.getElementById('password');
    var confirmPassword = document.getElementById('confirmPassword');
    var token = document.getElementById('token');
    if (!password || !confirmPassword || !token) return;

    if (password.value !== confirmPassword.value) {
      showAlert('Passwords do not match', 'error');
      return;
    }

    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Resetting...';

    try {
      var response = await fetch(API_BASE + '/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.value,
          password: password.value,
        }),
      });

      var data = await response.json();

      if (!data.success) {
        showAlert(data.error, 'error');
        btn.disabled = false;
        btn.textContent = 'Reset password';
        return;
      }

      showAlert('Password reset successfully! Redirecting...', 'success');
      setTimeout(function () { window.location.href = '/login.html'; }, 2000);
    } catch (e) {
      showAlert('Connection error. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Reset password';
    }
  }
})();
