(function () {
  var integrations = [];

  document.addEventListener('DOMContentLoaded', function () {
    loadIntegrations();

    var addBtn = getEl('addIntegrationBtn');
    if (addBtn) addBtn.addEventListener('click', showAddModal);
  });

  async function loadIntegrations() {
    var container = getEl('integrationsList');
    if (!container) return;

    try {
      const data = await apiRequest('/integrations');
      integrations = data.data.integrations || [];
      renderIntegrations();
    } catch (err) {
      container.innerHTML = '<p style="text-align:center;padding:3rem 0;color:var(--error)">Failed to load integrations: ' + escHtml(err.message) + '</p>';
    }
  }

  function renderIntegrations() {
    var container = getEl('integrationsList');
    if (!container) return;

    if (integrations.length === 0) {
      container.innerHTML =
        '<div class="integrations-empty">' +
          '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">' +
            '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
            '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
          '</svg>' +
          '<h3>No integrations configured</h3>' +
          '<p>Connect Slack or a webhook URL to receive real-time notifications for security alerts, documentation updates, and more.</p>' +
          '<button class="btn btn-primary" onclick="' + 'showAddModal()' + '">Add your first integration</button>' +
        '</div>';
      return;
    }

    var html = '';
    integrations.forEach(function (integration) {
      var typeIcon = integration.type === 'slack' ? '#' : integration.type === 'webhook' ? '🔗' : '✉';
      var statusColor = integration.active ? 'var(--color-success)' : 'var(--text-muted)';
      var statusText = integration.active ? 'Active' : 'Disabled';

      html += '<div class="integration-card">' +
        '<div class="info">' +
          '<h3>' + typeIcon + ' ' + escHtml(integration.name) + '</h3>' +
          '<p>' + escHtml(formatConfig(integration)) + '</p>' +
          '<div class="events">' +
            (integration.events || []).map(function (e) { return '<span>' + escHtml(formatEvent(e)) + '</span>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<span style="font-size:0.8rem;color:' + statusColor + '">● ' + statusText + '</span>' +
          '<button class="btn btn-ghost integration-test-btn" data-id="' + integration._id + '" style="font-size:0.85rem;padding:0.3rem 0.7rem">Test</button>' +
          '<button class="btn btn-ghost integration-delete-btn" data-id="' + integration._id + '" style="font-size:0.85rem;padding:0.3rem 0.7rem;color:var(--color-danger)">Delete</button>' +
        '</div>' +
      '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.integration-test-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { testIntegration(this.dataset.id); });
    });
    container.querySelectorAll('.integration-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteIntegration(this.dataset.id); });
    });
  }

  function showAddModal() {
    var modalContainer = getEl('integrationModal');
    if (!modalContainer) return;

    modalContainer.innerHTML =
      '<div class="integration-modal-overlay" id="modalOverlay">' +
        '<div class="integration-modal">' +
          '<h2>Add Integration</h2>' +
          '<div class="form-group">' +
            '<label>Type</label>' +
            '<select id="integrationType" class="input">' +
              '<option value="slack">Slack Webhook</option>' +
              '<option value="webhook">Generic Webhook</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Name</label>' +
            '<input type="text" id="integrationName" class="input" placeholder="My Slack channel">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Webhook URL</label>' +
            '<input type="url" id="integrationUrl" class="input" placeholder="https://hooks.slack.com/services/...">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Channel (optional, Slack only)</label>' +
            '<input type="text" id="integrationChannel" class="input" placeholder="#general">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Events</label>' +
            '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.35rem">' +
              '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="security_alert" checked> Security alerts</label>' +
              '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="doc_generated"> Doc generated</label>' +
              '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="scan_completed"> Scan completed</label>' +
              '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="import_completed"> Import completed</label>' +
            '</div>' +
          '</div>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-secondary" id="cancelIntegrationBtn">Cancel</button>' +
            '<button class="btn btn-primary" id="saveIntegrationBtn">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    modalContainer.style.display = '';

    getEl('cancelIntegrationBtn').addEventListener('click', closeModal);
    getEl('modalOverlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    getEl('saveIntegrationBtn').addEventListener('click', saveIntegration);
  }

  async function saveIntegration() {
    var type = getEl('integrationType').value;
    var name = getEl('integrationName').value.trim();
    var url = getEl('integrationUrl').value.trim();
    var channel = getEl('integrationChannel').value.trim();

    if (!name) { alert('Name is required'); return; }
    if (!url) { alert('Webhook URL is required'); return; }

    var eventCheckboxes = document.querySelectorAll('#integrationModal input[type=checkbox]:checked');
    var events = Array.from(eventCheckboxes).map(function (cb) { return cb.value; });
    if (events.length === 0) events = ['security_alert'];

    var btn = getEl('saveIntegrationBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const data = await apiRequest('/integrations', {
        method: 'POST',
        body: { type, name, url, channel, events },
      });
      integrations.push(data.data.integration);
      closeModal();
      renderIntegrations();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  async function testIntegration(id) {
    var btn = document.querySelector('.integration-test-btn[data-id="' + id + '"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Testing...';
    }

    try {
      const data = await apiRequest('/integrations/' + id + '/test', { method: 'POST' });
      if (data.data.success) {
        alert('Test successful! Check your Slack/webhook.');
      } else {
        alert('Test failed: ' + (data.data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Test error: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Test';
      }
    }
  }

  async function deleteIntegration(id) {
    if (!confirm('Delete this integration?')) return;

    try {
      await apiRequest('/integrations/' + id, { method: 'DELETE' });
      integrations = integrations.filter(function (i) { return i._id !== id; });
      renderIntegrations();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  function closeModal() {
    var modalContainer = getEl('integrationModal');
    if (modalContainer) modalContainer.style.display = 'none';
  }

  function formatConfig(integration) {
    if (integration.type === 'slack') {
      return 'Slack' + (integration.config.channel ? ' → ' + integration.config.channel : '');
    }
    if (integration.type === 'webhook') {
      var url = integration.config.url || '';
      return 'Webhook' + (url ? ' → ' + url.substring(0, 40) + '...' : '');
    }
    return integration.type;
  }

  function formatEvent(event) {
    return event.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
  }

  function escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function getEl(id) {
    return document.getElementById(id);
  }
})();
