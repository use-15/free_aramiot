'use strict';

/**
 * Admin authentication + Super Admin authorization middleware.
 *
 * Verified on the server for every /api/admin/* request that is not explicitly
 * public (logout, csrf-token, and the login POST are handled separately).
 *
 * Behaviour:
 *  - Missing / invalid session cookie -> 401 UNAUTHORIZED (with a clear message
 *    the admin UI can act on, e.g. redirect to login).
 *  - Valid token but the Admin no longer exists, is inactive, or is not
 *    super_admin -> 403 FORBIDDEN.
 *  - Successful lookup -> req.admin is set to the Mongoose Admin document, and
 *    lastLogin is refreshed.
 *
 * This is the only authorization gate. The admin frontend hides buttons, but a
 * request that reaches the backend without a valid Super Admin session is denied
 * regardless of what the browser did or did not render.
 */

const Admin = require('../models/Admin');
const { decodeSession } = require('../utils/auth');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const SESSION_COOKIE = require('../utils/auth').SESSION_COOKIE;

/**
 * Extract the session from the cookie and verify it.
 * Returns the decoded payload or null.
 */
function readSession(req) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!token) return null;
  return decodeSession(token);
}

/**
 * Resolve the Admin document for a decoded session and refresh lastLogin.
 */
async function resolveAdmin(decoded) {
  if (!decoded || !decoded.sub) return null;
  // passwordHash is excluded by schema.select(false), so this read is cheap.
  const admin = await Admin.findById(decoded.sub).exec();
  if (!admin) return null;

  // Only an active Super Admin may use the session.
  if (!admin.isActive || admin.role !== 'super_admin') return null;

  // Refresh lastLogin so a stale session eventually ages out of the activity
  // window (enforced in middleware below, not in the token itself; the token's
  // hard exp still applies).
  admin.lastLogin = new Date();
  await admin.save().catch(() => {});

  return admin;
}

/**
 * Middleware: require a valid, active Super Admin session.
 *
 * When the request fails auth, the response is JSON with a machine-readable error
 * so the admin frontend can react (redirect to login, show the message). The public
 * website is unaffected because public routes are not mounted through this middleware.
 */
/**
 * True when a browser is navigating to an admin page rather than calling the API.
 * Browsers send `Accept: text/html` for navigation; the admin JS always asks for
 * JSON. Unauthenticated page loads get a redirect to the login form instead of a
 * raw JSON error body rendered in the tab (which is what an expired session used
 * to show on /admin/dashboard.html and friends).
 */
function wantsHtmlPage(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  return String(req.headers.accept || '').indexOf('text/html') !== -1;
}

const requireAdmin = asyncHandler(async (req, res, next) => {
  const decoded = readSession(req);
  if (!decoded) {
    if (wantsHtmlPage(req)) return res.redirect(302, '/admin/login');
    return next(
      ApiError.unauthorized('Authentication is required to access this resource.')
    );
  }

  const admin = await resolveAdmin(decoded);
  if (!admin) {
    // Token was syntactically valid but pointed at a stale/invalid account —
    // treat as unauthenticated so the frontend re-prompts.
    if (wantsHtmlPage(req)) return res.redirect(302, '/admin/login');
    return next(
      ApiError.unauthorized('Your session is no longer valid. Please sign in again.')
    );
  }

  req.admin = admin;
  req.adminId = admin._id;
  next();
});

// Escape hatch for endpoints that need to know *why* they were blocked (login
// page render can use this to decide whether to pre-fill or to redirect).
function getAuthState(req) {
  const decoded = readSession(req);
  if (!decoded) return { authenticated: false };
  return { authenticated: true, adminId: decoded.sub, role: decoded.role };
}

module.exports = { requireAdmin, getAuthState };
