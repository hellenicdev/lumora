(function () {
  let orgId = null;

  function getUserIdFromToken() {
    var token = getAccessToken();
    if (!token) return null;
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub || null;
    } catch { return null; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    orgId = params.get('id');

    const orgLoading = document.getElementById('orgLoading');
    if (!orgLoading) return;

    if (!orgId) {
      orgLoading.innerHTML = '<p style="color:var(--error)">No organization ID provided.</p>';
      return;
    }

    loadOrganization();

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.style.display = 'none'; });
        this.classList.add('active');
        const tabContent = document.getElementById('tab-' + this.dataset.tab);
        if (tabContent) tabContent.style.display = 'block';
      });
    });

    const inviteForm = document.getElementById('inviteForm');
    if (inviteForm) {
      inviteForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const inviteEmail = document.getElementById('inviteEmail');
        const inviteRole = document.getElementById('inviteRole');
        if (!inviteEmail || !inviteRole) return;
        const email = inviteEmail.value.trim();
        const role = inviteRole.value;

        try {
          await apiRequest('/organizations/' + orgId + '/invite', {
            method: 'POST',
            body: { email, role },
          });
          inviteEmail.value = '';
          showToast('Invitation sent!', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  });

  async function loadOrganization() {
    const orgLoading = document.getElementById('orgLoading');
    const orgContent = document.getElementById('orgContent');
    const orgName = document.getElementById('orgName');
    const orgIcon = document.getElementById('orgIcon');
    const orgPlan = document.getElementById('orgPlan');
    const orgMeta = document.getElementById('orgMeta');
    if (!orgLoading || !orgContent || !orgName || !orgIcon || !orgPlan || !orgMeta) return;

    try {
      const data = await apiRequest('/organizations/' + orgId);
      const org = data.data.organization;

      orgName.textContent = org.name;
      orgIcon.textContent = org.name.charAt(0).toUpperCase();
      orgPlan.textContent = org.plan || 'free';
      orgMeta.textContent = 'Created ' + new Date(org.createdAt).toLocaleDateString();

      orgLoading.style.display = 'none';
      orgContent.style.display = 'block';

      loadMembers(org.members || []);

      const currentUserId = getUserIdFromToken();
      const ownerId = org.ownerId ? (org.ownerId._id || org.ownerId).toString() : null;
      const isOwner = currentUserId && ownerId === currentUserId;
      const leaveBtn = document.getElementById('leaveOrgBtn');
      if (leaveBtn) {
        if (!isOwner) {
          leaveBtn.style.display = 'inline-flex';
          leaveBtn.onclick = async function () {
            if (!confirm('Are you sure you want to leave this organization?')) return;
            try {
              await apiRequest('/organizations/' + orgId + '/leave', { method: 'POST' });
              window.location.replace('/lumora/team.html?t=' + Date.now());
            } catch (err) {
              showToast(err.message, 'error');
            }
          };
        }
      }
    } catch (err) {
      orgLoading.innerHTML = '<p style="color:var(--error)">Failed to load organization: ' + err.message + '</p>';
    }
  }

  function loadMembers(members) {
    const el = document.getElementById('memberList');
    if (!el) return;
    if (members.length === 0) {
      el.innerHTML = '<div class="card" style="padding:40px;text-align:center"><p style="color:var(--text-muted)">No members yet.</p></div>';
      return;
    }

    el.innerHTML = members.map(function (m) {
      const user = m.user || {};
      const userId = user.id || m.userId;
      const userName = user.name || 'Unknown';
      const userEmail = user.email || '—';
      const isOwner = m.role === 'owner';
      return '<div class="member-row card">' +
        '<div class="member-avatar">' + userName.charAt(0).toUpperCase() + '</div>' +
        '<div class="member-info">' +
        '<div class="member-name">' + userName + '</div>' +
        '<div class="member-email">' + userEmail + '</div>' +
        '</div>' +
        '<span class="badge badge-' + (isOwner ? 'primary' : m.role === 'admin' ? 'warning' : 'default') + '">' + (m.role || 'member') + '</span>' +
        (!isOwner ? '<button class="btn btn-ghost" style="color:var(--error);padding:4px 8px;font-size:13px" data-user-id="' + userId + '">Remove</button>' : '') +
        '</div>';
    }).join('');

    el.querySelectorAll('[data-user-id]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Remove this member?')) return;
        try {
          await apiRequest('/organizations/' + orgId + '/member/' + this.dataset.userId, {
            method: 'DELETE',
          });
          loadOrganization();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }
})();
