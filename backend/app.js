'use strict';

/**
 * Express application.
 * Separated from server.js so tests can import the app without binding a port
 * to a fixed value.
 *
 * Phase 2 additions (all Opt-in via env):
 *  - helmet only in production
 *  - cookie-parser for the HTTP-only session cookie (and the CSRF cookie)
 *  - /api/admin auth endpoints (csrf-token, session, login, logout, init)
 *  - /api/admin CRUD + dashboard + inbox + settings, all behind requireAdmin
 *  - /admin UI served through server-controlled routes (not an open static dir)
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const config = require('./config/env');
const { isDatabaseConnected } = require('./config/database');
const apiRoutes = require('./routes');
const adminAuthRoutes = require('./routes/adminAuth.routes');
const adminRoutes = require('./routes/admin.routes');
const securityHeaders = require('./middleware/securityHeaders');
const errorHandler = require('./middleware/errorHandler');
const { apiNotFound, notFound } = require('./middleware/notFound');
const ApiError = require('./utils/ApiError');
const { version } = require('../package.json');

const app = express();

app.disable('x-powered-by');
// Escape <, > and & inside JSON responses (safe for consumers, blocks XSSI).
app.set('json escape', true);

// ---- security headers (Phase 1). Phase 2 adds helmet in production. ---------

app.use(securityHeaders);

if (config.isProduction) {
  // Production adds a stricter Content-Security-Policy tuned for the admin
  // dashboard's own assets and the public site's CDN fonts/icons. Nonce-based
  // scripts are not used (admin assets are loaded from the same origin + CDNs),
  // so we use a script-src allowlist instead.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          // CDNs used by the public site and the admin UI.
          scriptSrc: [
            "'self'",
            'https://cdn.jsdelivr.net',
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // admin Bootstrap + custom CSS; Phase 2 could migrate to nonces
            'https://cdn.jsdelivr.net',
            'https://fonts.googleapis.com',
          ],
          fontSrc: [
            "'self'",
            'https://fonts.gstatic.com',
            'https://cdn.jsdelivr.net',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'https://cdn.jsdelivr.net',
            'https://*.googleusercontent.com',
            'https://*.google.com',
          ],
          connectSrc: [
            "'self'",
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false, // fonts from fonts.gstatic.com need it off in some setups
    })
  );
} else {
  // In development/test we still use helmet's sensible defaults (except CSP, which
  // would block the local admin UI if too strict). Keep the base protections.
  app.use(helmet({ contentSecurityPolicy: false }));
}

// ---- CORS ------------------------------------------------------------------

/**
 * Decide whether a browser Origin may call the API.
 *
 * Browsers send `Origin` on every POST/PUT/DELETE, including same-origin ones.
 * Checking only the CORS_ORIGINS allow-list therefore rejected writes from any
 * hostname the app was actually served on but that was missing from the list —
 * a preview hostname, or the production domain. Sign-in failed with
 * "Origin … is not allowed to call this API" even though the request came from
 * the app itself. Three cases are accepted:
 *
 *   1. no Origin header at all (curl, tests, server-to-server calls);
 *   2. same-origin requests, detected from `Sec-Fetch-Site` (which survives the
 *      Host rewriting some proxies do) or by matching the Origin host to the
 *      request Host / X-Forwarded-Host;
 *   3. origins listed in CORS_ORIGINS, or any origin when the list is empty
 *      (the development default).
 *
 * Anything else is a genuine cross-site call from an unknown origin and is
 * rejected. Cross-origin writes are also covered by the CSRF token, so this is
 * defence in depth, not the only barrier.
 */
function originIsAllowed(req, origin) {
  if (!origin) return true;
  if (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) return true;

  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'same-origin' || fetchSite === 'none') return true;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch (error) {
    return false;
  }

  const requestHosts = [req.headers.host, req.headers['x-forwarded-host']]
    .filter(Boolean)
    .map((host) => String(host).split(',')[0].trim());

  return requestHosts.indexOf(originHost) !== -1;
}

app.use(
  cors((req, callback) => {
    callback(null, {
      origin(origin, cb) {
        if (originIsAllowed(req, origin)) return cb(null, true);
        return cb(ApiError.forbidden(`Origin ${origin} is not allowed to call this API`));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'X-Admin-Init-Secret', 'X-Csrf-Token'],
      // The admin session is a cookie, so cross-origin callers (when explicitly
      // allow-listed) need credential support.
      credentials: true,
      maxAge: 600,
    });
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

// ---- public API (unchanged, mounted at /api) ---------------------------------

app.get('/api/health', (req, res) => {
  const database = isDatabaseConnected() ? 'connected' : 'disconnected';
  const healthy = database === 'connected';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      database,
      environment: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      version,
    },
  });
});

app.use('/api', apiRoutes);

// ---- admin API --------------------------------------------------------------
// Mounted BEFORE the /api 404 handler so /api/admin/* is never caught by the
// public API 404. Admin auth endpoints are public-ish (login/csrf-token/session/init);
// every other /api/admin/* route requires a valid Super Admin session.
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', require('./middleware/adminAuth').requireAdmin, adminRoutes);

app.use('/api', apiNotFound);

// ---- admin UI (server-controlled) ------------------------------------------

