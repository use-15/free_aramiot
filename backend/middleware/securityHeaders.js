'use strict';

/**
 * Minimal security headers for a public content site.
 * A full Content-Security-Policy is deferred to Phase 2 (helmet + a policy tuned
 * for the admin dashboard's assets).
 */

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

module.exports = securityHeaders;
