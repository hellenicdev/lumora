(function () {
  var container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:400px';
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function (message, type) {
    type = type || 'info';
    var el = document.createElement('div');
    var bg = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6366f1';
    el.style.cssText = 'padding:12px 20px;border-radius:8px;background:' + bg + ';color:#fff;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:slideIn 0.3s ease;cursor:pointer;display:flex;align-items:center;gap:10px;line-height:1.4';
    el.innerHTML = '<span style="flex:1">' + message + '</span><span style="opacity:0.7;font-size:16px">&times;</span>';
    el.addEventListener('click', function () {
      el.style.animation = 'slideOut 0.3s ease';
      setTimeout(function () { el.remove(); }, 300);
    });
    getContainer().appendChild(el);
    setTimeout(function () {
      if (el.parentNode) {
        el.style.animation = 'slideOut 0.3s ease';
        setTimeout(function () { if (el.parentNode) el.remove(); }, 300);
      }
    }, 5000);
  };

  var style = document.createElement('style');
  style.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}';
  document.head.appendChild(style);
})();