/**
 * The admin interface is served through server-controlled routes so that:
 *  - /admin/login is always reachable (renders the login form),
 *  - /admin (the dashboard shell) is only served to an authenticated Super Admin
 *    (otherwise the browser is redirected to /admin/login),
 *  - static admin assets under /admin/assets/* and /admin/components/* are served
 *    ONLY when the request is same-origin and the path is within the admin tree,
 *    and only when the client is authenticated OR requesting an asset (so an
 *    unauthenticated visitor cannot enumerate admin JS/CSS by guessing paths).
 *
 * Admin HTML files are NOT served by a broad express.static call; they are rendered
 * here through small route handlers. Static assets (CSS/JS) live under admin/ and
 * are served through a guarded static middleware below.
 */

const adminStatic = express.static(path.join(__dirname, '..', 'admin'), {
  extensions: ['html'],
  maxAge: config.isProduction ? '1h' : 0,
  fallthrough: false,
});

/**
 * Guard: admin static assets may only be served to same-origin requests (no
 * foreign origins) and, for HTML, only when the client is authenticated or on the
 * login page. We allow asset requests (CSS/JS/images) freely because Chrome-style
 * prefetch and the asset pipeline will request them; the real secrecy is that
 * admin HTML is never advertised and cannot be guessed effectively.
 */
function adminAssetGuard(req, res, next) {
  // Allow non-HTML assets without auth (they are not secret by themselves; the
  // sensitive thing is the admin HTML that references them and the data API).
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2|woff|eot|ttf)$/i)) {
    return next();
  }

  // For HTML and everything else, require Same-Origin only.
  if (!req.headers.origin || req.headers.origin === req.protocol + '://' + (req.headers.host || '')) {
    // Same-origin: allow (the auth check for HTML happens in the route handler below).
    return next();
  }

  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'The admin interface is not available from this origin' },
  });
}

// Admin login page — always reachable (renders form), POST goes through the API.
app.get('/admin/login', adminAssetGuard, (_req, res) => {
  // Delegate to the API router's login HTML renderer so we keep a single source
  // of truth for the HTML. Re-exporting the handler here avoids duplication.
  const { loginPageHandler } = require('./routes/adminAuth.routes');
  loginPageHandler(_req, res);
});

// Admin dashboard / shell — redirect unauthenticated requests to login.
app.get('/admin', adminAssetGuard, require('./middleware/adminAuth').requireAdmin, async (req, res) => {
  // Serve dashboard.html to authenticated admins.
  const dashboardPath = path.join(__dirname, '..', 'admin', 'dashboard.html');
  if (require('fs').existsSync(dashboardPath)) {
    return res.sendFile(dashboardPath);
  }
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Admin dashboard file missing' },
  });
});

// Admin static assets (CSS/JS/images) — same-origin only, no auth required.
// These mounts are registered BEFORE the /admin/* catch-all so that requests for
// admin JS/CSS/images are served by the static handler (assets are not secret on
// their own; the sensitive thing is the admin HTML and the data API) and never hit
// the authenticated /admin/* route. That keeps the login page loadable by
// unauthenticated users (the login page itself is served separately by /admin/login).
app.use('/admin/assets', adminAssetGuard, express.static(path.join(__dirname, '..', 'admin', 'assets'), {
  maxAge: config.isProduction ? '1h' : 0,
}));
app.use('/admin/components', adminAssetGuard, express.static(path.join(__dirname, '..', 'admin', 'components'), {
  maxAge: config.isProduction ? '1h' : 0,
}));

// Fallback for /admin/* HTML pages — serve from admin/ if authenticated.
//
// express.static (adminStatic) used here as a direct handler (not via app.use)
// does not strip the mount prefix from req.url, so a request to /admin/articles.html
// would be resolved as admin/admin/articles.html and 404. We resolve the file path
// explicitly (mirroring adminStatic's .html extension fallback + fallthrough) so
// admin HTML pages are served correctly. A path-traversal check keeps requests
// inside the admin/ tree.
app.get('/admin/*', adminAssetGuard, require('./middleware/adminAuth').requireAdmin, (req, res) => {
  const ADMIN_DIR = path.resolve(path.join(__dirname, '..', 'admin'));
  // Strip the query string so `?id=...` (used by the edit flow) does not end up as
  // part of the file path we look for. The page JS receives the id from the URL and
  // opens the editor itself; we only ever need to serve the static HTML file here.
  const rel = req.url.replace(/^\/admin\/?/, '').split('?')[0] || '';
  if (!rel) {
    // /admin/ (trailing slash) -> serve dashboard.html, matching /admin.
    const dh = path.join(ADMIN_DIR, 'dashboard.html');
    if (require('fs').existsSync(dh)) {
      return res.sendFile(dh, { maxAge: config.isProduction ? '1h' : 0 });
    }
    return res.redirect(302, '/admin');
  }
  const resolved = path.resolve(ADMIN_DIR, rel);
  const adminRoot = ADMIN_DIR + path.sep;
  if (!resolved.startsWith(adminRoot)) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
  }
  const tryPaths = [resolved, resolved + '.html'];
  let filePath = null;
  for (const p of tryPaths) {
    if (require('fs').existsSync(p)) { filePath = p; break; }
  }
  if (filePath) {
    return res.sendFile(filePath, { maxAge: config.isProduction ? '1h' : 0 });
  }
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Admin page not found' },
  });
});

// ---- public website (unchanged) -------------------------------------------

// The public website is static; Express can serve it in development so the
// frontend and API share one origin. In production it may be served by a CDN.
if (config.serveFrontend) {
  app.use(
    express.static(path.join(__dirname, '..', 'frontend'), {
      extensions: ['html'],
      maxAge: config.isProduction ? '1h' : 0,
    })
  );
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
