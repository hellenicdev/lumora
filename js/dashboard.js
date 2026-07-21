(function () {
  var currentUser = null;

  document.addEventListener('DOMContentLoaded', function () {
    initSidebar();
    initNotifications();
    initUserMenu();
    initNav();
    initLogoutBtn();
    loadUser();
    connectSocket();
  });

  function initSidebar() {
    var toggle = document.getElementById('sidebarToggle');
    var close = document.getElementById('sidebarClose');
    var sidebar = document.getElementById('sidebar');

    if (toggle) {
      toggle.addEventListener('click', function () {
        sidebar.classList.toggle('open');
      });
    }
    if (close) {
      close.addEventListener('click', function () {
        sidebar.classList.remove('open');
      });
    }
  }

  function initNotifications() {
    var trigger = document.getElementById('notifTrigger');
    var dropdown = document.getElementById('notifDropdown');

    if (trigger && dropdown) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', function () {
        dropdown.classList.remove('open');
      });
      dropdown.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }
  }

  function initUserMenu() {
    var trigger = document.getElementById('userMenuTrigger');
    var dropdown = document.getElementById('userMenuDropdown');

    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
    });
    dropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('[data-action]');
      if (!item) return;

      var action = item.dataset.action;
      if (action === 'logout') {
        handleLogout();
      } else if (action === 'settings') {
        showPage('settings');
      }
    });
  }

  function initNav() {
    var nav = document.querySelector('.sidebar-nav');
    if (nav && !document.querySelector('.nav-item[href="/upgrade.html"]')) {
      var plansLink = document.createElement('a');
      plansLink.href = '/upgrade.html';
      plansLink.className = 'nav-item';
      plansLink.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v3m0 16v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M1 12h3m16 0h3M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12"/></svg>Plans';
      nav.appendChild(plansLink);
    }

    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (item.getAttribute('href') && item.getAttribute('href') !== '#') return;
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(function (n) {
          n.classList.remove('active');
        });
        item.classList.add('active');
      });
    });
  }

  function showPage(page) {
    var content = document.getElementById('pageContent');
    if (!content) return;

    if (page === 'settings') {
      renderSettings(content);
    } else {
      var titles = {
        repositories: 'Repositories',
        docs: 'Documentation',
        chat: 'AI Chat',
        team: 'Team',
        settings: 'Settings',
      };
      var title = titles[page] || 'Dashboard';
      content.innerHTML = [
        '<div class="page-header">',
        '  <h1>' + title + '</h1>',
        '  <p>This feature is coming soon.</p>',
        '</div>',
        '<div class="card" style="padding:60px;text-align:center;">',
        '  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted);margin-bottom:16px">',
        '    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
        '  </svg>',
        '  <h3 style="margin-bottom:8px">' + title + ' will be available in an upcoming update</h3>',
        '  <p style="color:var(--text-secondary)">We\'re working hard to bring you this feature.</p>',
        '</div>',
      ].join('\n');
    }
  }

  function renderSettings(content) {
    var planLabel = currentUser ? capitalize(currentUser.role) : 'Free';
    var planBadgeClass = currentUser && currentUser.role === 'pro' ? 'badge-primary' : 'badge-warning';

    content.innerHTML = [
      '<div class="page-header">',
      '  <h1>Settings</h1>',
      '  <p>Manage your account, plan, and preferences.</p>',
      '</div>',
      '<div class="content-grid" style="grid-template-columns:1fr 1fr">',

      '  <div class="card">',
      '    <h3 style="margin-bottom:16px">Profile</h3>',
      '    <div style="display:flex;flex-direction:column;gap:12px">',
      '      <div><label style="font-size:13px;color:var(--text-muted)">Name</label><div style="font-size:15px;font-weight:500" id="settingsName"></div></div>',
      '      <div><label style="font-size:13px;color:var(--text-muted)">Email</label><div style="font-size:15px;font-weight:500" id="settingsEmail"></div></div>',
      '      <div><label style="font-size:13px;color:var(--text-muted)">Plan</label><div><span class="badge ' + planBadgeClass + '" id="settingsPlan">' + planLabel + '</span></div></div>',
      '    </div>',
      '  </div>',

      '  <div class="card">',
      '    <h3 style="margin-bottom:16px">Usage this month</h3>',
      '    <div id="usageContainer" style="display:flex;flex-direction:column;gap:12px">',
      '      <div class="skeleton" style="height:20px;width:100%"></div>',
      '      <div class="skeleton" style="height:20px;width:80%"></div>',
      '      <div class="skeleton" style="height:20px;width:60%"></div>',
      '    </div>',
      '  </div>',

      '  <div class="card">',
      '    <h3 style="margin-bottom:16px">Plan & Billing</h3>',
      '    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">You\'re currently on the <strong>' + planLabel + '</strong> plan.</p>',
      '    <a href="/upgrade.html" class="btn btn-primary" style="text-decoration:none;display:inline-flex">' + (currentUser && (currentUser.role === 'pro' || currentUser.role === 'team_admin' || currentUser.role === 'system_admin') ? 'Manage Plan' : 'Upgrade Plan') + '</a>',
      '  </div>',

      '  <div class="card" id="activationCard" style="' + (currentUser && (currentUser.role === 'pro' || currentUser.role === 'team_admin') ? 'display:none' : '') + '">',
      '    <h3 style="margin-bottom:16px">Activation Code</h3>',
      '    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">Have an activation code? Enter it here to unlock Pro.</p>',
      '    <div style="display:flex;gap:12px">',
      '      <input type="text" class="input" id="activationCode" placeholder="Enter code" style="flex:1">',
      '      <button class="btn btn-primary" id="activateBtn">Activate</button>',
      '    </div>',
      '    <div id="activationMsg" style="margin-top:12px;font-size:14px"></div>',
      '  </div>',

      '  <div class="card">',
      '    <h3 style="margin-bottom:16px">Change Password</h3>',
      '    <form id="passwordForm" style="display:flex;flex-direction:column;gap:12px">',
      '      <input type="password" class="input" id="currentPassword" placeholder="Current password" required>',
      '      <input type="password" class="input" id="newPassword" placeholder="New password" required minlength="8">',
      '      <button type="submit" class="btn btn-primary">Change Password</button>',
      '      <div id="passwordMsg" style="font-size:14px"></div>',
      '    </form>',
      '  </div>',

      '</div>',
    ].join('\n');

    document.getElementById('settingsName').textContent = currentUser ? currentUser.name || currentUser.email : '';
    document.getElementById('settingsEmail').textContent = currentUser ? currentUser.email : '';

    loadUsage();
    initActivation();
    initPasswordForm();
  }

  async function loadUsage() {
    try {
      var data = await apiRequest('/auth/usage');
      var usage = data.data;
      var container = document.getElementById('usageContainer');
      if (!container) return;

      var plan = usage.plan || 'free';
      var limits = usage.limits || {};

      var items = [
        { label: 'Repositories', current: usage.usage.repositories, limit: limits.repositories },
        { label: 'AI Questions', current: usage.usage.aiQuestions, limit: limits.aiQuestions },
        { label: 'Doc Generations', current: usage.usage.docGenerations, limit: limits.docGenerations },
        { label: 'Security Scans', current: usage.usage.securityScans, limit: limits.securityScans },
      ];

      container.innerHTML = items.map(function (item) {
        var limitVal = item.limit;
        var limitStr = limitVal === Infinity || limitVal === null ? 'Unlimited' : (limitVal || 0);
        var pct = (limitVal === Infinity || limitVal === null || !limitVal) ? 0 : Math.min(100, Math.round((item.current / limitVal) * 100));
        return [
          '<div>',
          '  <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px">',
          '    <span>' + item.label + '</span>',
          '    <span style="color:var(--text-secondary)">' + item.current + ' / ' + limitStr + '</span>',
          '  </div>',
          '  <div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden">',
          '    <div style="height:100%;width:' + pct + '%;background:' + (pct >= 90 ? 'var(--error)' : pct >= 70 ? 'var(--warning)' : 'var(--primary)') + ';border-radius:4px;transition:width 0.3s ease"></div>',
          '  </div>',
          '</div>',
        ].join('\n');
      }).join('\n');
    } catch (err) {
      var container = document.getElementById('usageContainer');
      if (container) container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px">Could not load usage data.</p>';
    }
  }

  function initActivation() {
    var btn = document.getElementById('activateBtn');
    var input = document.getElementById('activationCode');
    var msg = document.getElementById('activationMsg');
    if (!btn || !input) return;

    btn.addEventListener('click', async function () {
      var code = input.value.trim();
      if (!code) {
        msg.innerHTML = '<span style="color:var(--error)">Please enter an activation code.</span>';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Activating...';
      msg.innerHTML = '';

      try {
        var data = await apiRequest('/auth/activate-pro', {
          method: 'POST',
          body: { code: code },
        });

        currentUser = data.data.user;
        msg.innerHTML = '<span style="color:var(--success)">' + (data.message || 'Pro plan activated successfully!') + '</span>';

        var planEl = document.getElementById('settingsPlan');
        if (planEl) {
          planEl.textContent = 'Pro';
          planEl.className = 'badge badge-primary';
        }

        var activationCard = document.getElementById('activationCard');
        if (activationCard) activationCard.style.display = 'none';
      } catch (err) {
        msg.innerHTML = '<span style="color:var(--error)">' + (err.message || 'Activation failed. Please try again.') + '</span>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Activate';
      }
    });
  }

  function initPasswordForm() {
    var form = document.getElementById('passwordForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var currentPass = document.getElementById('currentPassword').value;
      var newPass = document.getElementById('newPassword').value;
      var msg = document.getElementById('passwordMsg');

      if (!currentPass || !newPass) {
        msg.innerHTML = '<span style="color:var(--error)">Please fill in both fields.</span>';
        return;
      }
      if (newPass.length < 8) {
        msg.innerHTML = '<span style="color:var(--error)">New password must be at least 8 characters.</span>';
        return;
      }

      try {
        var data = await apiRequest('/auth/change-password', {
          method: 'POST',
          body: { currentPassword: currentPass, newPassword: newPass },
        });

        msg.innerHTML = '<span style="color:var(--success)">' + (data.message || 'Password changed. Please login again.') + '</span>';
        form.reset();

        setTimeout(function () {
          clearTokens();
          window.location.href = '/login.html';
        }, 2000);
      } catch (err) {
        msg.innerHTML = '<span style="color:var(--error)">' + (err.message || 'Failed to change password.') + '</span>';
      }
    });
  }

  function capitalize(str) {
    if (!str || typeof str !== 'string') return 'Free';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function initLogoutBtn() {
    var btn = document.getElementById('logoutBtn');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        handleLogout();
      });
    }
  }

  async function loadUser() {
    try {
      var data = await apiRequest('/auth/me');
      currentUser = data.data.user;

      var nameEl = document.getElementById('userName');
      var emailEl = document.getElementById('userEmail');
      var avatarEl = document.getElementById('userAvatar');
      if (nameEl) nameEl.textContent = currentUser.name || currentUser.email;
      if (emailEl) emailEl.textContent = currentUser.email;
      if (avatarEl) avatarEl.textContent = (currentUser.name || currentUser.email).charAt(0).toUpperCase();

      var planBadge = document.getElementById('planBadge');
      if (!planBadge) {
        var infoEl = document.querySelector('.sidebar-user-info');
        if (infoEl) {
          planBadge = document.createElement('div');
          planBadge.id = 'planBadge';
          planBadge.style.cssText = 'margin-top:2px';
          infoEl.appendChild(planBadge);
        }
      }
      if (planBadge) {
        var role = currentUser.role || 'user';
        var label = role === 'pro' ? 'Pro' : role === 'team_admin' ? 'Team' : role === 'system_admin' ? 'Admin' : 'Free';
        planBadge.innerHTML = '<span class="badge ' + (role === 'pro' || role === 'team_admin' || role === 'system_admin' ? 'badge-primary' : 'badge-warning') + '" style="font-size:11px;padding:2px 8px">' + label + '</span>';
      }
    } catch (err) {
      var msg = err.message || '';
      if (msg.includes('token') || msg.includes('Authentication') || msg.includes('Unauthorized') || msg.includes('Not authenticated')) {
        window.location.href = '/login.html';
      }
    }
  }

  function connectSocket() {
    var token = getAccessToken();
    if (!token) return;

    try {
      var wsUrl = (typeof LUMORA_CONFIG !== 'undefined') ? LUMORA_CONFIG.WS_URL : 'ws://localhost:3070';
      if (typeof io !== 'undefined') {
        var socket = io(wsUrl.replace(/^ws/, 'http'), {
          auth: { token: token },
          transports: ['websocket', 'polling'],
        });
        socket.on('notification', function (data) {
          addNotification(data);
        });
      }
    } catch {}
  }

  function addNotification(data) {
    var list = document.getElementById('notifList');
    var dot = document.getElementById('notifDot');
    if (!list || !dot) return;

    var item = document.createElement('div');
    item.className = 'notification-item unread';
    item.innerHTML = [
      '<div>',
      '  <div class="notification-item-title">' + (data.title || 'Notification') + '</div>',
      '  <div class="notification-item-time">Just now</div>',
      '</div>',
    ].join('\n');
    list.insertBefore(item, list.firstChild);
    dot.style.display = 'block';
  }

  async function handleLogout() {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: { refreshToken: localStorage.getItem('lumora-refresh-token') },
      });
    } catch {}

    clearTokens();
    window.location.href = '/login.html';
  }
})();
