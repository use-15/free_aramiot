/* global window, document */
/**
 * ARAMIOT admin topbar module.
 *
 * Every admin page includes this after admin-api.js. It fills the shared topbar
 * with the signed-in state so each page offers the same controls:
 *
 *   - the signed-in account (role + username)
 *   - "View site"  -> opens the public website in a new tab
 *   - "Account"    -> /admin/account.html (profile email, status, password)
 *   - "Sign out"   -> POST /api/admin/auth/logout, then back to /admin/login
 *
 * Before this module existed only dashboard.html rendered a user area, so on the
 * other sixteen pages a signed-in admin had no way to reach account settings or
 * log out, and account.html was linked from nowhere.
 *
 * It also marks the current section in the topbar nav.
 *
 * Behaviour when the session is not valid: the admin API answers 401, and the
 * page redirects to /admin/login (the page itself is already gated server-side,
 * this just avoids showing an empty shell to a session that expired).
 */

(function (global) {
  'use strict';

  var win = global.window;
  var doc = win.document;
  var ADMIN = global.ARAMIOT_ADMIN || {};
  var api = ADMIN.api;

  function $(id) {
    return doc.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function roleLabel(role) {
    return String(role || 'admin').replace(/_/g, ' ');
  }

  function goToLogin() {
    win.location.href = '/admin/login';
  }

  /** Mark the nav entry for the page currently open. */
  function highlightNav() {
    var links = doc.querySelectorAll('.admin-topbar-nav .nav-link');
    var path = win.location.pathname.replace(/\/+$/, '');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (!href) continue;
      var normalized = href.replace(/\/+$/, '');
      if (normalized === path) {
        links[i].classList.add('active');
        links[i].setAttribute('aria-current', 'page');
      } else {
        links[i].classList.remove('active');
        links[i].removeAttribute('aria-current');
      }
    }
  }

  function signOut() {
    var done = function () {
      goToLogin();
    };
    if (!api || !api.logout) {
      done();
      return;
    }
    if (!win.confirm('Sign out of the ARAMIOT admin dashboard?')) return;
    api.logout().then(done).catch(done);
  }

  /** Replace the loading/signed-out placeholder with the real account controls. */
  function render(user) {
    var slot = $('topbar-user');
    if (!slot) return;

    slot.innerHTML =
      '<span class="role-pill">' + escapeHtml(roleLabel(user && user.role)) + '</span>' +
      (user && user.username
        ? '<span class="admin-topbar-username">' + escapeHtml(user.username) + '</span>'
        : '') +
      '<a class="btn-admin btn-admin--secondary" href="/" target="_blank" rel="noopener">View site</a>' +
      '<a class="btn-admin btn-admin--secondary" href="/admin/account.html">Account</a>' +
      '<button class="btn-admin btn-admin--ghost" id="logout-btn" type="button">Sign out</button>';

    var logoutBtn = $('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', signOut);
  }

  function init() {
    highlightNav();

    if (!api) return;

    api
      .session()
      .then(function (res) {
        var data = (res && res.data) || {};
        if (!data.authenticated) {
          goToLogin();
          return null;
        }
        // The session response carries the role; the account call adds the
        // username shown next to it. If that second call fails we still render
        // the controls with the role only.
        return api
          .account()
          .then(function (accountRes) {
            render(Object.assign({}, data, (accountRes && accountRes.data) || {}));
          })
          .catch(function () {
            render(data);
          });
      })
      .catch(function (error) {
        if (error && error.status === 401) {
          goToLogin();
          return;
        }
        // Any other failure: keep the page usable but say what happened.
        render(null);
      });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  ADMIN.topbar = { init: init, signOut: signOut };
  global.ARAMIOT_ADMIN = ADMIN;
})(typeof window !== 'undefined' ? window : this);
