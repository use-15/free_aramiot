'use strict';

/**
 * Centralised environment configuration.
 * Loaded once, before anything else, so no module reads process.env directly
 * (except the test harness, which overrides MONGODB_URI deliberately).
 */

const path = require('path');
const dotenv = require('dotenv');

// Always read the .env at the repository root, regardless of the working directory.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const port = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`PORT must be a valid TCP port, received "${process.env.PORT}"`);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config = {
  nodeEnv,
  isProduction,
  host: process.env.HOST || '0.0.0.0',
  port,
  mongoUri: process.env.MONGODB_URI || '',
  corsOrigins,
  serveFrontend: parseBoolean(process.env.SERVE_FRONTEND, true),
  siteUrl: process.env.SITE_URL || `http://localhost:${port}`,
  useInMemoryDb: parseBoolean(process.env.USE_IN_MEMORY_DB, false),

  // Admin auth secrets. These MUST be set in .env (never committed).
  // - adminJwtSecret signs the HTTP-only session cookie (JWT).
  // - csrfSecret signs the double-submit CSRF token cookie.
  // - adminInitSecret authorizes the CLI-only /api/admin/auth/init endpoint (the
  //   init-admin.js script). Keep it non-empty in development and empty (or the
  //   route disabled via adminInitDisabled) in production.
  // All three are stable per deployment so a restart does not invalidate in-flight
  // sessions/tokens/CSRF cookies in production.
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || '',
  csrfSecret: process.env.CSRF_SECRET || '',
  adminInitSecret: process.env.ADMIN_INIT_SECRET || '',
  adminInitDisabled: parseBoolean(process.env.ADMIN_INIT_DISABLED, false),
};

module.exports = config;
