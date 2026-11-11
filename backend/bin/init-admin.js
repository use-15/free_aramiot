#!/usr/bin/env node
'use strict';

/**
 * Secure Super Admin initialization.
 *
 * - Creates (or resets) the first Super Admin account in the configured MongoDB.
 * - Passwords are hashed with bcrypt (12 rounds) and never printed.
 * - The account is created through the protected /api/admin/auth/init endpoint, so
 *   only an environment that knows ADMIN_INIT_SECRET can do it — not even a running
 *   admin session can reach it.
 *
 * Usage:
 *   node backend/bin/init-admin.js --username <name> --email <email> --password <pass>
 *
 * If any required flag is missing, the script prints usage and exits.
 * If the database is unreachable, it prints a clear message and exits non-zero.
 *
 * IMPORTANT security notes:
 *  - The password is supplied on the command line. Avoid shell history exposure by
 *    using a secret store or an env var in production; this script is for initial
 *    setup, not daily use.
 *  - The secret header ADMIN_INIT_SECRET must be set in .env and must NOT be
 *    committed. The router rejects requests without it.
 */

const path = require('path');
require(path.join(__dirname, '..', 'config', 'env'));

const { connectDatabase, disconnectDatabase } = require(path.join(__dirname, '..', 'config', 'database'));
const config = require(path.join(__dirname, '..', 'config', 'env'));

function usage() {
  console.log([
    'Usage: node backend/bin/init-admin.js [options]',
    '',
    'Create the first Super Admin account for the ARAMIOT admin dashboard.',
    '',
    'Options:',
    '  --username  <name>   Super Admin username (3–64 chars, letters/numbers/._-)',
    '  --email     <email>  Super Admin email address',
    '  --password  <pass>   Password (at least 12 characters)',
    '',
    'Example:',
    '  node backend/bin/init-admin.js --username alice --email alice@aramiot.org --password "ChangeMe-Now12"',
    '',
    'Required environment:',
    '  ADMIN_INIT_SECRET    Shared secret that authorizes this CLI (set in .env).',
    '  MONGODB_URI         MongoDB connection string.',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--username' || argv[i] === '--username=') {
      const v = argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : argv[++i];
      if (v) args.username = v;
    } else if (argv[i] === '--email' || argv[i] === '--email=') {
      const v = argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : argv[++i];
      if (v) args.email = v;
    } else if (argv[i] === '--password' || argv[i] === '--password=') {
      const v = argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : argv[++i];
      if (v) args.password = v;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      usage();
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.username || !args.email || !args.password) {
    usage();
    console.error('\nError: --username, --email and --password are required.');
    process.exit(2);
  }

  if (config.adminInitSecret == null || config.adminInitSecret === '') {
    console.error('Error: ADMIN_INIT_SECRET is not set in .env. This CLI cannot run without it.');
    process.exit(2);
  }

  console.log('[init-admin] connecting to database...');
  await connectDatabase();

  const { postJson } = require(path.join(__dirname, '..', 'utils', 'apiRequest'));
  const baseUrl = `http://127.0.0.1:${config.port || 3000}`;

  console.log('[init-admin] initializing Super Admin account...');
  const response = await postJson(`${baseUrl}/api/admin/auth/init`, {
    username: args.username,
    email: args.email,
    password: args.password,
  }, { headers: { 'x-admin-init-secret': config.adminInitSecret } });

  if (response.status === 201) {
    console.log('[init-admin] created:', JSON.stringify(response.body.data, null, 2));
    console.log('[init-admin] done. Log in at', `${baseUrl.replace('127.0.0.1', 'localhost')}/admin`);
  } else {
    console.error('[init-admin] failed:', JSON.stringify(response.body, null, 2));
    process.exit(1);
  }

  await disconnectDatabase();
}

main().catch((error) => {
  console.error('[init-admin] failed:', error.message);
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('[init-admin] The backend server is not running. Start it first (npm start), then run this script.');
  }
  process.exit(1);
});
