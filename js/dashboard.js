(function () {
  var currentUser = null;
  var apiKeys = [];

  document.addEventListener('DOMContentLoaded', function () {
    initSidebar();
    initNotifications();
    initUserMenu();
    initNav();
    initLogoutBtn();
    initSearch();
    loadUser();
    loadDashboardStats();
    connectSocket();

    var params = new URLSearchParams(window.location.search);
    if (params.get('page') === 'settings') {
      var checkLoaded = setInterval(function () {
        if (currentUser) {
          clearInterval(checkLoaded);
          showPage('settings');
        }
      }, 100);
    }
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
    var trigger2 = document.getElementById('userMenuTrigger2');
    var dropdown = document.getElementById('userMenuDropdown');

    if (!dropdown) return;

    function toggleMenu(e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    }

    if (trigger) trigger.addEventListener('click', toggleMenu);
    if (trigger2) trigger2.addEventListener('click', toggleMenu);

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
        if (document.getElementById('pageContent')) {
          showPage('settings');
        } else {
          window.location.href = '/lumora/dashboard.html?page=settings';
        }
      }
    });
  }

  function initNav() {
    var nav = document.querySelector('.sidebar-nav');
    if (nav && !document.querySelector('.nav-item[href="/lumora/upgrade.html"]')) {
      var plansLink = document.createElement('a');
      plansLink.href = '/lumora/upgrade.html';
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

  function initSearch() {
    var input = document.getElementById('globalSearch');
    if (!input) return;

    var dropdown = document.getElementById('searchDropdown');
    var allRepos = [];
    var dropdownTimer = null;

    function filterCards() {
      var q = input.value.toLowerCase().trim();
      var cards = document.querySelectorAll('#repoList .repo-card');
      cards.forEach(function (card) {
        card.style.display = (!q || card.textContent.toLowerCase().includes(q)) ? '' : 'none';
      });
    }

    function hideDropdown() {
      if (dropdown) dropdown.classList.remove('open');
    }

    function showRepoDropdown(q) {
      if (!dropdown) return;
      if (!q) { hideDropdown(); return; }
      var ql = q.toLowerCase();
      var matches = allRepos.filter(function (r) {
        return (r.fullName || r.name).toLowerCase().includes(ql);
      }).slice(0, 8);

      if (matches.length === 0) {
        dropdown.innerHTML = '<div class="search-dropdown-empty">No repositories match "' + escHtml(q) + '"</div>';
      } else {
        dropdown.innerHTML = matches.map(function (r) {
          return '<a href="/lumora/repository.html?id=' + encodeURIComponent(r._id || '') + '" class="search-dropdown-item">' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(r.fullName || r.name) + '</span>' +
            '<span class="repo-lang">' + escHtml(r.language || '?') + '</span></a>';
        }).join('');
      }
      dropdown.classList.add('open');
    }

    if (window.location.pathname.includes('repositories')) {
      var urlParams = new URLSearchParams(window.location.search);
      var queryParam = urlParams.get('q');
      if (queryParam) {
        input.value = queryParam;
      }

      input.addEventListener('input', filterCards);

      var list = document.getElementById('repoList');
      if (list) {
        var observer = new MutationObserver(function () {
          if (input.value) filterCards();
        });
        observer.observe(list, { childList: true, subtree: true });
      }

      if (queryParam) setTimeout(filterCards, 100);
    } else {
      (async function () {
        try {
          var data = await apiRequest('/repositories');
          allRepos = data.data.repositories || [];
        } catch {}
      })();

      input.addEventListener('input', function () {
        clearTimeout(dropdownTimer);
        dropdownTimer = setTimeout(function () { showRepoDropdown(input.value); }, 200);
      });

      input.addEventListener('focus', function () {
        if (input.value) showRepoDropdown(input.value);
      });

      document.addEventListener('click', function (e) {
        if (!e.target.closest('.search-bar')) hideDropdown();
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hideDropdown();
        if (e.key === 'Enter' && dropdown) {
          var first = dropdown.querySelector('.search-dropdown-item');
          if (first) { window.location.href = first.getAttribute('href'); return; }
          var q = this.value.trim();
          window.location.href = '/lumora/repositories.html' + (q ? '?q=' + encodeURIComponent(q) : '');
        }
      });
    }
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

    var html = [
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
      '      <div><label style="font-size:13px;color:var(--text-muted)">Plan</label><div><span class="badge ' + planBadgeClass + '" id="settingsPlan">' + escHtml(planLabel) + '</span></div></div>',
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
      '    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">You\'re currently on the <strong>' + escHtml(planLabel) + '</strong> plan.</p>',
      '    <a href="/lumora/upgrade.html" class="btn btn-primary" style="text-decoration:none;display:inline-flex">' + (currentUser && (currentUser.role === 'pro' || currentUser.role === 'team_admin' || currentUser.role === 'system_admin') ? 'Manage Plan' : 'Upgrade Plan') + '</a>',
      '  </div>',

      '  <div class="card" id="activationCard" style="' + (currentUser && (currentUser.role === 'pro' || currentUser.role === 'team_admin') ? 'display:none' : '') + '">',
      '    <h3 style="margin-bottom:16px">Activation Code</h3>',
      '    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">Have an activation code? Enter it here to unlock a plan.</p>',
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

      '  <div class="card">',
      '    <h3 style="margin-bottom:16px">Privacy & Data</h3>',
      '    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:12px">Manage your data and privacy settings in accordance with GDPR.</p>',
      '    <div style="display:flex;flex-direction:column;gap:8px">',
      '      <button class="btn btn-secondary" id="exportDataBtn" style="justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export My Data</button>',
      '      <button class="btn btn-danger" id="deleteAccountBtn" style="justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete Account</button>',
      '    </div>',
      '    <div id="gdprMsg" style="margin-top:12px;font-size:14px"></div>',
      '  </div>',

      '</div>',
    ];

    if (currentUser && ['pro', 'team_admin', 'system_admin'].indexOf(currentUser.role) !== -1) {
      html.push(
        '  <div class="card" style="grid-column:1 / -1">',
        '    <h3 style="margin-bottom:16px">API Keys</h3>',
        '    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">Use keys to access the Lumora API programmatically. Available on Pro and Team plans.</p>',
        '    <button class="btn btn-primary" id="generateApiKeyBtn">Generate API Key</button>',
        '    <div id="apiKeysList" style="margin-top:16px;display:flex;flex-direction:column;gap:8px">',
        '      <div class="skeleton" style="height:20px;width:100%"></div>',
        '    </div>',
        '  </div>'
      );
    }

    content.innerHTML = html.join('\n');

    document.getElementById('settingsName').textContent = currentUser ? currentUser.name || currentUser.email : '';
    document.getElementById('settingsEmail').textContent = currentUser ? currentUser.email : '';

    loadUsage();
    initActivation();
    initPasswordForm();
    initGDPR();
    initApiKeys();
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
        var data = await apiRequest('/auth/activate-plan', {
          method: 'POST',
          body: { code: code },
        });

        currentUser = data.data.user;
        var planName = code === 'TEAMWORKISFUN' ? 'Team' : 'Pro';
        msg.innerHTML = '<span style="color:var(--success)">' + escHtml(data.message || planName + ' plan activated successfully!') + '</span>';

        var planEl = document.getElementById('settingsPlan');
        if (planEl) {
          planEl.textContent = planName;
          planEl.className = 'badge badge-primary';
        }

        var activationCard = document.getElementById('activationCard');
        if (activationCard) activationCard.style.display = 'none';
      } catch (err) {
        msg.innerHTML = '<span style="color:var(--error)">' + escHtml(err.message || 'Activation failed. Please try again.') + '</span>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Activate';
      }
    });
  }

  function initGDPR() {
    var exportBtn = document.getElementById('exportDataBtn');
    var deleteBtn = document.getElementById('deleteAccountBtn');
    var msg = document.getElementById('gdprMsg');

    if (exportBtn) {
      exportBtn.addEventListener('click', async function () {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Exporting...';
        if (msg) msg.innerHTML = '';
        try {
          var data = await apiRequest('/auth/export-data');
          var blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'lumora-data-export.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          if (msg) msg.innerHTML = '<span style="color:var(--success)">Data exported. Check your downloads.</span>';
        } catch (err) {
          if (msg) msg.innerHTML = '<span style="color:var(--error)">' + escHtml(err.message || 'Export failed') + '</span>';
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export My Data';
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!confirm('Are you sure you want to permanently delete your account and all associated data? This cannot be undone.')) return;
        if (!confirm('This will delete all repositories, documentation, integrations, and team data. Type DELETE to confirm.')) return;

        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';
        if (msg) msg.innerHTML = '';

        apiRequest('/auth/delete-account', { method: 'DELETE' })
          .then(function () {
            clearTokens();
            window.location.href = '/lumora/';
          })
          .catch(function (err) {
            if (msg) msg.innerHTML = '<span style="color:var(--error)">' + escHtml(err.message || 'Deletion failed') + '</span>';
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete Account';
          });
      });
    }
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

        msg.innerHTML = '<span style="color:var(--success)">' + escHtml(data.message || 'Password changed. Please login again.') + '</span>';
        form.reset();

        setTimeout(function () {
          clearTokens();
          window.location.href = '/lumora/login.html';
        }, 2000);
      } catch (err) {
        msg.innerHTML = '<span style="color:var(--error)">' + escHtml(err.message || 'Failed to change password.') + '</span>';
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
        window.location.href = '/lumora/login.html';
      }
    }
  }

  async function loadDashboardStats() {
    try {
      var data = await apiRequest('/auth/dashboard-stats');
      var stats = data.data;

      var statCards = document.querySelectorAll('.stat-card');
      if (statCards.length >= 4) {
        var valueEls = statCards[0].querySelector('.stat-card-value');
        if (valueEls) valueEls.textContent = stats.repositories || 0;

        var analysisEl = statCards[1].querySelector('.stat-card-value');
        if (analysisEl) analysisEl.textContent = stats.analyses || 0;

        var docEl = statCards[2].querySelector('.stat-card-value');
        if (docEl) docEl.textContent = stats.documents || 0;

        var healthEl = statCards[3].querySelector('.stat-card-value');
        if (healthEl) healthEl.textContent = stats.healthScore !== null && stats.healthScore !== undefined ? stats.healthScore + '%' : '—';
      }
    } catch {}
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
        socket.on('notification.new', function (data) {
          addNotification(data);
          if (data.title && data.title.toLowerCase().includes('repository')) {
            if (window.location.pathname.includes('repositories')) {
              window.loadRepositories && window.loadRepositories();
            }
          }
          if (data.title && data.title.toLowerCase().includes('documentation')) {
            if (window.location.pathname.includes('documentation')) {
              window.loadDocumentation && window.loadDocumentation();
            }
          }
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
      '  <div class="notification-item-title">' + escHtml(data.title || 'Notification') + '</div>',
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
    window.location.href = '/lumora/login.html';
  }

  function initApiKeys() {
    var btn = document.getElementById('generateApiKeyBtn');
    if (btn) btn.addEventListener('click', showApiKeyModal);
    loadApiKeys();
  }

  async function loadApiKeys() {
    var container = document.getElementById('apiKeysList');
    if (!container) return;

    try {
      var data = await apiRequest('/api-keys');
      apiKeys = data.data.apiKeys || [];
      renderApiKeys(apiKeys);
    } catch (err) {
      container.innerHTML = '<p style="color:var(--error);font-size:14px">Failed to load API keys: ' + escHtml(err.message) + '</p>';
    }
  }

  function renderApiKeys(keys) {
    var container = document.getElementById('apiKeysList');
    if (!container) return;

    if (keys.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px">No API keys yet. Generate one to access the Lumora API.</p>';
      return;
    }

    container.innerHTML = keys.map(function (key) {
      var perms = (key.permissions || []).map(function (p) {
        return '<span style="font-size:0.7rem;background:var(--bg-subtle);padding:0.15rem 0.5rem;border-radius:4px;color:var(--text-secondary)">' + escHtml(p) + '</span>';
      }).join(' ');
      return [
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:12px 14px;border:1px solid var(--border);border-radius:10px;flex-wrap:wrap">',
        '  <div style="flex:1;min-width:0">',
        '    <div style="font-size:14px;font-weight:500">' + escHtml(key.name) + '</div>',
        '    <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">lum_•••••••• · Created ' + formatDate(key.createdAt) + ' · Last used ' + (key.lastUsed ? formatDate(key.lastUsed) : 'Never') + '</div>',
        '    <div style="display:flex;gap:0.35rem;margin-top:6px;flex-wrap:wrap">' + perms + '</div>',
        '  </div>',
        '  <div style="display:flex;gap:0.5rem;align-items:center">',
        '    <button class="btn btn-ghost" data-rename-key="' + key._id + '" style="font-size:0.85rem;padding:0.3rem 0.7rem">Rename</button>',
        '    <button class="btn btn-ghost" data-revoke-key="' + key._id + '" style="font-size:0.85rem;padding:0.3rem 0.7rem;color:var(--color-danger)">Revoke</button>',
        '  </div>',
        '</div>',
      ].join('\n');
    }).join('\n');

    container.querySelectorAll('[data-rename-key]').forEach(function (btn) {
      btn.addEventListener('click', function () { renameApiKey(btn.dataset.renameKey); });
    });
    container.querySelectorAll('[data-revoke-key]').forEach(function (btn) {
      btn.addEventListener('click', function () { revokeApiKey(btn.dataset.revokeKey); });
    });
  }

  function showApiKeyModal() {
    var existing = document.getElementById('apiKeyModalOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'apiKeyModalOverlay';
    overlay.className = 'api-key-modal-overlay';
    overlay.innerHTML = [
      '<div class="api-key-modal">',
      '  <div class="api-key-modal-header">',
      '    <div class="api-key-modal-icon">',
      '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
      '    </div>',
      '    <div>',
      '      <h3>Generate API key</h3>',
      '      <p>Allow external tools to access your Lumora data.</p>',
      '    </div>',
      '    <button class="api-key-close" id="apiKeyModalClose" aria-label="Close">&times;</button>',
      '  </div>',
      '  <div class="api-key-modal-body">',
      '    <div class="api-key-field">',
      '      <label for="apiKeyName">Key name</label>',
      '      <input type="text" id="apiKeyName" class="input" placeholder="e.g. CI pipeline" maxlength="100">',
      '    </div>',
      '    <div class="api-key-field">',
      '      <label>Permissions</label>',
      '      <div class="api-key-perms">',
      '        <label class="api-key-perm checked"><input type="checkbox" value="repositories:read" checked><div><div class="api-key-perm-name">Repositories</div><div class="api-key-perm-desc">Read your repositories</div></div></label>',
      '        <label class="api-key-perm checked"><input type="checkbox" value="reports:read" checked><div><div class="api-key-perm-name">Reports</div><div class="api-key-perm-desc">Generate and read reports</div></div></label>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="api-key-modal-footer">',
      '    <button class="btn btn-secondary" id="apiKeyModalCancel">Cancel</button>',
      '    <button class="btn btn-primary" id="apiKeyModalGenerate">Generate key</button>',
      '  </div>',
      '</div>',
    ].join('\n');
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.getElementById('apiKeyModalClose').addEventListener('click', close);
    document.getElementById('apiKeyModalCancel').addEventListener('click', close);

    overlay.querySelectorAll('.api-key-perm input').forEach(function (cb) {
      cb.addEventListener('change', function () {
        cb.closest('.api-key-perm').classList.toggle('checked', cb.checked);
      });
    });

    var nameInput = document.getElementById('apiKeyName');
    nameInput.focus();
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('apiKeyModalGenerate').click();
    });

    document.getElementById('apiKeyModalGenerate').addEventListener('click', async function () {
      var btn = this;
      var checkboxes = document.querySelectorAll('#apiKeyModalOverlay input[type=checkbox]:checked');
      var permissions = Array.from(checkboxes).map(function (cb) { return cb.value; });

      if (permissions.length === 0) {
        showToast('Select at least one permission', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Generating...';

      try {
        var data = await apiRequest('/api-keys', {
          method: 'POST',
          body: { name: nameInput.value.trim(), permissions: permissions },
        });
        apiKeys.unshift(data.data.apiKey);
        renderApiKeys(apiKeys);
        showApiKeyReveal(data.data.key);
        loadApiKeys();
        showToast(data.message || 'API key generated', 'success');
      } catch (err) {
        showToast('Failed to generate key: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Generate key';
      }
    });
  }

  function showApiKeyReveal(key) {
    var overlay = document.getElementById('apiKeyModalOverlay');
    if (!overlay) return;

    overlay.querySelector('.api-key-modal').innerHTML = [
      '<div class="api-key-modal-header">',
      '  <div class="api-key-modal-icon success">',
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      '  </div>',
      '  <div>',
      '    <h3>Key created</h3>',
      '    <p>Copy it now — it will not be shown again.</p>',
      '  </div>',
      '</div>',
      '<div class="api-key-modal-body">',
      '  <div class="api-key-reveal-key">',
      '    <input type="text" id="apiKeyRevealed" class="input" value="' + escHtml(key) + '" readonly>',
      '    <button class="btn btn-primary" id="apiKeyCopyBtn">Copy</button>',
      '  </div>',
      '  <div class="api-key-warning">',
      '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      '    <div>Treat this key like a password. Anyone with it can access your data according to its permissions. You can revoke it anytime from Settings.</div>',
      '  </div>',
      '</div>',
      '<div class="api-key-modal-footer">',
      '  <button class="btn btn-secondary" id="apiKeyRevealDone">Done</button>',
      '</div>',
    ].join('\n');

    document.getElementById('apiKeyCopyBtn').addEventListener('click', function () {
      var input = document.getElementById('apiKeyRevealed');
      input.select();
      input.setSelectionRange(0, 99999);
      var copied = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(function () {
          showToast('API key copied', 'success');
        }).catch(function () {
          try {
            copied = document.execCommand('copy');
          } catch {}
          showToast(copied ? 'API key copied' : 'Failed to copy. Select the key manually.', copied ? 'success' : 'error');
        });
      } else {
        try {
          copied = document.execCommand('copy');
        } catch {}
        showToast(copied ? 'API key copied' : 'Failed to copy. Select the key manually.', copied ? 'success' : 'error');
      }
    });
    document.getElementById('apiKeyRevealDone').addEventListener('click', function () {
      overlay.remove();
    });
  }

  async function renameApiKey(id) {
    var newName = prompt('Enter a new name for this API key:');
    if (newName === null) return;
    newName = newName.trim();
    if (!newName) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    try {
      var data = await apiRequest('/api-keys/' + id, {
        method: 'PATCH',
        body: { name: newName },
      });
      apiKeys = apiKeys.map(function (k) { return k._id === id ? data.data.apiKey : k; });
      renderApiKeys(apiKeys);
      loadApiKeys();
      showToast('API key renamed', 'success');
    } catch (err) {
      showToast('Failed to rename: ' + err.message, 'error');
    }
  }

  async function revokeApiKey(id) {
    if (!confirm('Revoke this API key? Any application using it will immediately lose access.')) return;

    try {
      await apiRequest('/api-keys/' + id, { method: 'DELETE' });
      apiKeys = apiKeys.filter(function (k) { return k._id !== id; });
      renderApiKeys(apiKeys);
      loadApiKeys();
      showToast('API key revoked', 'success');
    } catch (err) {
      showToast('Failed to revoke: ' + err.message, 'error');
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '—';
    }
  }

  function escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
