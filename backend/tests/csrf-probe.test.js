'use strict';

/**
 * Focused probe of csrf-csrf session-identifier behaviour.
 *
 * Goal: understand exactly how getSessionIdentifier at token-generation time vs
 * validation time affects whether a login POST validates, so the admin lifecycle
 * test's re-login can be written correctly.
 *
 * This is a diagnostic artifact, not a shipped test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { once } = require('events');
const path = require('path');

const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const app = require('../app');
const { connectDatabase, disconnectDatabase, isDatabaseConnected } = require('../config/database');
const { seedDatabase } = require('../seed/sampleData');

const HOST = '127.0.0.1';
let BOUND_PORT = 0;
let BASE_URL = '';
let server = null;
let memoryServer = null;

function cookieparse(setCookie) {
  if (!setCookie) return null;
  const parts = String(setCookie).split(';');
  const first = parts[0].split('=');
  return first[0] ? decodeURIComponent(first[1] || '') : null;
}

function rawRequest(method, urlPath, cookies, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: HOST, port: BOUND_PORT, path: urlPath, method, headers: {} },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let p = null;
          try { p = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: raw, payload: p });
        });
      }
    );
    req.on('error', reject);
    if (cookies) req.setHeader('Cookie', cookies);
    if (body) {
      req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
      req.setHeader('Accept', 'application/json');
      req.end(body);
    } else {
      req.end();
    }
  });
}

function buildBody(form) {
  return Object.keys(form)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(form[k])))
    .join('&');
}

function csrfFromHtml(html) {
  const m = html.match(/<input[^>]*name=["']_csrf["'][^>]*value=["']([^"']+)["']/);
  return m ? m[1] : null;
}

function csrfCookieFromHeaders(headers) {
  const sc = headers['set-cookie'];
  if (!sc) return null;
  const list = Array.isArray(sc) ? sc : [sc];
  for (const c of list) {
    const m = c.match(/aramiot_admin_csrftoken=([^;]+)/i);
    if (m) return m[1];
  }
  return null;
}

test.before(async () => {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri('aramiot');
  await connectDatabase(process.env.MONGODB_URI);
  await seedDatabase({ clear: true });
  server = app.listen(0, HOST, () => {
    BOUND_PORT = server.address().port;
    BASE_URL = `http://${HOST}:${BOUND_PORT}`;
  });
  await once(server, 'listening');
});

test.after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await disconnectDatabase().catch(() => {});
  if (memoryServer) await memoryServer.stop().catch(() => {});
  delete process.env.MONGODB_URI;
});

test('csrf: token generation vs validation with/without session cookie', async () => {
  const INIT_SECRET = '32bfe659fe83f4d9c9d9ed36c55937ac881fe4e3c140648cf78884abebe3fa5e';

  // Ensure the super admin exists.
  await rawRequest('POST', '/api/admin/auth/init', undefined, buildBody({
    username: 'aramiot',
    email: 'admin@aramiot.org',
    password: 'SuperSecret1234!',
  }));
  // init doesn't send the init header here; skip — we rely on seed + a pre-created admin.
  // Instead, create the admin directly via the DB so we don't depend on init here.
  const Admin = require('../models/Admin');
  const { hashPassword } = require('../utils/auth');
  await Admin.findOneAndUpdate(
    { username: 'aramiot' },
    { $set: { email: 'admin@aramiot.org', passwordHash: hashPassword('SuperSecret1234!'), role: 'super_admin', isActive: true } },
    { upsert: true, new: true, runValidators: true }
  ).exec();

  // --- Scenario A: generate token WITHOUT session cookie, validate WITHOUT session cookie ---
  {
    // GET /admin/login with NO cookies -> token generated with IP+UA fallback identifier.
    const loginPage = await rawRequest('GET', '/admin/login', undefined, undefined);
    assert.equal(loginPage.status, 200);
    const tokenA = csrfFromHtml(loginPage.body);
    const cookieA = csrfCookieFromHeaders(loginPage.headers);
    assert.ok(tokenA && cookieA);

    // POST login with tokenA + cookieA, NO session cookie.
    const loginA = await rawRequest(
      'POST',
      '/api/admin/auth/login',
      'aramiot_admin_csrftoken=' + cookieA,
      buildBody({ username: 'aramiot', password: 'SuperSecret1234!', _csrf: tokenA })
    );
    console.log('[scenario A] login status:', loginA.status, 'payload:', JSON.stringify(loginA.payload));
    assert.equal(loginA.status, 200, 'scenario A (no session at gen, no session at val) should succeed');
  }

  // --- Scenario B: generate token WITH session cookie, validate WITH session cookie ---
  {
    // First log in to get a session.
    const loginPage = await rawRequest('GET', '/admin/login', undefined, undefined);
    const token0 = csrfFromHtml(loginPage.body);
    const cookie0 = csrfCookieFromHeaders(loginPage.headers);
    const firstLogin = await rawRequest(
      'POST',
      '/api/admin/auth/login',
      'aramiot_admin_csrftoken=' + cookie0,
      buildBody({ username: 'aramiot', password: 'SuperSecret1234!', _csrf: token0 })
    );
    assert.equal(firstLogin.status, 200);
    const sessionCookie = cookieparse((firstLogin.headers['set-cookie'] || [])[0]);

    // Now GET /admin/login WITH the session cookie -> token generated with admin-session identifier.
    const loginPageB = await rawRequest('GET', '/admin/login', 'aramiot_admin_session=' + sessionCookie, undefined);
    assert.equal(loginPageB.status, 200);
    const tokenB = csrfFromHtml(loginPageB.body);
    const cookieB = csrfCookieFromHeaders(loginPageB.headers);
    assert.ok(tokenB && cookieB);
    console.log('[scenario B] tokenB===cookieB?', tokenB === cookieB, 'tokenB:', tokenB ? tokenB.slice(0, 20) + '...' : null, 'cookieB:', cookieB ? cookieB.slice(0, 20) + '...' : null);

    // POST login WITH session cookie + tokenB + cookieB.
    const loginB = await rawRequest(
      'POST',
      '/api/admin/auth/login',
      'aramiot_admin_session=' + sessionCookie + '; aramiot_admin_csrftoken=' + cookieB,
      buildBody({ username: 'aramiot', password: 'SuperSecret1234!', _csrf: tokenB })
    );
    console.log('[scenario B] login status:', loginB.status, 'payload:', JSON.stringify(loginB.payload));
    assert.equal(loginB.status, 200, 'scenario B (session at gen, session at val) should succeed');
  }

  // --- Scenario C: generate token WITH session cookie, validate WITHOUT session cookie ---
  {
    // First log in.
    const loginPage = await rawRequest('GET', '/admin/login', undefined, undefined);
    const token0 = csrfFromHtml(loginPage.body);
    const cookie0 = csrfCookieFromHeaders(loginPage.headers);
    const firstLogin = await rawRequest(
      'POST',
      '/api/admin/auth/login',
      'aramiot_admin_csrftoken=' + cookie0,
      buildBody({ username: 'aramiot', password: 'SuperSecret1234!', _csrf: token0 })
    );
    assert.equal(firstLogin.status, 200);
    const sessionCookie = cookieparse((firstLogin.headers['set-cookie'] || [])[0]);

    // GET /api/admin/auth/csrf-token WITH session cookie -> token generated with admin-session identifier.
    const refresh = await rawRequest('GET', '/api/admin/auth/csrf-token', 'aramiot_admin_session=' + sessionCookie, undefined);
    assert.equal(refresh.status, 200);
    const tokenC = refresh.payload.csrfToken;
    const cookieC = csrfCookieFromHeaders(refresh.headers);
    assert.ok(tokenC && cookieC);
    console.log('[scenario C] tokenC===cookieC?', tokenC === cookieC);

    // POST login WITHOUT session cookie, WITH tokenC + cookieC.
    const loginC = await rawRequest(
      'POST',
      '/api/admin/auth/login',
      'aramiot_admin_csrftoken=' + cookieC,
      buildBody({ username: 'aramiot', password: 'SuperSecret1234!', _csrf: tokenC })
    );
    console.log('[scenario C] login status:', loginC.status, 'payload:', JSON.stringify(loginC.payload));
    // Expect FAIL: token generated with admin-session id, validated without session -> identifier mismatch.
    assert.equal(loginC.status, 403, 'scenario C (session at gen, NO session at val) should FAIL with 403');
  }

  // --- Scenario D: generate token WITHOUT session cookie, validate WITH session cookie ---
  {
    // First log in.
    const loginPage = await rawRequest('GET', '/admin/login', undefined, undefined);
    const token0 = csrfFromHtml(loginPage.body);
    const cookie0 = csrfCookieFromHeaders(loginPage.headers);
    const firstLogin = await rawRequest(
      'POST',
      '/api/admin/auth/login',
      'aramiot_admin_csrftoken=' + cookie0,
      buildBody({ username: 'aramiot', password: 'SuperSecret1234!', _csrf: token0 })
    );
    assert.equal(firstLogin.status, 200);
    const sessionCookie = cookieparse((firstLogin.headers['set-cookie'] || [])[0]);

    // GET /admin/login WITHOUT session cookie (but we have a valid session in the DB) -> token generated with IP+UA fallback.
    // To force "no session" we must not send the session cookie.
    const loginPageD = await rawRequest('GET', '/admin/login', undefined, undefined);
    assert.equal(loginPageD.status, 200);
    const tokenD = csrfFromHtml(loginPageD.body);
    const cookieD = csrfCookieFromHeaders(loginPageD.headers);
    assert.ok(tokenD && cookieD);

    // POST login WITH session cookie + tokenD + cookieD.
    const loginD = await rawRequest(
      'POST',
      '/api/admin/auth/login',
      'aramiot_admin_session=' + sessionCookie + '; aramiot_admin_csrftoken=' + cookieD,
      buildBody({ username: 'aramiot', password: 'SuperSecret1234!', _csrf: tokenD })
    );
    console.log('[scenario D] login status:', loginD.status, 'payload:', JSON.stringify(loginD.payload));
    // Expect FAIL: token generated without session, validated with session -> identifier mismatch.
    assert.equal(loginD.status, 403, 'scenario D (NO session at gen, session at val) should FAIL with 403');
  }
});
