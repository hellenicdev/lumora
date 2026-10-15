(function () {
  var githubRepos = null;
  var selectedRepo = null;
  document.addEventListener('DOMContentLoaded', function () {
    var pageEl = document.getElementById('repositoriesPage');
    if (pageEl) {
      loadRepositories();
    }

    var importForm = document.getElementById('importForm');
    if (importForm) {
      importForm.addEventListener('submit', handleImport);
    }

    var importBtn = document.getElementById('importRepoBtn');
    if (importBtn) {
      importBtn.addEventListener('click', openImportModal);
    }

    var closeModal = document.getElementById('closeImportModal');
    if (closeModal) {
      closeModal.addEventListener('click', closeImportModal);
    }

    var repoSearch = document.getElementById('repoSearch');
    if (repoSearch) {
      repoSearch.addEventListener('input', function () {
        renderRepoPicker(repoSearch.value);
      });
    }

    var githubConnect = document.getElementById('githubConnectBtn');
    if (githubConnect) {
      githubConnect.addEventListener('click', connectGitHub);
    }

    var patBtn = document.getElementById('patConnectBtn');
    if (patBtn) {
      patBtn.addEventListener('click', connectWithPat);
    }

    var patInput = document.getElementById('patInput');
    if (patInput) {
      patInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') connectWithPat();
      });
    }

    checkGitHubStatus();
  });

  async function checkGitHubStatus() {
    try {
      var data = await apiRequest('/github/status');
      var status = data.data;
      var connectCard = document.getElementById('githubConnectCard');
      var repoSection = document.getElementById('repoSection');

      if (connectCard && repoSection) {
        if (status.connected) {
          connectCard.style.display = 'none';
          repoSection.style.display = 'block';
          loadRepositories();
        } else {
          connectCard.style.display = 'block';
          repoSection.style.display = 'none';
        }
      }
    } catch (err) {
      var connectCard = document.getElementById('githubConnectCard');
      var repoSection = document.getElementById('repoSection');
      if (connectCard) connectCard.style.display = 'block';
      if (repoSection) repoSection.style.display = 'none';
    }
  }

  async function loadRepositories() {
    window.loadRepositories = loadRepositories;
    var list = document.getElementById('repoList');
    var empty = document.getElementById('repoEmpty');
    if (!list) return;

    list.innerHTML = '<div class="loading-spinner" style="text-align:center;padding:40px"><div class="spinner"></div><p style="color:var(--text-muted);margin-top:12px">Loading repositories...</p></div>';

    try {
      var data = await apiRequest('/repositories');
      var repos = data.data.repositories;

      if (repos.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }

      if (empty) empty.style.display = 'none';
      list.innerHTML = repos.map(function (repo) {
        var lang = repo.language || '?';
        return [
          '<a href="/lumora/repository.html?id=' + repo._id + '" class="repo-card card">',
          '<div class="repo-icon">' + lang.charAt(0).toUpperCase() + '</div>',
          '<div class="repo-info">',
          '<div class="repo-name">' + (repo.fullName || repo.name) + '</div>',
          '<div class="repo-description">' + (repo.description || 'No description') + '</div>',
          '</div>',
          '<div class="repo-meta">',
          '<span>' + lang + '</span>',
          '<span>' + (repo.filesCount || 0) + ' files</span>',
          '<div class="repo-status">',
          '<span class="status-dot ' + repo.analysisStatus + '"></span> ' + repo.analysisStatus,
          '</div>',
          '</div>',
          '</a>'
        ].join('');
      }).join('');

      var hasPending = repos.some(function (r) { return r.analysisStatus === 'pending' || r.analysisStatus === 'analyzing'; });
      if (hasPending) {
        setTimeout(loadRepositories, 5000);
      }
    } catch (err) {
      if (list) list.innerHTML = '<p style="color:var(--error)">Failed to load repositories.</p>';
    }
  }

  function openImportModal() {
    var modal = document.getElementById('importModal');
    if (modal) modal.classList.add('open');
    loadGitHubReposForPicker();
  }

  function closeImportModal() {
    var modal = document.getElementById('importModal');
    if (modal) modal.classList.remove('open');
  }

  async function loadGitHubReposForPicker() {
    var list = document.getElementById('repoPickerList');
    if (!list) return;
    list.innerHTML = '<div style="padding:12px;color:var(--text-muted)">Loading repositories...</div>';
    try {
      if (!githubRepos) {
        var data = await apiRequest('/github/repositories');
        githubRepos = data.data.repositories || [];
      }
      renderRepoPicker(document.getElementById('repoSearch') ? document.getElementById('repoSearch').value : '');
    } catch (err) {
      list.innerHTML = '<div style="padding:12px;color:var(--error)">Could not load GitHub repos. Connect GitHub first.</div>';
    }
  }

  function renderRepoPicker(query) {
    var list = document.getElementById('repoPickerList');
    if (!list || !githubRepos) return;
    query = (query || '').toLowerCase();
    var filtered = githubRepos.filter(function (r) {
      return !query || (r.fullName || '').toLowerCase().indexOf(query) >= 0;
    }).slice(0, 50);

    if (filtered.length === 0) {
      list.innerHTML = '<div style="padding:12px;color:var(--text-muted)">No repositories match.</div>';
      return;
    }

    list.innerHTML = filtered.map(function (r) {
      var active = selectedRepo && selectedRepo.id === r.id ? 'background:var(--accent);color:#fff;' : '';
      return '<div class="repo-picker-item" data-id="' + r.id + '" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);' + active + '">' +
        '<div style="font-weight:600">' + (r.fullName || r.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted)">' + (r.description || '') + '</div>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call(list.querySelectorAll('.repo-picker-item'), function (el) {
      el.addEventListener('click', function () {
        var id = parseInt(el.getAttribute('data-id'), 10);
        selectedRepo = githubRepos.find(function (r) { return r.id === id; }) || null;
        var hidden = document.getElementById('selectedRepoFullName');
        if (hidden && selectedRepo) hidden.value = selectedRepo.fullName;
        var branch = document.getElementById('importBranch');
        if (branch && selectedRepo && selectedRepo.defaultBranch && !branch.value) {
          branch.placeholder = selectedRepo.defaultBranch || 'main';
        }
        renderRepoPicker(document.getElementById('repoSearch').value);
      });
    });
  }

  async function handleImport(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Importing...';
    }

    var hiddenRepo = document.getElementById('selectedRepoFullName');
    var branchEl = document.getElementById('importBranch');
    if (!hiddenRepo || !hiddenRepo.value) {
      showToast('Please select a repository', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Import Repository';
      }
      return;
    }

    var parts = hiddenRepo.value.split('/');
    var owner = parts[0];
    var repoName = parts.slice(1).join('/');

    try {
      await apiRequest('/repositories/import', {
        method: 'POST',
        body: {
          owner: owner,
          repo: repoName,
          branch: branchEl ? (branchEl.value.trim() || undefined) : undefined,
        },
      });

      closeImportModal();
      setTimeout(loadRepositories, 500);
      showNotification('Import started', 'Repository import has been queued.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Import Repository';
      }
    }
  }

  async function connectGitHub() {
    try {
      var data = await apiRequest('/github/connect');
      if (data.data && data.data.url) {
        window.location.href = data.data.url;
      }
    } catch (err) {
      showToast('GitHub connection failed: ' + err.message, 'error');
      var connectCard = document.getElementById('githubConnectCard');
      var repoSection = document.getElementById('repoSection');
      if (connectCard) connectCard.style.display = 'block';
      if (repoSection) repoSection.style.display = 'none';
    }
  }

  async function connectWithPat() {
    var input = document.getElementById('patInput');
    var error = document.getElementById('patError');
    var btn = document.getElementById('patConnectBtn');
    if (!input || !input.value.trim()) return;

    var token = input.value.trim();
    btn.disabled = true;
    btn.textContent = 'Validating...';
    if (error) error.style.display = 'none';

    try {
      var data = await apiRequest('/github/pat', {
        method: 'POST',
        body: { token: token },
      });

      showToast('Connected as ' + (data.data.user.login || '') + '. ' + data.data.repositories.length + ' repositories available.', 'success');
      var connectCard = document.getElementById('githubConnectCard');
      var repoSection = document.getElementById('repoSection');
      if (connectCard) connectCard.style.display = 'none';
      if (repoSection) repoSection.style.display = 'block';
      loadRepositories();
    } catch (err) {
      if (error) {
        error.textContent = err.message;
        error.style.display = 'block';
      }
      showToast('Connection failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Connect';
    }
  }

  function showNotification(title, message) {
    var notifDot = document.getElementById('notifDot');
    var notifList = document.getElementById('notifList');
    if (notifDot) notifDot.style.display = 'block';
    if (notifList) {
      var item = document.createElement('div');
      item.className = 'notification-item unread';
      item.innerHTML = '<div><div class="notification-item-title">' + title + '</div>' + (message ? '<div class="notification-item-desc" style="font-size:12px;color:var(--text-muted);margin-top:2px">' + message + '</div>' : '') + '<div class="notification-item-time">Just now</div></div>';
      notifList.insertBefore(item, notifList.firstChild);
    }
  }
})();
