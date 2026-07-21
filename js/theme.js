(function () {
  const stored = localStorage.getItem('lumora-theme');
  const theme = stored || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    toggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('lumora-theme', next);
    });
  });
})();
