(function () {
  var docs = {};
  var quality = {};
  var currentRepoId = null;
  var currentDocType = null;

  document.addEventListener('DOMContentLoaded', function () {
    loadRepos();
    var select = document.getElementById('docRepoSelect');
    if (select) {
      select.addEventListener('change', function () {
        var id = this.value;
        if (id) {
          currentRepoId = id;
          loadDocDashboard(id);
        } else {
          var dashboard = document.getElementById('docDashboard');
          if (dashboard) dashboard.style.display = 'none';
        }
      });
    }

    var regenBtn = document.getElementById('regenerateBtn');
    if (regenBtn) regenBtn.addEventListener('click', regenerateDoc);
    var copyBtn = document.getElementById('copyBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyDoc);
  });

  async function loadRepos() {
    try {
      var data = await apiRequest('/repositories');
      var repos = data.data.repositories;
      var select = document.getElementById('docRepoSelect');
      if (!select) return;

      repos.forEach(function (repo) {
        var opt = document.createElement('option');
        opt.value = repo._id;
        opt.textContent = repo.fullName || repo.name;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load repos:', err);
    }
  }

  async function loadDocDashboard(repoId) {
    window.loadDocDashboard = loadDocDashboard;
    var dashboard = document.getElementById('docDashboard');
    var viewer = document.getElementById('docViewer');
    if (dashboard) dashboard.style.display = 'block';
    if (viewer) viewer.style.display = 'none';

    var cardsContainer = document.getElementById('docCards');
    if (cardsContainer) {
      cardsContainer.innerHTML = '<div class="loading-spinner" style="text-align:center;padding:40px"><div class="spinner"></div><p style="color:var(--text-muted);margin-top:12px">Loading documentation...</p></div>';
    }

    try {
      var docData = await apiRequest('/repositories/' + repoId + '/docs');
      var qualityData = await apiRequest('/repositories/' + repoId + '/docs/status');
      var driftData = await apiRequest('/repositories/' + repoId + '/docs/drift');

      docs = docData.data.grouped || {};
      quality = qualityData.data;

      renderDocCards();
      renderQualityScore();
      renderDriftAlert(driftData.data);
    } catch (err) {
      if (cardsContainer) cardsContainer.innerHTML = '<p style="color:var(--error)">Failed to load documentation.</p>';
    }
  }

  function renderDocCards() {
    var types = [
      { key: 'README', label: 'README', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
      { key: 'WIKI', label: 'Wiki', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      { key: 'API_DOC', label: 'API Documentation', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
      { key: 'ARCHITECTURE', label: 'Architecture', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    ];

    var container = document.getElementById('docCards');
    if (!container) return;
    container.innerHTML = types.map(function (t) {
      var version = docs[t.key] ? docs[t.key][0] : null;
      var status = version
        ? '<span class="badge badge-success">Generated</span>'
        : '<span class="badge badge-warning">Not generated</span>';
      var time = version
        ? new Date(version.createdAt).toLocaleDateString()
        : '\u2014';

      return [
        '<div class="doc-card card" data-type="' + t.key + '">',
        '<div class="doc-card-header">',
        '<div class="doc-card-icon">',
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="' + t.icon + '"/></svg>',
        '</div>',
        status,
        '</div>',
        '<div class="doc-card-title">' + t.label + '</div>',
        '<div class="doc-card-status">Last updated: ' + time + '</div>',
        '<div class="doc-card-actions">',
        version ? '<button class="btn btn-ghost view-doc-btn" data-type="' + t.key + '">View</button>' : '',
        '<button class="btn btn-primary gen-doc-btn" data-type="' + t.key + '">' + (version ? 'Regenerate' : 'Generate') + '</button>',
        '</div>',
        '</div>'
      ].join('');
    }).join('');

    container.querySelectorAll('.view-doc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewDoc(this.dataset.type);
      });
    });

    container.querySelectorAll('.gen-doc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        generateDoc(this.dataset.type, this);
      });
    });
  }

  function renderQualityScore() {
    var el = document.getElementById('qualityScore');
    if (el) el.textContent = (quality.score || 0) + '%';

    var details = document.getElementById('qualityDetails');
    if (!details) return;

    var items = [
      { label: 'README', done: quality.details ? quality.details.readme : undefined },
      { label: 'Wiki', done: quality.details ? quality.details.wiki : undefined },
      { label: 'API Docs', done: quality.details ? quality.details.apiDocs : undefined },
      { label: 'Architecture', done: quality.details ? quality.details.architecture : undefined },
    ];

    details.innerHTML = items.map(function (item) {
      return [
        '<div class="doc-quality-item">',
        '<span>' + item.label + '</span>',
        '<span style="color:' + (item.done ? 'var(--success)' : 'var(--text-muted)') + '">',
        item.done ? '\u2713' : '\u2014',
        '</span>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderDriftAlert(drift) {
    var el = document.getElementById('driftAlert');
    if (!el) return;
    if (!drift || !drift.hasDrift) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" style="flex-shrink:0;margin-top:2px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
      '<div><strong style="font-size:14px">Documentation may be outdated</strong>' +
      '<p style="font-size:13px;color:var(--text-secondary);margin-top:4px">' + (drift.issues || []).map(function (i) { return i.message; }).join('<br>') + '</p></div></div>';
  }

  async function viewDoc(type) {
    currentDocType = type;
    var viewer = document.getElementById('docViewer');
    var titleEl = document.getElementById('docViewerTitle');
    var contentEl = document.getElementById('docContent');
    var metaEl = document.getElementById('docViewerMeta');

    if (viewer) viewer.style.display = 'block';
    var titleMap = { README: 'README.md', WIKI: 'Wiki', API_DOC: 'API Documentation', ARCHITECTURE: 'Architecture' };
    if (titleEl) titleEl.textContent = titleMap[type] || type;
    if (contentEl) contentEl.innerHTML = '<div class="loading-spinner" style="text-align:center;padding:40px"><div class="spinner"></div></div>';

    try {
      var data = await apiRequest('/repositories/' + currentRepoId + '/docs/' + type);
      var doc = data.data.doc;

      if (!doc) {
        if (contentEl) contentEl.innerHTML = '<p style="color:var(--text-muted)">No documentation generated yet.</p>';
        if (metaEl) metaEl.textContent = '';
        return;
      }

      if (contentEl) contentEl.innerHTML = renderMarkdown(doc.content);
      if (metaEl) metaEl.textContent = 'Generated ' + new Date(doc.createdAt).toLocaleString();
    } catch (err) {
      if (contentEl) contentEl.innerHTML = '<p style="color:var(--error)">Failed to load document.</p>';
    }
  }

  async function generateDoc(type, btn) {
    if (!btn) return;
    if (!currentRepoId) return;

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      await apiRequest('/repositories/' + currentRepoId + '/docs/' + type + '/regenerate', {
        method: 'POST',
        body: { type: type },
      });
      loadDocDashboard(currentRepoId);
    } catch (err) {
      showToast('Failed to generate: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async function regenerateDoc() {
    if (!currentRepoId || !currentDocType) return;
    var btn = document.getElementById('regenerateBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Regenerating...';

    try {
      await apiRequest('/repositories/' + currentRepoId + '/docs/' + currentDocType + '/regenerate', {
        method: 'POST',
        body: { type: currentDocType },
      });
      viewDoc(currentDocType);
    } catch (err) {
      showToast('Failed to regenerate: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Regenerate';
    }
  }

  function copyDoc() {
    var content = document.getElementById('docContent');
    if (!content) return;
    var text = content.textContent || '';

    function copyDone() {
      var btn = document.getElementById('copyBtn');
      if (!btn) return;
      btn.textContent = 'Copied!';
      setTimeout(function () {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy';
      }, 2000);
    }

    function fallbackCopy() {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copyDone();
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(copyDone).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function renderMarkdown(md) {
    if (!md) return '<p style="color:var(--text-muted)">No content.</p>';
    var html = md;

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    html = html.replace(/^- (.+)$/gm, '<li class="ul">$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ol">$1</li>');

    html = html.replace(/(<li class="ol">[^<]*<\/li>\n?)+/g, function (m) { return '<ol>' + m.replace(/ class="(ol|ul)"/g, '') + '</ol>'; });
    html = html.replace(/(<li class="ul">[^<]*<\/li>\n?)+/g, function (m) { return '<ul>' + m.replace(/ class="(ol|ul)"/g, '') + '</ul>'; });
    html = html.replace(/ class="(ol|ul)"/g, '');

    html = html.replace(/\n---+\n/g, '\n<hr>\n');

    html = html.replace(/^\|(.+)\|$/gm, function (match) {
      if (match.includes('---')) return '';
      var cells = match.slice(1, -1).split('|').map(function (c) { return c.trim(); });
      return '<tr><td>' + cells.join('</td><td>') + '</td></tr>';
    });

    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    html = html.replace(/<p><\/p>/g, '<br>');

    return html;
  }
})();
