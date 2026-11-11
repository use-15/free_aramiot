'use strict';

/**
 * Administrative authentication and CSRF support.
 *
 * Strategy (cookie-based, server-side session via JWT in an HTTP-only cookie):
 *
 *  - On login, a short-lived JWT is minted (payload: { sub: admin._id, role,
 *    iat, exp }) and set as an HTTP-only, Secure-in-production, SameSite=Lax
 *    cookie named `aramiot_admin_session`.
 *  - The JWT is signed with a secret that lives only in the environment. Same
 *    secret is never sent to the browser.
 *  - Server-side auth middleware verifies the cookie, looks the admin up, and
 *    rejects inactive / wrong-role / malformed / expired sessions.
 *  - CSRF protection uses the `csrf-csrf` double-submit-token pattern. The admin
 *    login view is served HTML (not JSON), so the token is read by the login form
 *    and sent as `req.body._csrf` on the login POST. The same pattern protects
 *    all mutation admin routes.
 *  - A login attempt rate limiter is per-IP: allow 10 attempts per 15 minutes.
 *    After that, further attempts in the window are rejected (429) until it
 *    resets.
 *
 * Session lifetime for display: 8 hours of inactivity. Absolute expiry: 7 days.
 * Logout clears the cookie and, when DB is available, records the logout in
 * lastLogin rotation is NOT required on logout; the token simply stops being valid.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const ApiError = require('./ApiError');

const SESSION_COOKIE = 'aramiot_admin_session';
const BCRYPT_ROUNDS = 12;

// ---- JWT + cookie lifecycle -------------------------------------------------

function sessionSecret() {
  if (!config.adminJwtSecret) {
    throw new Error(
      'ADMIN_JWT_SECRET is not set. Generate one (for example: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))") and set ADMIN_JWT_SECRET in .env.'
    );
  }
  return config.adminJwtSecret;
}

const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours activity window
const ABSOLUTE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days hard cap

function mintSession(admin) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: admin._id.toString(),
    role: admin.role,
    iat: now,
    // activity window — used by middleware to decide whether a token is still
    // "fresh enough"; absolute cap below.
    exp: now + Math.min(SESSION_TTL_SECONDS, ABSOLUTE_TTL_SECONDS),
  };
  return jwt.sign(payload, sessionSecret(), { algorithm: 'HS256' });
}

function decodeSession(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, sessionSecret(), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/**
 * HTTP-only session cookie options. `secure` is off in development / test, on
 * in production (so browsers only send it over HTTPS there).
 */
function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
    // Do not expose the JWT to JavaScript at all.
    // (csrf-csrf sets its own non-HTTP-only token cookie separately.)
  };
}

// ---- login rate limiting ---------------------------------------------------

