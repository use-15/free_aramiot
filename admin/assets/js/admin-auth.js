/* global window, document */
/**
 * ARAMIOT admin login client.
 *
 * Loaded by the server-rendered /admin/login page (and /api/admin/auth/login).
 * The form already contains a hidden _csrf field set by the backend. This module
 * submits the form as application/x-www-form-urlencoded (matching the backend's
 * express.urlencoded() login route) with credentials: 'include' so the session
 * cookie is set.
 */

(function (global) {
  'use strict';

  var win = global.window;
  var doc = win.document;

  function $(id) {
    return doc.getElementById(id);
  }

  function showAlert(message, kind) {
    var alertEl = $('auth-alert');
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.hidden = false;
    alertEl.className = 'admin-alert admin-alert--' + (kind || 'error');
  }

  function clearAlert() {
    var alertEl = $('auth-alert');
    if (!alertEl) return;
    alertEl.hidden = true;
    alertEl.textContent = '';
  }

  function isFormValid() {
    var username = $('admin-username');
    var password = $('admin-password');
    if (!username || !password) return false;
    var u = String(username.value || '').trim();
    var p = String(password.value || '');
    if (!u || !p) return false;
    return true;
  }

  function submitLogin() {
    clearAlert();

    if (!isFormValid()) {
      showAlert('Please enter your username and password.', 'error');
      return;
    }

    var username = $('admin-username');
    var password = $('admin-password');
    var submit = $('login-submit');
    var form = $('login-form');

    var csrfField = form ? form.querySelector('input[name="_csrf"]') : null;
    var csrf = csrfField ? csrfField.value : '';

    if (!csrf) {
      showAlert('Your session has expired. Please reload the page and try again.', 'error');
      return;
    }

    var formData = new global.FormData(form);
    // Ensure _csrf is present and the body is urlencoded (the backend reads req.body._csrf).
    formData.set('_csrf', csrf);

    // Disable the button during the request.
    if (submit) {
      submit.disabled = true;
      var originalText = submit.textContent;
      submit.textContent = 'Signing in…';
    }

    var xhr = new global.XMLHttpRequest();
    xhr.open('POST', '/api/admin/auth/login', true);
    xhr.setRequestHeader('Accept', 'application/json');
    // The CSRF cookie is already set on the GET /login page; the browser sends it
    // automatically with credentials. We send the form urlencoded with _csrf.
    xhr.withCredentials = true;
    xhr.timeout = 15000;

    xhr.onload = function () {
      var payload = null;
      try { payload = global.JSON.parse(xhr.responseText); } catch (e) { payload = null; }

      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText;
      }

      if (xhr.status === 200 && payload && payload.success === true) {
        // Signed in — redirect to the dashboard.
        win.location.href = '/admin';
        return;
      }

      var message =
        (payload && payload.error && payload.error.message) ||
        'Sign in failed. Please check your credentials and try again.';
      var kind = (xhr.status === 401) ? 'error' : 'error';
      showAlert(message, kind);
    };

    xhr.onerror = function () {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText;
      }
      showAlert('Could not reach the admin server. Check your connection and try again.', 'error');
    };

    xhr.ontimeout = function () {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText;
      }
      showAlert('The sign-in request timed out. Please try again.', 'error');
    };

    xhr.send(new global.URLSearchParams(formData).toString());
  }

  function init() {
    var form = $('login-form');
    if (!form) return;

    // Allow Enter in the password field to submit.
    var password = $('admin-password');
    if (password) {
      password.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitLogin();
        }
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitLogin();
    });
  }

  if (typeof doc !== 'undefined' && doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
