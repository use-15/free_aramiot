'use strict';

/**
 * Admin authentication endpoints.
 *
 * These live at /api/admin/auth/* and are mounted BEFORE the admin CRUD router so
 * login/logout/csrf/init are reachable without a session, while every mutation
 * route behind the admin CRUD router is protected.
 *
 *  GET  /api/admin/auth/csrf-token  -> JSON { csrfToken } for the admin JS client.
 *  GET  /api/admin/auth/session      -> JSON current auth state (authenticated + admin id).
 *  POST /api/admin/auth/login        -> validate username + password, set session cookie.
 *  POST /api/admin/auth/logout       -> clear session cookie (idempotent).
 *  POST /api/admin/auth/init         -> CLI-only path to create the first Super Admin.
 */

const express = require('express');
const Admin = require('../models/Admin');
const {
  loginLimiter,
  csrfTokenFactory,
  csrfMiddleware,
  hashPassword,
  verifyPassword,
  mintSession,
  setSessionCookie,
  clearSessionCookie,
  sessionCookieOptions,
} = require('../utils/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

const router = express.Router();

// Public (no session) endpoints -- but login and init are rate-limited.
router.use(loginLimiter);

// ---- CSRF token (used by the admin JS client on mutation requests) --------

router.get('/csrf-token', (req, res) => {
  try {
    const token = csrfTokenFactory()(req, res);
    res.json({ csrfToken: token });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Could not generate a CSRF token. Please reload the page.' },
    });
  }
});

// ---- Current session state (so the admin UI can decide whether to show login) -

router.get('/session', asyncHandler(async (req, res) => {
  const state = require('../middleware/adminAuth').getAuthState(req);
  return res.json({
    success: true,
    data: {
      authenticated: state.authenticated,
      adminId: state.adminId || null,
      role: state.role || null,
    },
  });
}));

// ---- Login page HTML (server-rendered so we can embed the csrf token) ----

