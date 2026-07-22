(function () {
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

    var githubConnect = document.getElementById('githubConnectBtn');
    if (githubConnect) {
      githubConnect.addEventListener('click', connectGitHub);
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
  }

  function closeImportModal() {
    var modal = document.getElementById('importModal');
    if (modal) modal.classList.remove('open');
  }

  async function handleImport(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Importing...';
    }

    var ownerEl = document.getElementById('importOwner');
    var repoEl = document.getElementById('importRepo');
    var branchEl = document.getElementById('importBranch');
    if (!ownerEl || !repoEl) {
      showToast('Missing form fields', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Import Repository';
      }
      return;
    }

    try {
      await apiRequest('/repositories/import', {
        method: 'POST',
        body: {
          owner: ownerEl.value.trim(),
          repo: repoEl.value.trim(),
          branch: branchEl ? branchEl.value.trim() || undefined : undefined,
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
