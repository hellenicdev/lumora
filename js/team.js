(function () {
  document.addEventListener('DOMContentLoaded', function () {
    loadOrganizations();
    loadInvitations();

    const createOrgBtn = document.getElementById('createOrgBtn');
    const createOrgModal = document.getElementById('createOrgModal');

    if (createOrgBtn && createOrgModal) {
      createOrgBtn.addEventListener('click', function () {
        createOrgModal.classList.add('open');
      });

      createOrgModal.addEventListener('click', function (e) {
        if (e.target === createOrgModal) {
          createOrgModal.classList.remove('open');
        }
      });

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = 'position:absolute;top:12px;right:16px;background:none;border:none;color:var(--text-secondary);font-size:24px;cursor:pointer;padding:4px;line-height:1';
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', function () {
        createOrgModal.classList.remove('open');
      });
      const modalContent = createOrgModal.querySelector('.import-modal');
      if (modalContent) {
        modalContent.style.position = 'relative';
        modalContent.appendChild(closeBtn);
      }
    }

    const createOrgForm = document.getElementById('createOrgForm');
    if (createOrgForm) {
      createOrgForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const orgNameInput = document.getElementById('orgName');
        if (!orgNameInput) return;
        const name = orgNameInput.value.trim();
        if (!name) return;

        try {
          await apiRequest('/organizations', {
            method: 'POST',
            body: { name },
          });
          const modal = document.getElementById('createOrgModal');
          if (modal) modal.classList.remove('open');
          orgNameInput.value = '';
          loadOrganizations();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  });

  async function loadOrganizations() {
    const el = document.getElementById('orgList');
    if (!el) return;
    try {
      const data = await apiRequest('/organizations');
      const orgs = data.data.organizations || [];

      if (orgs.length === 0) {
        el.innerHTML = '<div class="card" style="padding:60px;text-align:center"><p style="color:var(--text-muted)">No organizations yet. Create one to collaborate with your team.</p></div>';
        return;
      }

      el.innerHTML = orgs.map(function (org) {
        const memberCount = org.members ? org.members.length : 1;
        return '<a href="/lumora/organization.html?id=' + org._id + '" class="org-card card" style="margin-bottom:12px;display:flex">' +
          '<div class="org-icon">' + org.name.charAt(0).toUpperCase() + '</div>' +
          '<div><div style="font-size:16px;font-weight:600">' + org.name + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + memberCount + ' member(s) · ' + (org.role || 'member') + '</div></div>' +
          '<span class="badge badge-primary" style="margin-left:auto">' + (org.plan || 'free') + '</span></a>';
      }).join('');
    } catch (err) {
      el.innerHTML = '<p style="color:var(--error)">Failed to load organizations.</p>';
    }
  }

  async function loadInvitations() {
    const section = document.getElementById('invitationsSection');
    const list = document.getElementById('invitationsList');
    if (!section || !list) return;

    try {
      const data = await apiRequest('/organizations/invitations');
      const invitations = data.data.invitations || [];

      if (invitations.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      list.innerHTML = invitations.map(function (inv) {
        return '<div class="card" style="padding:16px;display:flex;align-items:center;gap:16px;margin-bottom:8px">' +
          '<div style="flex:1">' +
          '<div style="font-size:15px;font-weight:600">' + escapeHtml(inv.organizationName) + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">Role: ' + inv.role + ' · Invited ' + new Date(inv.invitedAt).toLocaleDateString() + '</div>' +
          '</div>' +
          '<button class="btn btn-primary accept-invite" data-org-id="' + inv.organizationId + '" style="padding:8px 16px;font-size:13px">Accept</button>' +
          '<button class="btn btn-ghost reject-invite" data-org-id="' + inv.organizationId + '" style="padding:8px 16px;font-size:13px;color:var(--error)">Decline</button>' +
          '</div>';
      }).join('');

      list.querySelectorAll('.accept-invite').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const orgId = this.dataset.orgId;
          try {
            await apiRequest('/organizations/' + orgId + '/accept', { method: 'POST' });
            showToast('Invitation accepted!', 'success');
            loadInvitations();
            loadOrganizations();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

      list.querySelectorAll('.reject-invite').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const orgId = this.dataset.orgId;
          try {
            await apiRequest('/organizations/' + orgId + '/reject', { method: 'POST' });
            showToast('Invitation declined', 'success');
            loadInvitations();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      section.style.display = 'none';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();