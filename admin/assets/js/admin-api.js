/* global window, fetch */
/**
 * ARAMIOT admin API client.
 *
 * Calls the protected /api/admin/* endpoints from the admin UI.
 *
 * Rules (these are not arbitrary — they match the backend):
 *  - Reads are plain GET with credentials (the session cookie is sent automatically
 *    with credentials: 'include').
 *  - Writes (POST/PUT/DELETE) MUST be application/x-www-form-urlencoded with a
 *    body field named _csrf containing the current CSRF submit token, because the
 *    backend's csrf-csrf middleware reads req.body._csrf. JSON bodies are not accepted
 *    on write endpoints (the login route even parses urlencoded explicitly).
 *  - The CSRF submit token is read from the cookie named aramiot_admin_csrftoken,
 *    which is set by the backend on GET /admin/login and on GET /api/admin/auth/csrf-token.
 *  - Every request uses credentials: 'include' so the HTTP-only session cookie is
 *    sent automatically. The CSRF cookie is NOT httpOnly, so JS can read it.
 *
 * Env: ARAMIOT_ADMIN_CONFIG may be set by a page before this module loads. If not,
 * the client derives the admin API base from window.location.origin + '/api/admin'.
 */

(function (global) {
  'use strict';

  var config = (global.ARAMIOT_ADMIN_CONFIG || {});
  var BASE = String(config.API_BASE_URL || global.window.location.origin + '/api/admin')
    .replace(/\/+$/, '');
  var TIMEOUT = Number(config.REQUEST_TIMEOUT_MS || 15000);

  /** Read a non-httpOnly cookie by name. */
  function readCookie(name) {
    var cookie = '; ' + global.window.document.cookie;
    var idx = cookie.indexOf('; ' + name + '=');
    if (idx === -1) return null;
    var end = cookie.indexOf(';', idx + name.length + 3);
    var val = cookie.substring(idx + name.length + 3, end === -1 ? cookie.length : end);
    try { return decodeURIComponent(val); } catch (e) { return val; }
  }

  /** URL-search-params-like encoding for a flat object (no arrays). */
  function encodeForm(obj) {
    if (!obj) return '';
    var parts = [];
    var seen = Object.keys(obj);
    for (var i = 0; i < seen.length; i++) {
      var key = seen[i];
      var val = obj[key];
      if (val === undefined || val === null || val === '') continue;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
    }
    return parts.join('&');
  }

  /** Consistent error from an API response. */
  function toError(response, payload) {
    var message =
      (payload && payload.error && payload.error.message) ||
      ('The request failed with status ' + response.status + '.');
    var err = new Error(message);
    err.status = response.status;
    err.code = (payload && payload.error && payload.error.code) || 'HTTP_ERROR';
    err.details = (payload && payload.error && payload.error.details) || null;
    err.data = (payload && payload.data) || null;
    return err;
  }

  /**
   * Core request.
   * - GET requests are plain.
   * - Mutation requests are form-encoded with _csrf from the cookie.
   */
  function request(path, options) {
    options = options || {};
    var method = options.method || 'GET';
    var isMutation = /^(POST|PUT|DELETE|PATCH)$/i.test(method);
    var controller = global.window.AbortController
      ? new global.window.AbortController()
      : null;
    var timeoutId = controller ? global.window.setTimeout(function () {
      controller.abort();
    }, TIMEOUT) : null;

    var headers = {
      Accept: 'application/json',
    };

    var body = options.body;
    if (isMutation) {
      // CSRF: every mutating admin request must carry _csrf in the body.
      var csrf = config._csrf || readCookie('aramiot_admin_csrftoken');
      if (!csrf) {
        return Promise.reject(
          new Error(
            'The CSRF token is missing. Please reload the admin page and try again.'
          )
        );
      }
      var formBody = Object.assign({ _csrf: csrf }, options.form || {}, (body && typeof body === 'object') ? body : null);
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = encodeForm(formBody);
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      body = global.JSON.stringify(body);
    }

    var init = {
      method: method,
      headers: headers,
      credentials: 'include',
    };
    if (body) init.body = body;
    if (controller) init.signal = controller.signal;

    return global.fetch(BASE + path, init)
      .then(function (response) {
        return response.json().catch(function () { return null; }).then(function (payload) {
          if (!response.ok || !payload || payload.success === false) {
            throw toError(response, payload);
          }
          return payload;
        });
      })
      .catch(function (error) {
        if (!error.status) {
          error.code = error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
          error.message =
            error.code === 'TIMEOUT'
              ? 'The ARAMIOT admin API took too long to respond. Please try again.'
              : 'Could not reach the ARAMIOT admin API. Check your connection and try again.';
        }
        throw error;
      })
      .finally(function () {
        if (timeoutId) global.window.clearTimeout(timeoutId);
      });
  }

  /**
   * Thin helpers.
   * List endpoints accept query params (will be serialized; leave out empty values).
   */
  function list(path, params) {
    if (!params) return request(path);
    var q = new global.URLSearchParams();
    var keys = Object.keys(params);
    for (var i = 0; i < keys.length; i++) {
      var v = params[keys[i]];
      if (v === undefined || v === null || v === '') continue;
      q.append(keys[i], String(v));
    }
    var qs = q.toString();
    return request(path + (qs ? '?' + qs : ''));
  }

  var client = {
    baseUrl: BASE,

    /** Fetch the CSRF submit token (sets the cookie). Call once on page load. */
    refreshCsrf: function () {
      return request('/auth/csrf-token', { method: 'GET' }).then(function (res) {
        return res.data.csrfToken;
      });
    },

    /** Current auth state. */
    session: function () {
      return request('/auth/session', { method: 'GET' });
    },

    // ---- auth ----
    login: function (username, password) {
      return request('/auth/login', {
        method: 'POST',
        form: { username: username, password: password },
      });
    },
    logout: function () {
      return request('/auth/logout', { method: 'POST' });
    },

    // ---- dashboard ----
    dashboard: function () {
      return request('/dashboard', { method: 'GET' });
    },

    // ---- organization / website settings ----
    organization: function () {
      return request('/organization', { method: 'GET' });
    },
    updateOrganization: function (data) {
      return request('/organization', { method: 'PUT', body: data });
    },
    websiteSettings: function () {
      return request('/website-settings', { method: 'GET' });
    },
    updateWebsiteSettings: function (data) {
      return request('/website-settings', { method: 'PUT', body: data });
    },

    // ---- content: generic list/detail CRUD for any model section ----

    /** List a content collection. section = 'pages' | 'articles' | ... */
    list: function (section, params) {
      return list('/' + section, params);
    },

    /** Get one by id. */
    getById: function (section, id) {
      return request('/' + section + '/id/' + encodeURIComponent(String(id)), { method: 'GET' });
    },

    /** Get one by slug. */
    getBySlug: function (section, slug) {
      return request('/' + section + '/slug/' + encodeURIComponent(String(slug)), { method: 'GET' });
    },

    /** Create. data is the model fields (title/slug/etc. — backend allow-lists them). */
    create: function (section, data) {
      return request('/' + section, { method: 'POST', body: data });
    },

    /** Update by id. */
    update: function (section, id, data) {
      return request('/' + section + '/' + encodeURIComponent(String(id)), { method: 'PUT', body: data });
    },

    /** Delete (archive for content, hard delete for inbox items). */
    remove: function (section, id) {
      return request('/' + section + '/' + encodeURIComponent(String(id)), { method: 'DELETE' });
    },

    // ---- inbox ----
    messages: function (params) {
      return list('/messages', params);
    },
    updateMessage: function (id, status) {
      return request('/messages/' + encodeURIComponent(String(id)), {
        method: 'PUT',
        form: { status: status },
      });
    },
    applications: function (params) {
      return list('/applications', params);
    },
    updateApplication: function (id, status) {
      return request('/applications/' + encodeURIComponent(String(id)), {
        method: 'PUT',
        form: { status: status },
      });
    },
    inquiries: function (params) {
      return list('/inquiries', params);
    },
    updateInquiry: function (id, status) {
      return request('/inquiries/' + encodeURIComponent(String(id)), {
        method: 'PUT',
        form: { status: status },
      });
    },

    // ---- account ----
    account: function () {
      return request('/account', { method: 'GET' });
    },
    updateAccount: function (data) {
      return request('/account', { method: 'PUT', body: data });
    },
    changePassword: function (currentPassword, newPassword) {
      return request('/account/password', {
        method: 'POST',
        form: { currentPassword: currentPassword, newPassword: newPassword },
      });
    },

    // ---- media (Drive-ready, Phase 2 placeholder) ----
    mediaUpload: function (options) {
      return request('/media/upload', {
        method: 'POST',
        body: options,
      });
    },
  };

  global.ARAMIOT_ADMIN = global.ARAMIOT_ADMIN || {};
  global.ARAMIOT_ADMIN.api = client;
})(typeof window !== 'undefined' ? window : this);
