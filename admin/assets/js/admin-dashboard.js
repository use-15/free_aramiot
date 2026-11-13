/* global window, document */
/**
 * ARAMIOT admin dashboard page script.
 *
 * On load:
 *  - refreshes the CSRF token (sets the CSRF cookie),
 *  - checks the session; if not authenticated, redirects to /admin/login,
 *  - otherwise renders the summary, inbox and content-status tiles from /api/admin/dashboard.
 */

(function (global) {
  'use strict';

  var win = global.window;
  var doc = win.document;
  var ARAMIOT = global.ARAMIOT_ADMIN || {};
  var api = ARAMIOT.api;

  function $(id) {
    return doc.getElementById(id);
  }

  function showAlert(message, kind) {
    var alertEl = $('page-alert');
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.className = 'admin-alert admin-alert--' + (kind || 'error') + ' admin-hide';
    // remove the hidden class after setting text so the transition shows
    alertEl.classList.remove('admin-hide');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pillHtml(status) {
    var cls = 'pill';
    if (status == null) return '<span class="pill pill--draft">unknown</span>';
    var key = String(status).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    // Map known statuses to classes.
    var map = {
      draft: 'pill--draft',
      published: 'pill--published',
      archived: 'pill--archived',
      new: 'pill--new',
      read: 'pill--read',
      replied: 'pill--replied',
      reviewing: 'pill--reviewing',
      accepted: 'pill--accepted',
      declined: 'pill--declined',
      responded: 'pill--responded',
      closed: 'pill--closed',
    };
    var clsName = map[key] || 'pill--draft';
    return '<span class="pill ' + clsName + '">' + escapeHtml(status) + '</span>';
  }

  function summaryTile(label, value, sub, cls) {
    var tile = doc.createElement('div');
    tile.className = 'summary-tile' + (cls ? ' ' + cls : '');
    tile.innerHTML =
      '<div class="label">' + escapeHtml(label) + '</div>' +
      '<div class="value">' + escapeHtml(String(value)) + '</div>' +
      (sub ? '<div class="sub">' + escapeHtml(String(sub)) + '</div>' : '');
    return tile;
  }

  function renderSummary(data) {
    var grid = $('summary-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var s = data.data.summary;
    grid.appendChild(
      summaryTile('Published articles', s.publishedArticles, 'drafts: ' + s.draftArticles, 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Published pages', s.publishedPages, '', 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Projects', s.publishedProjects, 'drafts: ' + s.draftProjects, 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Programs', s.publishedPrograms, 'drafts: ' + s.draftPrograms, 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Publications', s.publishedPublications, 'drafts: ' + s.draftPublications, 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Resources', s.publishedResources, 'drafts: ' + s.draftResources, 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Team members', s.publishedTeam, 'drafts: ' + s.draftTeam, 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Impact stats', s.publishedImpactStats, '', 'summary-tile--primary')
    );
    grid.appendChild(
      summaryTile('Unread messages', s.unreadMessages, 'inbox', 'summary-tile--accent')
    );
    grid.appendChild(
      summaryTile('Pending applications', s.pendingApplications, 'inbox', 'summary-tile--accent')
    );
    grid.appendChild(
      summaryTile('Pending inquiries', s.pendingInquiries, 'inbox', 'summary-tile--accent')
    );
  }

  function renderInbox(data) {
    var grid = $('inbox-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var s = data.data.summary;
    grid.appendChild(
      summaryTile('New messages', data.data.summary.unreadMessages, 'contact form submissions', 'summary-tile--accent')
    );
    grid.appendChild(
      summaryTile('Pending applications', s.pendingApplications, 'volunteer applications', 'summary-tile--accent')
    );
    grid.appendChild(
      summaryTile('Pending inquiries', s.pendingInquiries, 'partnership inquiries', 'summary-tile--accent')
    );
  }

  function renderContentStatus(data) {
    var tbody = $('content-status-body');
    if (!tbody) return;
    var s = data.data.summary;
    var rows = [
      ['Pages', s.publishedPages, s.draftPages],
      ['Articles', s.publishedArticles, s.draftArticles],
      ['Projects', s.publishedProjects, s.draftProjects],
      ['Programs', s.publishedPrograms, s.draftPrograms],
      ['Publications', s.publishedPublications, s.draftPublications],
      ['Resources', s.publishedResources, s.draftResources],
      ['Team', s.publishedTeam, s.draftTeam],
    ];
    // Published count only (drafts are editor state, not published).
    tbody.innerHTML = rows
      .map(function (r) {
        return '<tr>' +
          '<td>' + escapeHtml(r[0]) + '</td>' +
          '<td>' + escapeHtml(String(r[1])) + '</td>' +
          '<td>' + escapeHtml(String(r[2])) + '</td>' +
          '<td class="actions"><a class="btn-admin btn-admin--secondary" href="/admin/' +
            r[0].toLowerCase() + '.html">Manage</a></td>' +
          '</tr>';
      })
      .join('');
  }

  /**
   * Dashboard-only chrome: environment badge and footer version.
   *
   * The account, "View site" and "Sign out" controls used to be built here,
   * which meant only this page had them. They are now rendered by
   * admin-topbar.js, which every admin page loads.
   */
  function renderUser(data) {
    var env = $('dashboard-env');
    var version = $('footer-version');

    if (env) env.textContent = data.data.server ? data.data.server.environment : '';
    if (version && data.data.server && data.data.server.version) {
      version.textContent = 'v' + escapeHtml(data.data.server.version);
    }
  }

  function setLoading(show) {
    var loading = $('dashboard-loading');
    var section = $('dashboard-section');
    if (!loading || !section) return;
    if (show) {
      loading.classList.remove('admin-hide');
      section.classList.add('admin-hide');
    } else {
      loading.classList.add('admin-hide');
      section.classList.remove('admin-hide');
    }
  }

  function handleError(err) {
    var message =
      (err && err.message) ||
      'The dashboard could not be loaded. Please refresh and try again.';
    showAlert(message, 'error');
    setLoading(false);
  }

  function init() {
    if (!api) {
      showAlert('The admin API client failed to load. Please refresh the page.', 'error');
      return;
    }

    var loading = $('dashboard-loading');
    if (!loading) return;

    // Step 1: refresh the CSRF token so writes will work.
    api
      .refreshCsrf()
      .then(function () {
        // Step 2: check session — redirect to login if not authenticated.
        return api.session();
      })
      .then(function (session) {
        if (!session || session.data.authenticated !== true) {
          win.location.href = '/admin/login';
          return;
        }
        // Step 3: fetch dashboard data and render.
        return api.dashboard();
      })
      .then(function (data) {
        setLoading(false);
        renderSummary(data);
        renderInbox(data);
        renderContentStatus(data);
        renderUser(data);
      })
      .catch(function (err) {
        // If the session check returned 401, redirect to login rather than
        // showing a confusing error.
        if (err && err.status === 401) {
          win.location.href = '/admin/login';
          return;
        }
        handleError(err);
      });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
