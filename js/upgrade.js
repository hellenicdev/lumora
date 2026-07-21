(function () {
  document.addEventListener('DOMContentLoaded', function () {
    loadPlans();
  });

  async function loadPlans() {
    var grid = document.getElementById('pricingGrid');
    if (!grid) return;

    try {
      var data = await apiRequest('/billing/plans');
      var plans = data.data.plans || [];
      var user = await getCurrentUser();
      var currentRole = user ? user.role : 'guest';

      grid.innerHTML = plans.map(function (plan, i) {
        var isCurrent = roleToPlan(currentRole) === plan.id;
        var isPopular = plan.popular;
        var hasKoFi = plan.kofiUrl && plan.kofiUrl.indexOf('ko-fi.com') > -1;

        var html = '';
        html += '<div class="pricing-card card' + (isPopular ? ' pricing-featured' : '') + '" style="padding:32px;display:flex;flex-direction:column;position:relative;animation:fadeIn 0.4s ease forwards;animation-delay:' + (i * 0.1) + 's;opacity:0">';

        if (isPopular) html += '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--primary);color:#fff;padding:4px 16px;border-radius:100px;font-size:13px;font-weight:600">Most Popular</div>';

        html += '<h3 style="font-size:20px;margin-bottom:4px">' + plan.name + '</h3>';

        if (plan.price === 0) {
          html += '<div style="font-size:40px;font-weight:700;margin:16px 0 8px">Free</div>';
        } else {
          html += '<div style="font-size:40px;font-weight:700;margin:16px 0 8px">$' + plan.price + '<span style="font-size:16px;font-weight:400;color:var(--text-muted)">/mo</span></div>';
        }

        html += '<ul style="list-style:none;padding:0;margin:16px 0 24px;flex:1;display:flex;flex-direction:column;gap:10px">';
        (plan.features || []).forEach(function (f) {
          html += '<li style="display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-secondary)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' + f + '</li>';
        });
        html += '</ul>';

        if (isCurrent) {
          html += '<button class="btn btn-secondary" disabled style="width:100%;opacity:0.6">Current plan</button>';
        } else if (plan.price === 0) {
          html += '<a href="/dashboard.html" class="btn btn-secondary" style="width:100%;text-align:center;text-decoration:none">Get Started</a>';
        } else if (!hasKoFi) {
          html += '<button class="btn btn-primary" style="width:100%" disabled>Coming soon</button>';
        } else {
          html += '<a href="' + plan.kofiUrl + '" target="_blank" class="btn btn-primary" style="width:100%;text-align:center;text-decoration:none">Subscribe on Ko-fi</a>';
        }

        html += '</div>';
        return html;
      }).join('\n');
    } catch (err) {
      grid.innerHTML = '<div class="card" style="grid-column:1/-1;padding:60px;text-align:center"><p style="color:var(--text-secondary)">Could not load plans. ' + (err.message || '') + '</p></div>';
    }
  }

  async function getCurrentUser() {
    try {
      var data = await apiRequest('/auth/me');
      return data.data.user;
    } catch {
      return null;
    }
  }

  function roleToPlan(role) {
    if (role === 'pro') return 'pro';
    if (role === 'team_admin') return 'team';
    return 'free';
  }
})();
