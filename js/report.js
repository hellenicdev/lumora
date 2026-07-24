(function () {
  const container = document.getElementById('report-content');
  if (!container) return;

  const slug = window.location.pathname.replace('/lumora/shared-report.html', '').replace(/^\/+/, '').split('?')[0] || '';

  if (!slug) {
    container.innerHTML = '<div class="error">No report slug specified.</div>';
    return;
  }

  document.title = 'Shared Report - Lumora';

  fetch(`${API_BASE}/api/reports/shared/${slug}`)
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        container.innerHTML = `<div class="error">${res.error || 'Report not found'}</div>`;
        return;
      }

      const report = res.data.report;
      renderReport(report);
    })
    .catch(err => {
      container.innerHTML = '<div class="error">Failed to load report. Please try again.</div>';
    });

  function renderReport(report) {
    const d = report.data;
    const isOnboarding = report.reportType === 'onboarding';
    const isHealth = report.reportType === 'health';
    const isSecurity = report.reportType === 'security';
    const isArchitecture = report.reportType === 'architecture';

    let html = '';

    if (isOnboarding && d) {
      html += `
        <div class="report-card">
          <h1>${escHtml(d.repoName)}</h1>
          <div class="repo-name">${escHtml(d.description || 'No description')}</div>
          <div class="report-meta">
            <span>${escHtml(d.language || 'Unknown')}</span>
            <span>${d.filesCount} files</span>
            <span>${d.defaultBranch}</span>
            <span>Generated ${new Date(d.generatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      `;

      if (d.personality) {
        html += `<div class="personality-card"><p>${escHtml(d.personality)}</p></div>`;
      }

      html += `
        <div class="overall-score ${scoreClass(d.overallScore)}">
          <div class="score-value">${Math.round(d.overallScore)}</div>
          <div class="score-label">Overall Health</div>
        </div>
      `;

      if (d.subScores) {
        html += '<div class="sub-scores">';
        Object.entries(d.subScores).forEach(([key, val]) => {
          html += `
            <div class="sub-score-item">
              <div class="sub-label">${escHtml(key)}</div>
              <div class="sub-value" style="color:${scoreColor(val.score)}">${Math.round(val.score)}</div>
              <div class="sub-detail">${val.total || 0} items</div>
            </div>
          `;
        });
        html += '</div>';
      }

      if (d.technologies && d.technologies.length > 0) {
        html += `<div class="section-title">Technologies</div><div class="technologies">`;
        d.technologies.forEach(t => { html += `<span>${escHtml(t)}</span>`; });
        html += '</div>';
      }

      if (d.entryPoints && d.entryPoints.length > 0) {
        html += `<div class="section-title">Entry Points</div><ul class="entry-points">`;
        d.entryPoints.slice(0, 8).forEach(ep => { html += `<li>${escHtml(ep)}</li>`; });
        html += '</ul>';
      }

      if (d.architecture) {
        html += `<div class="section-title">Architecture</div><div class="arch-stats">`;
        html += `<div class="arch-stat"><div class="stat-value">${d.architecture.modules}</div><div class="stat-label">Modules</div></div>`;
        html += `<div class="arch-stat"><div class="stat-value">${d.architecture.connections}</div><div class="stat-label">Connections</div></div>`;
        html += `<div class="arch-stat"><div class="stat-value">${d.architecture.endpoints}</div><div class="stat-label">Endpoints</div></div>`;
        html += '</div>';

        if (d.architecture.nodeTypes && Object.keys(d.architecture.nodeTypes).length > 0) {
          html += '<div class="module-list">';
          Object.entries(d.architecture.nodeTypes).forEach(([type, count]) => {
            html += `<div class="module-item">${escHtml(type)} <span class="file-count">(${count})</span></div>`;
          });
          html += '</div>';
        }
      }

      if (d.dependencies) {
        html += `<div class="section-title">Dependencies</div><div class="arch-stats">`;
        html += `<div class="arch-stat"><div class="stat-value">${d.dependencies.total}</div><div class="stat-label">Total</div></div>`;
        html += `<div class="arch-stat"><div class="stat-value">${d.dependencies.production}</div><div class="stat-label">Production</div></div>`;
        html += `<div class="arch-stat"><div class="stat-value">${d.dependencies.development}</div><div class="stat-label">Development</div></div>`;
        html += '</div>';
      }

      if (d.securityConcerns && d.securityConcerns.length > 0) {
        html += `<div class="section-title">Security Concerns (${d.securityConcerns.length})</div>`;
        d.securityConcerns.forEach(s => {
          html += `
            <div class="security-item severity-${s.severity}">
              <span class="sev-badge ${s.severity}">${escHtml(s.severity)}</span>
              <strong>${escHtml(s.type)}</strong>
              <span class="conf-badge ${s.confidence || 'low'}">${escHtml(s.confidence || 'low')} confidence</span>
              <div class="file-path">${escHtml(s.file)}</div>
              ${s.explanation ? `<div style="font-size:0.85rem;margin-top:0.25rem;color:var(--text-secondary)">${escHtml(s.explanation)}</div>` : ''}
            </div>
          `;
        });
      }

      if (d.missingDocumentation && d.missingDocumentation.length > 0) {
        html += `<div class="section-title">Missing Documentation</div><div class="missing-docs">`;
        d.missingDocumentation.forEach(m => { html += `<span>${escHtml(m)}</span>`; });
        html += '</div>';
      }

      if (d.suggestedFirstIssues && d.suggestedFirstIssues.length > 0) {
        html += `<div class="section-title">Suggested First Issues</div>`;
        d.suggestedFirstIssues.forEach(issue => {
          html += `
            <div class="suggested-issue priority-${issue.priority}">
              <div class="issue-priority" style="color:${issue.priority === 'critical' ? 'var(--color-danger)' : '#e67e22'}">${escHtml(issue.priority)}</div>
              <div class="issue-text">${escHtml(issue.suggestion)}</div>
            </div>
          `;
        });
      }
    } else if (isHealth && d) {
      const health = d.health || d;
      html += `
        <div class="report-card">
          <h1>Health Report</h1>
          <div class="repo-name">${escHtml(report.title)}</div>
        </div>
        <div class="overall-score ${scoreClass(health.overall)}">
          <div class="score-value">${Math.round(health.overall)}</div>
          <div class="score-label">Overall Health</div>
        </div>
      `;
      if (health.categories) {
        html += '<div class="sub-scores">';
        Object.entries(health.categories).forEach(([key, val]) => {
          html += `
            <div class="sub-score-item">
              <div class="sub-label">${escHtml(key)}</div>
              <div class="sub-value" style="color:${scoreColor(val.score)}">${Math.round(val.score)}</div>
              <div class="sub-detail">${val.total || 0} items</div>
            </div>
          `;
        });
        html += '</div>';
      }
    } else if (isSecurity && d) {
      const incidents = d.openIncidents || d.incidents || [];
      html += `
        <div class="report-card">
          <h1>Security Report</h1>
          <div class="repo-name">${escHtml(report.title)}</div>
          <div class="report-meta"><span>${incidents.length} open incidents</span></div>
        </div>
        ${incidents.length === 0 ? '<p style="text-align:center;padding:2rem;color:var(--color-success)">No open security incidents.</p>' : ''}
      `;
      incidents.forEach(s => {
        html += `
          <div class="security-item severity-${s.severity}">
            <span class="sev-badge ${s.severity}">${escHtml(s.severity)}</span>
            <strong>${escHtml(s.type)}</strong>
            <span class="conf-badge ${s.confidence || 'low'}">${escHtml(s.confidence || 'low')} confidence</span>
            <div class="file-path">${escHtml(s.file)}${s.line ? ':' + s.line : ''}</div>
            ${s.explanation ? `<div style="font-size:0.85rem;margin-top:0.25rem;color:var(--text-secondary)">${escHtml(s.explanation)}</div>` : ''}
          </div>
        `;
      });
    } else if (isArchitecture && d) {
      html += `
        <div class="report-card">
          <h1>Architecture Report</h1>
          <div class="repo-name">${escHtml(report.title)}</div>
          <div class="report-meta">
            <span>${d.stats.totalModules} modules</span>
            <span>${d.stats.totalConnections} connections</span>
            <span>${d.stats.totalEndpoints} endpoints</span>
            <span>${d.totalFiles} files</span>
          </div>
        </div>
      `;

      if (d.modules && d.modules.length > 0) {
        html += `<div class="section-title">Modules (${d.modules.length})</div><div class="module-list">`;
        d.modules.forEach(m => {
          html += `<div class="module-item">${escHtml(m.name)} <span class="file-count">(${m.fileCount} files)</span></div>`;
        });
        html += '</div>';
      }

      if (d.moduleEdges && d.moduleEdges.length > 0) {
        html += `<div class="section-title">Module Connections</div><ul class="entry-points">`;
        d.moduleEdges.slice(0, 15).forEach(e => {
          html += `<li>${escHtml(e.source)} → ${escHtml(e.target)} (${e.weight} connections)</li>`;
        });
        if (d.moduleEdges.length > 15) {
          html += `<li style="color:var(--text-secondary)">...and ${d.moduleEdges.length - 15} more</li>`;
        }
        html += '</ul>';
      }

      if (d.apiEndpoints) {
        html += `<div class="section-title">API Endpoints by Group</div>`;
        Object.entries(d.apiEndpoints).forEach(([group, eps]) => {
          if (eps.length === 0) return;
          html += `<div style="margin-bottom:1rem"><strong>/${escHtml(group)}</strong> (${eps.length})<ul class="entry-points">`;
          eps.slice(0, 5).forEach(ep => {
            html += `<li>${escHtml(ep.method)} ${escHtml(ep.path)}${ep.description ? ' — ' + escHtml(ep.description) : ''}</li>`;
          });
          if (eps.length > 5) html += `<li style="color:var(--text-secondary)">...and ${eps.length - 5} more</li>`;
          html += '</ul></div>';
        });
      }
    }

    if (!html) {
      html = '<div class="error">Unsupported report type or empty data.</div>';
    }

    container.innerHTML = html;
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
})();