router.get('/login', (_req, res) => {
  const token = csrfTokenFactory()(_req, res);
  const host = req.headers.host || config.siteUrl.replace(/https?:\/\//, '');
  res.type('html').send(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ARAMIOT Admin — Sign in</title>
  <meta name="robots" content="noindex,nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="/admin/assets/css/admin.css">
</head>
<body>
  <div class="admin-auth-shell">
    <div class="admin-auth-card" role="main" aria-labelledby="auth-title">
      <div class="admin-auth-brand">
        <span class="admin-brand-mark" aria-hidden="true">A</span>
        <span class="admin-brand-text">
          <span class="admin-brand-name">ARAMIOT Admin</span>
          <span class="admin-brand-kicker">Super Admin</span>
        </span>
      </div>
      <h1 id="auth-title" class="admin-auth-title">Sign in to the dashboard</h1>
      <p class="admin-auth-sub">Use your Super Admin credentials to continue.</p>

      <div class="admin-auth-alert" id="auth-alert" hidden></div>

      <form id="login-form" novalidate>
        <input type="hidden" name="_csrf" value="${token}">

        <div class="field">
          <label for="admin-username">Username or email</label>
          <input
            id="admin-username"
            name="username"
            type="text"
            autocomplete="username"
            required
            placeholder="username or email"
            inputmode="text"
            aria-describedby="username-hint"
          >
          <small id="username-hint" class="field-hint">Your Super Admin username or email address.</small>
        </div>

        <div class="field">
          <label for="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="••••••••"
          >
        </div>

        <div class="field">
          <button type="submit" class="button button--primary button--block" id="login-submit">
            Sign in
          </button>
        </div>
      </form>

      <p class="admin-auth-foot">
        If you cannot sign in, contact the system owner. Administrator accounts are
        created only through the secure setup script.
      </p>
    </div>
  </div>

  <script src="/admin/assets/js/admin-auth.js" defer></script>
</body>
</html>`
  );
});

// ---- Login POST -----------------------------------------------------------

router.post(
  '/login',
  express.urlencoded({ extended: false, limit: '20kb' }),
  csrfMiddleware(), // validates _csrf against the cookie set on the GET /login page
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Username or email is required' },
      });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Password is required' },
      });
    }

    // Accept either the username or the account email address as the identifier.
    const identifier = username.trim().toLowerCase();
    const admin = await Admin.findOne({ $or: [{ username: identifier }, { email: identifier }] })
      .select('+passwordHash')
      .exec();
    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      // Unified message to avoid username enumeration via timing/responses.
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid username/email or password' },
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'This administrator account is disabled' },
      });
    }

    const token = mintSession(admin);
    setSessionCookie(res, token);

    // Update lastLogin on the server side as well (in addition to middleware).
    admin.lastLogin = new Date();
    await admin.save().catch(() => {});

    return res.json({
      success: true,
      message: 'Signed in',
      data: { adminId: admin._id, username: admin.username, role: admin.role },
    });
  })
);

// ---- Logout ---------------------------------------------------------------

router.post(
  '/logout',
  csrfMiddleware(),
  asyncHandler(async (req, res) => {
    clearSessionCookie(res);
    return res.json({ success: true, message: 'Signed out' });
  })
);

// ---- Admin init (CLI path) -------------------------------------------------

/**
 * Create (or reset) the first Super Admin account.
 *
 * This endpoint is intentionally narrow:
 *  - It is rate-limited like login.
 *  - It accepts ONLY application/json (never from an HTML form).
 *  - It is protected by a shared secret header (ADMIN_INIT_SECRET) so only the
 *    init CLI — which knows the secret — can call it. No public or staff path
 *    reaches it.
 *
 * In production this route should be disabled entirely (see env config below).
 */
router.post(
  '/init',
  express.json({ limit: '20kb' }),
  loginLimiter,
  asyncHandler(async (req, res) => {
    if (config.adminInitDisabled === true) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Administrator initialization is disabled on this server' },
      });
    }

    const secretHeader = req.headers['x-admin-init-secret'];
    if (secretHeader !== config.adminInitSecret) {
      // Do not reveal whether the route exists.
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to initialize administrators' },
      });
    }

    const body = req.body || {};
    const username = (body.username || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password;

    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'A username of at least 3 characters is required' },
      });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'A valid email address is required' },
      });
    }
    if (!password || typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'A password of at least 12 characters is required' },
      });
    }

    const passwordHash = hashPassword(password);

    // Upsert so the CLI can be re-run idempotently. Only one Super Admin account
    // is expected; role is forced to super_admin and cannot be changed by this call.
    const admin = await Admin.findOneAndUpdate(
      { username: username.toLowerCase() },
      {
        $set: {
          username: username.toLowerCase(),
          email,
          passwordHash,
          role: 'super_admin',
          isActive: true,
        },
      },
      { upsert: true, new: true, runValidators: true, fields: { passwordHash: 0 } }
    ).exec();

    return res.status(201).json({
      success: true,
      message: 'Super Admin account ready',
      data: { adminId: admin._id, username: admin.username, email: admin.email, role: admin.role },
    });
  })
);

module.exports = router;

/**
 * Server-rendered login page HTML (also used by the /admin/login route in app.js).
 * Single source of truth for the admin login form.
 */
function loginPageHandler(req, res) {
  const token = csrfTokenFactory()(req, res);
  // No siteUrl rewrite here; the admin UI is on the same origin.
  res.type('html').send(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ARAMIOT Admin — Sign in</title>
  <meta name="robots" content="noindex,nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="/admin/assets/css/admin.css">
</head>
<body>
  <div class="admin-auth-shell">
    <div class="admin-auth-card" role="main" aria-labelledby="auth-title">
      <div class="admin-auth-brand">
        <span class="admin-brand-mark" aria-hidden="true">A</span>
        <span class="admin-brand-text">
          <span class="admin-brand-name">ARAMIOT Admin</span>
          <span class="admin-brand-kicker">Super Admin</span>
        </span>
      </div>
      <h1 id="auth-title" class="admin-auth-title">Sign in to the dashboard</h1>
      <p class="admin-auth-sub">Use your Super Admin credentials to continue.</p>

      <div class="admin-auth-alert" id="auth-alert" hidden></div>

      <form id="login-form" novalidate>
        <input type="hidden" name="_csrf" value="${token}">

        <div class="field">
          <label for="admin-username">Username or email</label>
          <input
            id="admin-username"
            name="username"
            type="text"
            autocomplete="username"
            required
            placeholder="username or email"
            inputmode="text"
            aria-describedby="username-hint"
          >
          <small id="username-hint" class="field-hint">Your Super Admin username or email address.</small>
        </div>

        <div class="field">
          <label for="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="••••••••"
          >
        </div>

        <div class="field">
          <button type="submit" class="button button--primary button--block" id="login-submit">
            Sign in
          </button>
        </div>
      </form>

      <p class="admin-auth-foot">
        If you cannot sign in, contact the system owner. Administrator accounts are
        created only through the secure setup script.
      </p>
    </div>
  </div>

  <script src="/admin/assets/js/admin-auth.js" defer></script>
</body>
</html>`
  );
}

module.exports = Object.assign(module.exports, { loginPageHandler });
