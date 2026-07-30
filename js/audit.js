(function () {
  var currentPage = 1;
  var currentAction = '';
  var totalPages = 1;

  document.addEventListener('DOMContentLoaded', function () {
    loadAuditLogs();
    initFilters();
  });

  function initFilters() {
    loadFilterOptions();
  }

  async function loadFilterOptions() {
    try {
      const data = await apiRequest('/audit?page=1&limit=1');
      var filters = data.data.filters;
      if (!filters) return;

      var container = getEl('auditFilters');
      if (!container) return;

      var html = '<select id="auditActionFilter"><option value="">All actions</option>';
      (filters.actions || []).forEach(function (a) {
        html += '<option value="' + escHtml(a) + '"' + (currentAction === a ? ' selected' : '') + '>' + escHtml(formatAction(a)) + '</option>';
      });
      html += '</select>';

      html += '<button class="btn btn-secondary" id="auditRefreshBtn" style="padding:0.4rem 1rem;font-size:0.85rem">Refresh</button>';

      container.innerHTML = html;

      var filterEl = getEl('auditActionFilter');
      if (filterEl) {
        filterEl.addEventListener('change', function () {
          currentAction = this.value;
          currentPage = 1;
          loadAuditLogs();
        });
      }

      var refreshBtn = getEl('auditRefreshBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function () { loadAuditLogs(); });
      }
    } catch (e) {}
  }

  async function loadAuditLogs() {
    var container = getEl('auditContent');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center;padding:3rem 0;color:var(--text-muted)">Loading audit log...</p>';

    try {
      var url = '/audit?page=' + currentPage + '&limit=50';
      if (currentAction) url += '&action=' + encodeURIComponent(currentAction);

      const data = await apiRequest(url);
      var result = data.data;
      var logs = result.logs || [];
      var pagination = result.pagination || {};

      totalPages = pagination.pages || 1;

      if (logs.length === 0) {
        container.innerHTML = '<div class="audit-empty">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted);margin-bottom:1rem">' +
            '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>' +
          '</svg>' +
          '<p>No audit log entries found.</p></div>';
        return;
      }

      var html = '<table class="audit-table">' +
        '<thead><tr><th>Action</th><th>Resource</th><th>Details</th><th>Date</th></tr></thead><tbody>';

      logs.forEach(function (log) {
        html += '<tr>' +
          '<td class="audit-action">' + escHtml(formatAction(log.action)) + '</td>' +
          '<td>' + escHtml(log.resource || '—') + (log.resourceId ? ' <span style="color:var(--text-muted);font-size:0.75rem">' + escHtml(truncateId(log.resourceId)) + '</span>' : '') + '</td>' +
          '<td class="audit-detail">' + escHtml(formatDetails(log.details)) + '</td>' +
          '<td class="audit-time">' + formatTime(log.createdAt) + '</td>' +
        '</tr>';
      });

      html += '</tbody></table>';

      if (totalPages > 1) {
        html += '<div class="audit-pagination">' +
          '<button class="btn btn-secondary" id="auditPrevBtn" style="padding:0.4rem 1rem;font-size:0.85rem"' + (currentPage <= 1 ? ' disabled' : '') + '>Previous</button>' +
          '<span class="page-info">Page ' + currentPage + ' of ' + totalPages + '</span>' +
          '<button class="btn btn-secondary" id="auditNextBtn" style="padding:0.4rem 1rem;font-size:0.85rem"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next</button>' +
        '</div>';
      }

      container.innerHTML = html;

      bindPagination();
    } catch (err) {
      container.innerHTML = '<div class="audit-empty"><p style="color:var(--error)">Failed to load audit log: ' + escHtml(err.message) + '</p></div>';
    }
  }

  function bindPagination() {
    var prevBtn = getEl('auditPrevBtn');
    var nextBtn = getEl('auditNextBtn');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (currentPage > 1) {
          currentPage--;
          loadAuditLogs();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentPage < totalPages) {
          currentPage++;
          loadAuditLogs();
        }
      });
    }
  }

  function formatAction(action) {
    if (!action) return '—';
    return action.replace(/\./g, ' · ').replace(/_/g, ' ');
  }

  function formatDetails(details) {
    if (!details) return '—';
    if (typeof details === 'string') return details;
    try {
      var str = JSON.stringify(details);
      if (str.length > 80) return str.substring(0, 80) + '...';
      return str;
    } catch (e) {
      return '—';
    }
  }

  function truncateId(id) {
    if (!id) return '';
    var str = String(id);
    if (str.length > 10) return str.substring(0, 8) + '...';
    return str;
  }

  function formatTime(dateStr) {
    if (!dateStr) return '—';
    try {
      var d = new Date(dateStr);
      var now = new Date();
      var diff = now - d;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '—';
    }
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
