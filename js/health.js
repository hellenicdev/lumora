(function () {
  let currentRepoId = null;

  document.addEventListener('DOMContentLoaded', function () {
    loadRepos();

    const healthRepoSelect = document.getElementById('healthRepoSelect');
    if (healthRepoSelect) {
      healthRepoSelect.addEventListener('change', function () {
        currentRepoId = this.value;
        if (currentRepoId) {
          loadHealth();
          loadSecurity();
        }
      });
    }

    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) scanBtn.addEventListener('click', runSecurityScan);
  });

  async function loadRepos() {
    try {
      const data = await apiRequest('/repositories');
      const repos = data.data.repositories || [];
      const select = document.getElementById('healthRepoSelect');
      if (!select) return;
      repos.forEach(function (r) {
        const opt = document.createElement('option');
        opt.value = r._id;
        opt.textContent = r.fullName || r.name;
        select.appendChild(opt);
      });
    } catch {
      showToast('Failed to load repositories', 'error');
    }
  }

  async function loadHealth() {
    const healthContent = document.getElementById('healthContent');
    const healthOverall = document.getElementById('healthOverall');
    const healthCategories = document.getElementById('healthCategories');
    if (!healthContent || !healthOverall || !healthCategories) return;

    healthContent.style.display = 'block';
    healthOverall.textContent = 'Loading...';
    healthCategories.innerHTML = '';

    try {
      const data = await apiRequest('/repositories/' + currentRepoId + '/health');
      const health = data.data.health;

      healthOverall.textContent = health.overall + '/100';
      healthOverall.style.color =
        health.overall >= 70 ? 'var(--success)' : health.overall >= 40 ? 'var(--warning)' : 'var(--error)';

      healthCategories.innerHTML = Object.entries(health.categories).map(function ([key, val]) {
        const scoreClass = val.score >= 70 ? 'good' : val.score >= 40 ? 'ok' : 'bad';
        return '<div class="health-category card">' +
          '<h3>' + key.charAt(0).toUpperCase() + key.slice(1) + '</h3>' +
          '<div class="score ' + scoreClass + '">' + val.score + '/100</div>' +
          (val.issues && val.issues.length ? '<p style="font-size:13px;color:var(--text-muted);margin-top:8px">' + val.issues.join(', ') + '</p>' : '') +
          '</div>';
      }).join('');
    } catch (err) {
      healthOverall.textContent = 'Error';
      showToast('Failed to load health data', 'error');
    }
  }

  async function loadSecurity() {
    const securityReport = document.getElementById('securityReport');
    if (!securityReport) return;

    try {
      const data = await apiRequest('/repositories/' + currentRepoId + '/security');
      const report = data.data.report;
      if (!report) return;

      const hasAlerts = report.criticalCount > 0 || report.highCount > 0;

      securityReport.innerHTML =
        (hasAlerts ? '<div class="critical-banner">🚨 ' + report.criticalCount + ' critical, ' + report.highCount + ' high issues found</div>' : '') +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
        '<div class="security-stat card"><div class="value ' + (report.criticalCount > 0 ? 'critical' : 'safe') + '">' + report.criticalCount + '</div><div class="label">Critical</div></div>' +
        '<div class="security-stat card"><div class="value high">' + report.highCount + '</div><div class="label">High</div></div>' +
        '<div class="security-stat card"><div class="value">' + report.warningCount + '</div><div class="label">Warnings</div></div>' +
        '<div class="security-stat card"><div class="value safe">' + (report.score || '—') + '</div><div class="label">Score</div></div>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">' +
        (report.openCount || 0) + ' open · ' + (report.resolvedCount || 0) + ' resolved' +
        (report.recentScan ? ' · Last scan: ' + new Date(report.recentScan).toLocaleDateString() : '') +
        '</div>' +
        renderIncidents(report.critical, 'critical') +
        renderIncidents(report.high, 'high') +
        renderIncidents(report.warning, 'warning');
    } catch {
      showToast('Failed to load security report', 'error');
    }
  }

  function renderIncidents(incidents, severity) {
    if (!incidents || incidents.length === 0) return '';
    const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
    return '<h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">' + severityLabel + ' (' + incidents.length + ')</h4>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      incidents.map(function (inc) {
        return '<div class="incident-item card" style="display:flex;align-items:center;gap:12px;padding:10px 14px">' +
          '<span class="incident-severity ' + severity + '"></span>' +
          '<span style="flex:1;font-size:13px"><strong>' + inc.type + '</strong> in ' + inc.file + ':' + inc.line + '</span>' +
          '<span style="font-size:12px;color:var(--text-muted);font-family:monospace">' + (inc.maskedValue || '') + '</span>' +
          (inc.status === 'open'
            ? '<button class="btn btn-ghost resolve-btn" data-id="' + inc._id + '" style="font-size:12px;padding:4px 10px;color:var(--success)">Resolve</button>' +
              '<button class="btn btn-ghost dismiss-btn" data-id="' + inc._id + '" style="font-size:12px;padding:4px 10px;color:var(--text-muted)">Dismiss</button>'
            : '<span class="badge badge-success">Resolved</span>') +
          '</div>';
      }).join('') + '</div>';
  }

  document.addEventListener('click', function (e) {
    const resolveBtn = e.target.closest('.resolve-btn');
    if (resolveBtn) handleResolve(resolveBtn.dataset.id);

    const dismissBtn = e.target.closest('.dismiss-btn');
    if (dismissBtn) handleDismiss(dismissBtn.dataset.id);
  });

  async function handleResolve(incidentId) {
    try {
      await apiRequest('/repositories/' + currentRepoId + '/security/' + incidentId + '/resolve', { method: 'POST' });
      loadSecurity();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDismiss(incidentId) {
    try {
      await apiRequest('/repositories/' + currentRepoId + '/security/' + incidentId + '/dismiss', { method: 'POST' });
      loadSecurity();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function runSecurityScan() {
    if (!currentRepoId) return;
    const btn = document.getElementById('scanBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Scanning...';

    try {
      await apiRequest('/repositories/' + currentRepoId + '/security/scan', { method: 'POST' });
      loadSecurity();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Run Security Scan';
    }
  }
})();
