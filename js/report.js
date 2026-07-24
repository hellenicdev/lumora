(function () {
  var container = document.getElementById('report-content');
  if (!container) return;

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug') || '';

  if (!slug) {
    container.innerHTML =
      '<div class="report-empty">' +
        '<div class="report-empty-icon">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '</div>' +
        '<h2>No report specified</h2>' +
        '<p>The link you followed is missing a report slug.</p>' +
        '<a href="." class="btn btn-primary" style="margin-top:1rem">Go to Lumora</a>' +
      '</div>';
    return;
  }

  document.title = 'Shared Report - Lumora';

  var loadingStart = Date.now();

  fetch(API_BASE + '/reports/shared/' + slug)
    .then(function (r) { return r.json(); })
    .then(function (res) {
      var elapsed = Date.now() - loadingStart;
      var delay = Math.max(0, 400 - elapsed);

      setTimeout(function () {
        if (!res.success) {
          showError(res.error || 'Report not found');
          return;
        }
        renderReport(res.data.report);
      }, delay);
    })
    .catch(function () {
      showError('Failed to load report. Please try again.');
    });

  function showError(msg) {
    container.innerHTML =
      '<div class="report-empty">' +
        '<div class="report-empty-icon">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        '</div>' +
        '<h2>' + escHtml(msg) + '</h2>' +
        '<p>The report may have expired or been deleted.</p>' +
        '<a href="." class="btn btn-primary" style="margin-top:1rem">Go to Lumora</a>' +
      '</div>';
  }

  function renderReport(report) {
    var d = report.data;
    var isOnboarding = report.reportType === 'onboarding';
    var isHealth = report.reportType === 'health';
    var isSecurity = report.reportType === 'security';
    var isArchitecture = report.reportType === 'architecture';

    var html = '<div class="report-header">' +
      '<div class="report-header-content">' +
        '<div class="report-breadcrumb">Shared Report</div>' +
        '<h1 class="report-title">' + escHtml(report.title || 'Untitled Report') + '</h1>' +
        '<div class="report-meta-bar">' +
          '<span class="report-type-badge report-type-' + report.reportType + '">' + escHtml(report.reportType) + '</span>' +
          '<span>' + (d && d.language ? escHtml(d.language) : '') + '</span>' +
          '<span>' + formatDate(report.createdAt) + '</span>' +
          '<span>' + (report.views || 0) + ' views</span>' +
        '</div>' +
      '</div>' +
    '</div>';

    if (isOnboarding && d) {
      html += renderOnboarding(d, report);
    } else if (isHealth && d) {
      html += renderHealth(d, report);
    } else if (isSecurity && d) {
      html += renderSecurity(d, report);
    } else if (isArchitecture && d) {
      html += renderArchitecture(d, report);
    } else {
      html += '<div class="report-empty"><p>Unsupported report type or empty data.</p></div>';
    }

    html += '<div class="report-footer-cta">' +
      '<div class="report-cta-card glass">' +
        '<h3>Want this for your repository?</h3>' +
        '<p>Lumora generates onboarding reports, health scores, security scans, and architecture diagrams for any GitHub repo.</p>' +
        '<a href="." class="btn btn-primary">Try Lumora Free</a>' +
      '</div>' +
    '</div>';

    container.innerHTML = html;
  }

  function renderOnboarding(d) {
    var h = '';
    h += '<div class="report-summary-card">';

    if (d.personality) {
      h += '<div class="personality-card"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" style="flex-shrink:0;margin-top:2px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><p>' + escHtml(d.personality) + '</p></div>';
    }

    h += '<div class="overall-score ' + scoreClass(d.overallScore) + '">' +
      '<div class="score-ring">' +
        '<svg width="100" height="100" viewBox="0 0 100 100">' +
          '<circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-subtle)" stroke-width="6"/>' +
          '<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="' + (2 * Math.PI * 42) + '" stroke-dashoffset="' + (2 * Math.PI * 42 * (1 - (d.overallScore || 0) / 100)) + '" stroke-linecap="round" transform="rotate(-90, 50, 50)"/>' +
        '</svg>' +
        '<div class="score-ring-value">' + Math.round(d.overallScore) + '</div>' +
      '</div>' +
      '<div class="score-label">Overall Health</div>' +
    '</div>';

    h += '</div>';

    if (d.subScores) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Quality Breakdown</h2></div><div class="sub-scores">';
      var categories = [
        { key: 'documentation', label: 'Documentation', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
        { key: 'security', label: 'Security', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
        { key: 'architecture', label: 'Architecture', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
        { key: 'dependencies', label: 'Dependencies', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
        { key: 'complexity', label: 'Complexity', icon: 'M12 20V10M18 20V4M6 20v-4' },
        { key: 'testing', label: 'Testing', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        { key: 'maintainability', label: 'Maintainability', icon: 'M4 4v16h16' },
      ];
      categories.forEach(function (cat) {
        var val = d.subScores[cat.key];
        if (!val) return;
        h += '<div class="sub-score-item"><div class="sub-score-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + scoreColor(val.score) + '" stroke-width="2"><path d="' + cat.icon + '"/></svg></div><div class="sub-label">' + cat.label + '</div><div class="sub-value" style="color:' + scoreColor(val.score) + '">' + Math.round(val.score) + '</div><div class="sub-detail">' + (val.total || val.items || 0) + ' items</div></div>';
      });
      h += '</div></div>';
    }

    if (d.technologies && d.technologies.length > 0) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Technologies</h2></div><div class="technologies">';
      d.technologies.forEach(function (t) { h += '<span>' + escHtml(t) + '</span>'; });
      h += '</div></div>';
    }

    if (d.entryPoints && d.entryPoints.length > 0) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Entry Points</h2><span class="section-count">' + d.entryPoints.length + '</span></div><ul class="entry-points">';
      d.entryPoints.forEach(function (ep) { h += '<li>' + escHtml(ep) + '</li>'; });
      h += '</ul></div>';
    }

    if (d.architecture) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Architecture</h2></div><div class="arch-stats">';
      [
        ['Modules', d.architecture.modules],
        ['Connections', d.architecture.connections],
        ['Endpoints', d.architecture.endpoints],
      ].forEach(function (s) {
        h += '<div class="arch-stat"><div class="stat-value">' + s[1] + '</div><div class="stat-label">' + s[0] + '</div></div>';
      });
      h += '</div>';
      if (d.architecture.nodeTypes && Object.keys(d.architecture.nodeTypes).length > 0) {
        h += '<div class="module-list">';
        Object.entries(d.architecture.nodeTypes).forEach(function (kv) {
          h += '<div class="module-item">' + escHtml(kv[0]) + ' <span class="file-count">(' + kv[1] + ')</span></div>';
        });
        h += '</div>';
      }
      h += '</div>';
    }

    if (d.dependencies) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Dependencies</h2></div><div class="arch-stats">';
      [
        ['Total', d.dependencies.total],
        ['Production', d.dependencies.production],
        ['Development', d.dependencies.development],
      ].forEach(function (s) {
        h += '<div class="arch-stat"><div class="stat-value">' + s[1] + '</div><div class="stat-label">' + s[0] + '</div></div>';
      });
      h += '</div></div>';
    }

    if (d.securityConcerns && d.securityConcerns.length > 0) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Security Concerns</h2><span class="section-count badge badge-error">' + d.securityConcerns.length + '</span></div>';
      d.securityConcerns.forEach(function (s) {
        h += '<div class="security-item severity-' + s.severity + '">' +
          '<div class="security-item-head">' +
            '<span class="sev-badge ' + s.severity + '">' + escHtml(s.severity) + '</span>' +
            '<strong>' + escHtml(s.type) + '</strong>' +
            '<span class="conf-badge ' + (s.confidence || 'low') + '">' + escHtml(s.confidence || 'low') + '</span>' +
          '</div>' +
          '<div class="file-path">' + escHtml(s.file) + '</div>' +
          (s.explanation ? '<div class="security-explanation">' + escHtml(s.explanation) + '</div>' : '') +
        '</div>';
      });
      h += '</div>';
    }

    if (d.missingDocumentation && d.missingDocumentation.length > 0) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Missing Documentation</h2></div><div class="missing-docs">';
      d.missingDocumentation.forEach(function (m) { h += '<span>' + escHtml(m) + '</span>'; });
      h += '</div></div>';
    }

    if (d.suggestedFirstIssues && d.suggestedFirstIssues.length > 0) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Suggested Improvements</h2></div>';
      d.suggestedFirstIssues.forEach(function (issue) {
        h += '<div class="suggested-issue priority-' + issue.priority + '">' +
          '<div class="issue-priority" style="color:' + (issue.priority === 'critical' ? 'var(--color-danger)' : '#e67e22') + '">' + escHtml(issue.priority) + ' priority</div>' +
          '<div class="issue-text">' + escHtml(issue.suggestion) + '</div>' +
        '</div>';
      });
      h += '</div>';
    }

    return h;
  }

  function renderHealth(d) {
    var health = d.health || d;
    var h = '<div class="overall-score ' + scoreClass(health.overall) + '">' +
      '<div class="score-ring">' +
        '<svg width="100" height="100" viewBox="0 0 100 100">' +
          '<circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-subtle)" stroke-width="6"/>' +
          '<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="' + (2 * Math.PI * 42) + '" stroke-dashoffset="' + (2 * Math.PI * 42 * (1 - (health.overall || 0) / 100)) + '" stroke-linecap="round" transform="rotate(-90, 50, 50)"/>' +
        '</svg>' +
        '<div class="score-ring-value">' + Math.round(health.overall) + '</div>' +
      '</div>' +
      '<div class="score-label">Overall Health</div>' +
    '</div>';

    if (health.categories) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Category Scores</h2></div><div class="sub-scores">';
      Object.entries(health.categories).forEach(function (kv) {
        h += '<div class="sub-score-item"><div class="sub-label">' + escHtml(kv[0]) + '</div><div class="sub-value" style="color:' + scoreColor(kv[1].score) + '">' + Math.round(kv[1].score) + '</div><div class="sub-detail">' + (kv[1].total || 0) + ' items</div></div>';
      });
      h += '</div></div>';
    }
    return h;
  }

  function renderSecurity(d) {
    var incidents = d.openIncidents || d.incidents || [];
    var h = '<div class="security-report-header"><div class="security-stat card"><div class="value" style="color:' + (incidents.length > 0 ? 'var(--color-danger)' : 'var(--color-success)') + '">' + incidents.length + '</div><div class="label">Open Incidents</div></div></div>';
    if (incidents.length === 0) {
      h += '<div class="report-empty"><p style="color:var(--color-success)">No open security incidents.</p></div>';
    }
    incidents.forEach(function (s) {
      h += '<div class="security-item severity-' + s.severity + '">' +
        '<div class="security-item-head">' +
          '<span class="sev-badge ' + s.severity + '">' + escHtml(s.severity) + '</span>' +
          '<strong>' + escHtml(s.type) + '</strong>' +
          '<span class="conf-badge ' + (s.confidence || 'low') + '">' + escHtml(s.confidence || 'low') + '</span>' +
        '</div>' +
        '<div class="file-path">' + escHtml(s.file) + (s.line ? ':' + s.line : '') + '</div>' +
        (s.explanation ? '<div class="security-explanation">' + escHtml(s.explanation) + '</div>' : '') +
      '</div>';
    });
    return h;
  }

  function renderArchitecture(d) {
    var h = '<div class="arch-stats">';
    [
      ['Modules', d.stats ? d.stats.totalModules : (d.modules || []).length],
      ['Connections', d.stats ? d.stats.totalConnections : (d.connections || []).length],
      ['Endpoints', d.stats ? d.stats.totalEndpoints : 0],
      ['Files', d.totalFiles || 0],
    ].forEach(function (s) {
      h += '<div class="arch-stat"><div class="stat-value">' + s[1] + '</div><div class="stat-label">' + s[0] + '</div></div>';
    });
    h += '</div>';

    if (d.modules && d.modules.length > 0) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Modules</h2><span class="section-count">' + d.modules.length + '</span></div><div class="module-list">';
      d.modules.forEach(function (m) {
        h += '<div class="module-item">' + escHtml(m.name) + ' <span class="file-count">(' + m.fileCount + ' files)</span></div>';
      });
      h += '</div></div>';
    }

    if (d.moduleEdges && d.moduleEdges.length > 0) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>Module Connections</h2></div><ul class="entry-points">';
      d.moduleEdges.slice(0, 25).forEach(function (e) {
        h += '<li>' + escHtml(e.source) + ' <span style="color:var(--text-muted)">→</span> ' + escHtml(e.target) + ' <span style="color:var(--text-muted);font-size:12px">(' + e.weight + ')</span></li>';
      });
      if (d.moduleEdges.length > 25) {
        h += '<li style="color:var(--text-muted);font-size:13px;padding-top:8px">...and ' + (d.moduleEdges.length - 25) + ' more connections</li>';
      }
      h += '</ul></div>';
    }

    if (d.apiEndpoints) {
      h += '<div class="report-section"><div class="section-header-inline"><h2>API Endpoints</h2></div>';
      Object.entries(d.apiEndpoints).forEach(function (kv) {
        var group = kv[0], eps = kv[1];
        if (!eps || eps.length === 0) return;
        h += '<div class="api-group"><div class="api-group-title">/' + escHtml(group) + ' <span class="section-count">' + eps.length + '</span></div><ul class="entry-points">';
        eps.slice(0, 8).forEach(function (ep) {
          var methodColors = { GET: 'var(--color-success)', POST: 'var(--accent-primary)', PUT: '#e67e22', PATCH: '#e67e22', DELETE: 'var(--color-danger)' };
          h += '<li><span style="font-weight:600;color:' + (methodColors[ep.method] || 'var(--text-primary)') + ';margin-right:6px">' + ep.method + '</span>' + escHtml(ep.path) + (ep.description ? ' <span style="color:var(--text-muted);font-size:12px">— ' + escHtml(ep.description) + '</span>' : '') + '</li>';
        });
        if (eps.length > 8) h += '<li style="color:var(--text-muted);font-size:13px">...and ' + (eps.length - 8) + ' more</li>';
        h += '</ul></div>';
      });
      h += '</div>';
    }

    return h;
  }

  function escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function scoreClass(score) {
    if (score == null) return '';
    if (score >= 70) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-bad';
  }

  function scoreColor(score) {
    if (score == null) return 'var(--text-primary)';
    if (score >= 70) return 'var(--color-success)';
    if (score >= 40) return 'var(--color-warning)';
    return 'var(--color-danger)';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }
})();