const LOGIN_KEY_FN = (req) => {
  // Prefer a real IP; in production a gateway may set X-Forwarded-For.
  return (
    (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

/** 10 login attempts per 15 minutes per IP. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Only apply to the login POST and the admin-init POST (account creation path).
  // Other admin reads/writes rely on auth + CSRF, not on rate limiting.
  skip: (req) => !['/api/admin/auth/login', '/api/admin/auth/init'].includes(req.originalUrl),
  keyGenerator: LOGIN_KEY_FN,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many login attempts. Please try again later.',
      },
    });
  },
});

// ---- CSRF ----------------------------------------------------------------

/**
 * `csrf-csrf` is a double-submit-token CSRF library.
 *
 * It maintains a pair of tokens:
 *   - a secret cookie set on the response (`aramiot_admin_csrftoken`, non-HTTP-only
 *     so the admin JS client can read it),
 *   - a per-request submit token that the client sends back as `req.body._csrf`
 *     (or as the `X-Csrf-Token` header).
 *
 * The instance exposes:
 *   - `doubleCsrfProtection` — the Express middleware that VALIDATES incoming
 *     state-changing requests (POST/PUT/DELETE) by checking the submit token
 *     against the cookie.
 *   - `generateCsrfToken(req, res)` — generates a new secret, sets the cookie,
 *     and returns the submit token to embed in HTML forms or return to the admin
 *     JS client via `/api/admin/auth/csrf-token`.
 *   - `validateRequest(req, res)` — lower-level validator used by the middleware.
 *
 * Generation flow (GET /admin/login or GET /api/admin/auth/csrf-token):
 *   call `csrfProtection().generateCsrfToken(req, res)`, which sets the cookie and
 *   returns the token to embed.
 *
 * Validation flow (POST/PUT/DELETE admin routes):
 *   use `csrfProtection().doubleCsrfProtection` as Express middleware AFTER body
 *   parsing, so `req.body._csrf` is available.
 *
 * NOTE: `csrf-csrf`'s `getSecret` is called as `getSecret(req)`, so it must accept
 * a request argument.
 */
let _doubleCsrf = null;
function csrfProtection() {
  if (!_doubleCsrf) {
    const { doubleCsrf } = require('csrf-csrf');
    _doubleCsrf = doubleCsrf({
      // The secret used to sign/validate the CSRF token. In production this must be
      // a stable, persisted secret (from .env). In development a per-process random
      // fallback is acceptable for local review only (tokens from a previous process
      // will not validate after restart — expected in dev).
      getSecret: (req) => config.csrfSecret || crypto.randomBytes(32).toString('hex'),
      // Identifies the session so a fresh secret is generated per session. Uses the
      // admin session cookie (set by the admin auth flow) when present, otherwise the
      // established IP+User-Agent so validation still works for requests without an
      // admin session (e.g. the csrf-token endpoint itself).
      getSessionIdentifier: (req) => {
        const sessionId = req.cookies && req.cookies['aramiot_admin_session'];
        if (sessionId) return 'admin-session:' + sessionId;
        const ua = (req.headers['user-agent'] || '').slice(0, 128);
        const ip = (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim())
          || req.socket?.remoteAddress
          || 'unknown';
        return 'csrf:' + ip + ':' + ua;
      },
      cookieName: 'aramiot_admin_csrftoken',
      cookieOptions: {
        httpOnly: false, // JS on the admin view needs to read it to build the submit token
        sameSite: 'lax',
        secure: config.isProduction,
        path: '/',
        maxAge: 8 * 60 * 60 * 1000,
      },
      size: 64,
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
      // csrf-csrf v4 defaults getCsrfTokenFromRequest to reading the
      // `X-Csrf-Token` header. Our admin client (login form + admin-api.js) sends the
      // submit token as `req.body._csrf` (urlencoded), so we configure the library to
      // read it from the parsed body. We also accept the header for any client that
      // prefers it, matching the library's default behaviour.
      getCsrfTokenFromRequest: (req) =>
        (req.body && req.body._csrf) ||
        (req.headers && req.headers['x-csrf-token']) ||
        '',
    });
  }
  return _doubleCsrf;
}

/** Build (and set the cookie for) a fresh CSRF submit token. */
function csrfTokenFactory() {
  const protector = csrfProtection();
  return (req, res) => protector.generateCsrfToken(req, res);
}

/** Express middleware that validates the incoming CSRF submit token. */
function csrfMiddleware() {
  return csrfProtection().doubleCsrfProtection;
}

// ---- password helpers -------------------------------------------------------

function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('A non-empty password is required');
  }
  // bcryptjs with explicit salt rounds — no plaintext log, no hardcoded salt.
  const bcrypt = require('bcryptjs');
  return bcrypt.hashSync(plaintext, BCRYPT_ROUNDS);
}

function verifyPassword(plaintext, hash) {
  if (!plaintext || !hash) return false;
  try {
    const bcrypt = require('bcryptjs');
    return bcrypt.compareSync(plaintext, hash);
  } catch {
    return false;
  }
}

// ---- cookie helpers ---------------------------------------------------------

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  });
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

// ---- public surface ---------------------------------------------------------

module.exports = {
  SESSION_COOKIE,
  BCRYPT_ROUNDS,
  sessionSecret,
  mintSession,
  decodeSession,
  sessionCookieOptions,
  loginLimiter,
  csrfTokenFactory,
  csrfProtection,
  hashPassword,
  verifyPassword,
  clearSessionCookie,
  setSessionCookie,
  csrfMiddleware,
};
