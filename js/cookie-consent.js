(function () {
  var KEY = 'lumora-cookie-consent';

  if (localStorage.getItem(KEY) === 'accepted') return;

  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('cookieConsent');
    if (!banner) return;

    var acceptBtn = document.getElementById('cookieAccept');
    var declineBtn = document.getElementById('cookieDecline');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        localStorage.setItem(KEY, 'accepted');
        banner.classList.remove('visible');
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', function () {
        localStorage.setItem(KEY, 'declined');
        banner.classList.remove('visible');
        gaOptout();
      });
    }

    banner.classList.add('visible');
  });

  function gaOptout() {
    window['ga-disable-G-9FWQFZME3Z'] = true;
  }
})();
