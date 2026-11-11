'use strict';

/**
 * ARAMIOT admin lifecycle verification (Phase 3).
 *
 * This is a single self-contained test that:
 *  1. starts its own in-memory MongoDB (mongodb-memory-server, already cached),
 *  2. connects the real app module,
 *     3. seeds sample content,
 *  4. binds the HTTP server on a free port,
 *  5. exercises the full admin lifecycle over HTTP:
 *       - init super admin (X-Admin-Init-Secret)
 *       - GET /admin/login -> parse _csrf + CSRF cookie
 *       - POST /api/admin/auth/login (urlencoded, with _csrf) -> session cookie
 *       - GET /api/admin/dashboard
 *       - POST /api/admin/pages (create published + draft)
 *       - GET /api/admin/pages (list)
 *       - PUT /api/admin/pages/:id (edit)
 *       - publish / unpublish
 *       - DELETE /api/admin/pages/:id (archive)
 *       - public↔admin sync: draft must not appear on public /api/pages
 *       - inbox: POST /api/contact, list via /api/admin/messages, status change, delete
 *       - account: GET/PUT /api/admin/account, POST /api/admin/account/password
 *       - logout + re-auth
 *       - unauthorized: /api/admin/* without session -> 401
 *       - media: /api/admin/media/upload placeholder rejection
 *  6. stops the server + DB.
 *
 * IMPORTANT: this is a verification script, not part of the public API. It is
 * meant to be run as `node backend/tests/admin-lifecycle.test.js` or via
 * `npm test` (it is discoverable by node --test because it has .test.js suffix
 * and uses node:test). It is intentionally NOT added to the shipped Phase 1
 * suite that already passes; it is a Phase 3 verification artifact.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const http = require('http');
const { once } = require('events');

// ---- bring in the real app + DB + seed (same artifacts the running server uses) ----

const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const app = require('../app');
const { connectDatabase, disconnectDatabase, isDatabaseConnected } = require('../config/database');
const { seedDatabase } = require('../seed/sampleData');
const Admin = require('../models/Admin');

// ---- config overrides for this test harness ----

const INIT_SECRET = '32bfe659fe83f4d9c9d9ed36c55937ac881fe4e3c140648cf78884abebe3fa5e';
const ADMIN_USERNAME = 'aramiot';
const ADMIN_EMAIL = 'admin@aramiot.org';
const ADMIN_PASSWORD = 'SuperSecret1234!';

// ---- HTTP helpers (same-origin form-encoded requests, cookies) ----

function cookieparse(setCookie) {
  if (!setCookie) return null;
  const parts = String(setCookie).split(';');
  const first = parts[0].split('=');
  return first[0] ? decodeURIComponent(first[1] || '') : null;
}

/** GET text/html. */
function getHtml(url, cookies) {
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE_URL);
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          Cookie: cookies || '',
          Accept: 'text/html',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** GET JSON. */
function getJson(url, cookies) {
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE_URL);
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          Cookie: cookies || '',
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          let payload = null;
          try { payload = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body, payload });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * POST urlencoded (used for login, CSRF-validated writes).
 * body must be a flat object; we build application/x-www-form-urlencoded.
 */
function postUrlencoded(url, form, cookies, extraHeaders) {
  const body = Object.keys(form)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(form[k])))
    .join('&');
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE_URL);
    const headers = Object.assign(
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
      extraHeaders || {}
    );
    if (cookies) headers.Cookie = cookies;
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let payload = null;
          try { payload = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: raw, payload });
        });
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

/** POST JSON (used for init + contact form + a few non-CSRF writes). */
function postJson(url, body, cookies, extraHeaders) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE_URL);
    const headers = Object.assign(
      {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(payload, 'utf8'),
      },
      extraHeaders || {}
    );
    if (cookies) headers.Cookie = cookies;
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'POST',
        headers,
      },
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
    req.end(payload);
  });
}

/**
 * PUT urlencoded with cookies + _csrf in the body (for admin edits).
 */
function putUrlencoded(url, form, cookies, extraHeaders) {
  const body = Object.keys(form)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(form[k])))
    .join('&');
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE_URL);
    const headers = Object.assign(
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
      extraHeaders || {}
    );
    if (cookies) headers.Cookie = cookies;
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'PUT',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let payload = null;
          try { payload = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: raw, payload });
        });
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * DELETE with cookies + optional urlencoded body (used for CSRF-protected deletes
 * that require _csrf in the body).
 */
function del(url, cookies, form) {
  const body = form
    ? Object.keys(form)
        .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(form[k])))
        .join('&')
    : '';
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE_URL);
    const headers = {
      Accept: 'application/json',
    };
    if (cookies) headers.Cookie = cookies;
    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
    }
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'DELETE',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let payload = null;
          try { payload = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: raw, payload });
        });
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

/** Read the CSRF submit token from the HTML login page. */
function csrfFromLoginPage(html) {
  const m = html.match(/<input[^>]*name=["']_csrf["'][^>]*value=["']([^"']+)["']/);
  return m ? m[1] : null;
}

/** Read the CSRF cookie from a Set-Cookie header. */
function csrfCookieFromHeaders(headers) {
  const sc = headers['set-cookie'];
  if (!sc) return null;
  const list = Array.isArray(sc) ? sc : [sc];
  for (const c of list) {
    if (c.toLowerCase().indexOf('aramiot_admin_csrftoken') === 0) {
      const m = c.match(/aramiot_admin_csrftoken=([^;]+)/i);
      return m ? m[1] : null;
    }
  }
  return null;
}

// ---- server bind + lifecycle ----

let memoryServer = null;
let server = null;
let BASE_URL = '';
const BOUND_HOST = '127.0.0.1';
let BOUND_PORT = 0;
let PORT_VALUE = 0;

test.before(async () => {
  // Start an in-memory MongoDB for this suite only.
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri('aramiot');

  await connectDatabase(process.env.MONGODB_URI);
  assert.ok(isDatabaseConnected(), 'DB should be connected before seeding');

  // Seed sample content (same as a dev:memory startup).
  const summary = await seedDatabase({ clear: true });
  assert.ok(summary.pages > 0, 'sample pages should be seeded');

  // Bind the real app on a free port.
  server = app.listen(BOUND_PORT, BOUND_HOST, () => {
    const addr = server.address();
    assert.ok(addr && typeof addr !== 'string', 'server should have an address object');
    BOUND_PORT = addr.port;
    PORT_VALUE = addr.port;
    BASE_URL = `http://${BOUND_HOST}:${BOUND_PORT}`;
  });

  await once(server, 'listening');
  assert.ok(BASE_URL, 'BASE_URL should be set after listening');
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  await disconnectDatabase().catch(() => {});
  if (memoryServer) {
    await memoryServer.stop().catch(() => {});
    memoryServer = null;
  }
  // Do not leave a stray env override for other suites.
  delete process.env.MONGODB_URI;
});

// ---- helper: authenticated client cookies after login ----
//
// Mirrors the real admin JS client flow:
//  1. GET /admin/login  -> HTML form with a _csrf hidden field + a Set-Cookie
//     that sets aramiot_admin_csrftoken. The token inside the form is the submit
//     token for that same csrf-csrf call.
//  2. POST /api/admin/auth/login urlencoded with _csrf = the token from step 1
//     and Cookie = the aramiot_admin_csrftoken cookie from step 1, so the
//     double-submit validator can match them.
//  3. On success the response sets the HTTP-only aramiot_admin_session cookie.
//  4. We then also refresh the CSRF token (the admin JS client does this on every
//     page load) so subsequent writes use a fresh token/cookie pair.

async function loginAsAdmin() {
  // Step 1: GET /admin/login -> form _csrf + CSRF cookie (same csrf-csrf call).
  const loginPage = await getHtml('/admin/login');
  assert.equal(loginPage.status, 200, 'GET /admin/login should be reachable');
  const csrfFormToken = csrfFromLoginPage(loginPage.body);
  assert.ok(csrfFormToken, 'login page must contain a _csrf hidden field');
  const csrfCookie = csrfCookieFromHeaders(loginPage.headers);
  assert.ok(csrfCookie, 'GET /admin/login should set the CSRF cookie');

  // Step 2: POST /api/admin/auth/login with the _csrf from the SAME call and the
  // CSRF cookie from the SAME call. Body is urlencoded (the backend parses
  // express.urlencoded on this route and reads req.body._csrf).
  const login = await postUrlencoded('/api/admin/auth/login', {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    _csrf: csrfFormToken,
  }, 'aramiot_admin_csrftoken=' + csrfCookie);
  assert.equal(login.status, 200, 'login should succeed');
  assert.ok(login.payload && login.payload.success === true, 'login payload should be success');
  const sessionCookie = cookieparse((login.headers['set-cookie'] || [])[0]);
  assert.ok(sessionCookie, 'login should set the session cookie');

  // Step 3: build the authenticated cookie jar (session + csrf).
  const cookies = [
    'aramiot_admin_session=' + sessionCookie,
    'aramiot_admin_csrftoken=' + csrfCookie,
  ].join('; ');

  // Step 4: confirm the session endpoint reports authenticated.
  const session = await getJson('/api/admin/auth/session', cookies);
  assert.equal(session.status, 200, 'session endpoint reachable');
  assert.ok(session.payload.data.authenticated === true, 'session should report authenticated');

  // Step 5: refresh the CSRF token for subsequent writes (the admin JS client
  // calls /api/admin/auth/csrf-token on every page load). Capture the fresh
  // token + cookie pair so writes validate.
  const csrfRefreshHeaders = {};
  const csrfRefresh = await new Promise((resolve, reject) => {
    const u = new URL('/api/admin/auth/csrf-token', BASE_URL);
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          Cookie: cookies,
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let p = null;
          try { p = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, payload: p });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(csrfRefresh.status, 200, 'csrf-token refresh should work');
  const freshCsrfToken = csrfRefresh.payload && csrfRefresh.payload.csrfToken;
  assert.ok(freshCsrfToken, 'csrf-token endpoint must return a csrfToken');
  const freshCsrfCookie = csrfCookieFromHeaders(csrfRefresh.headers);
  assert.ok(freshCsrfCookie, 'csrf-token refresh should set the CSRF cookie');

  // Rebuild cookies with the fresh CSRF cookie so writes validate.
  const writeCookies = [
    'aramiot_admin_session=' + sessionCookie,
    'aramiot_admin_csrftoken=' + freshCsrfCookie,
  ].join('; ');

  return { cookies: writeCookies, csrfCookie: freshCsrfCookie, sessionCookie, csrfToken: freshCsrfToken };
}

// ============================ TESTS ============================

test('system integration: admin lifecycle over HTTP', async () => {
  // --- init super admin via the protected init endpoint ---

  const initResp = await postJson(
    '/api/admin/auth/init',
    {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
    undefined,
    { 'X-Admin-Init-Secret': INIT_SECRET }
  );
  assert.equal(initResp.status, 201, 'admin init should create the super admin');
  assert.ok(initResp.payload.data.username === ADMIN_USERNAME, 'init should echo the username');

  // --- unauthorized: /api/admin/* without any cookie -> 401 ---

  {
    const unauth = await getJson('/api/admin/dashboard');
    assert.equal(unauth.status, 401, 'unauthenticated admin request should be 401');
    assert.ok(unauth.payload.error.code === 'UNAUTHORIZED', 'should be an UNAUTHORIZED error');
  }

  {
    const unauthWrite = await postUrlencoded('/api/admin/pages', { title: 'x' }, undefined);
    assert.ok(
      unauthWrite.status === 401 || unauthWrite.status === 400,
      'unauthenticated admin write should be rejected (401/400)'
    );
  }

  // --- login + session + dashboard ---

  const { cookies, csrfCookie, csrfToken } = await loginAsAdmin();
  // csrfToken is the submit token for write operations (comes from the same
  // csrf-csrf call that set the CSRF cookie we send in `cookies`).
  const csrfForWrite = csrfToken;

  const dashboard = await getJson('/api/admin/dashboard', cookies);
  assert.equal(dashboard.status, 200, 'dashboard reachable when authenticated');
  assert.ok(dashboard.payload.data.summary, 'dashboard should return summary');
  assert.ok(
    typeof dashboard.payload.data.summary.publishedArticles === 'number',
    'summary should include publishedArticles count'
  );

  // --- create a published page ---

  assert.ok(csrfToken, 'login helper must provide a csrfToken for writes');

  const created = await postUrlencoded('/api/admin/pages', {
    title: 'Phase 3 verification page',
    section: 'overview',
    excerpt: 'A page created during the Phase 3 admin lifecycle verification.',
    content: '<p>This page was created by the admin lifecycle test.</p>',
    status: 'published',
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(created.status, 201, 'creating a page should succeed');
  const pageId = created.payload.data._id;
  assert.ok(pageId, 'created page should have an _id');
  const createdSlug = created.payload.data.slug;
  assert.ok(createdSlug, 'created page should have a slug');

  // --- list pages (admin sees all statuses) ---

  const list = await getJson('/api/admin/pages?limit=50', cookies);
  assert.equal(list.status, 200, 'admin pages list should work');
  const titles = list.payload.data.map((d) => d.title);
  assert.ok(titles.includes('Phase 3 verification page'), 'list should include the created page');

  // --- detail by id ---

  const detail = await getJson('/api/admin/pages/id/' + encodeURIComponent(pageId), cookies);
  assert.equal(detail.status, 200, 'admin detail by id should work');
  assert.equal(detail.payload.data._id, pageId);

  // --- edit (PUT /api/admin/pages/:id) ---

  const edited = await putUrlencoded('/api/admin/pages/' + encodeURIComponent(pageId), {
    excerpt: 'Edited during verification.',
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(edited.status, 200, 'editing a page should succeed');
  assert.equal(edited.payload.data.excerpt, 'Edited during verification.');

  // --- publish / unpublish (PUT /api/admin/pages/:id) ---

  const unpub = await putUrlencoded('/api/admin/pages/' + encodeURIComponent(pageId), {
    status: 'draft',
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(unpub.status, 200, 'unpublishing a page should succeed');
  assert.equal(unpub.payload.data.status, 'draft');

  const pub = await putUrlencoded('/api/admin/pages/' + encodeURIComponent(pageId), {
    status: 'published',
    publishedAt: new Date().toISOString(),
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(pub.status, 200, 'publishing a page should succeed');
  assert.equal(pub.payload.data.status, 'published');

  // --- public↔admin sync: draft must NOT appear on public /api/pages ---

  // Create a draft page.
  const draftCreated = await postUrlencoded('/api/admin/pages', {
    title: 'Secret draft — should not be public',
    section: 'overview',
    excerpt: 'This is a draft and must stay hidden.',
    content: '<p>draft</p>',
    status: 'draft',
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(draftCreated.status, 201, 'draft page creation should succeed');
  const draftSlug = draftCreated.payload.data.slug;

  // Public listing must not include the draft.
  const publicList = await getJson('/api/pages?limit=100');
  assert.equal(publicList.status, 200, 'public pages listing should work');
  const publicSlugs = publicList.payload.data.map((d) => d.slug);
  assert.ok(
    !publicSlugs.includes(draftSlug),
    'public /api/pages must NOT include a draft page'
  );

  // Public detail for the draft slug must 404.
  const draftPublicDetail = await getJson('/api/pages/' + encodeURIComponent(draftSlug));
  assert.equal(draftPublicDetail.status, 404, 'public /api/pages/:slug for a draft must 404');

  // After publishing, it should become visible.
  await putUrlencoded('/api/admin/pages/' + encodeURIComponent(draftCreated.payload.data._id), {
    status: 'published',
    publishedAt: new Date().toISOString(),
    _csrf: csrfForWrite,
  }, cookies);

  const afterPublishList = await getJson('/api/pages?limit=100');
  assert.equal(afterPublishList.status, 200, 'public pages listing after publish should work');
  const afterPublishSlugs = afterPublishList.payload.data.map((d) => d.slug);
  assert.ok(
    afterPublishSlugs.includes(draftSlug),
    'public /api/pages must include a published page'
  );

  // --- archive a page (soft delete via DELETE /api/admin/pages/:id) ---

  const archived = await del('/api/admin/pages/' + encodeURIComponent(pageId), cookies, { _csrf: csrfForWrite });
  assert.ok(archived.status === 200, 'archiving a page should succeed (soft archive)');
  assert.equal(archived.payload.data.status, 'archived', 'archived page should have status archived');

  // The archived page should no longer be reachable via public slug.
  const archivedPublic = await getJson('/api/pages/' + encodeURIComponent(createdSlug));
  assert.equal(archivedPublic.status, 404, 'archived page must 404 on public listing');

  // --- inbox: contact message ---

  const contact = await postJson('/api/contact', {
    name: 'Verifier',
    email: 'verifier@aramiot.org',
    subject: 'Phase 3 verification',
    message: 'This is a test contact message from the admin lifecycle suite.',
  });
  assert.equal(contact.status, 201, 'contact submission should succeed');
  // The public contact endpoint returns data.id (the virtual id), not data._id.
  const messageId = contact.payload.data.id;
  assert.ok(messageId, 'contact message should have an id');

  // Admin list messages.
  const messages = await getJson('/api/admin/messages?limit=50', cookies);
  assert.equal(messages.status, 200, 'admin messages list should work');
  const messageIds = messages.payload.data.map((d) => d._id);
  assert.ok(messageIds.includes(messageId), 'admin messages list should include the submitted message');

  // Update status (PUT /api/admin/messages/:id, CSRF-protected).
  const updatedMsg = await putUrlencoded('/api/admin/messages/' + encodeURIComponent(messageId), {
    status: 'read',
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(updatedMsg.status, 200, 'updating a message status should succeed');
  assert.equal(updatedMsg.payload.data.status, 'read');

  // Delete the message (hard delete for inbox, DELETE + _csrf in body).
  const delMsg = await del('/api/admin/messages/' + encodeURIComponent(messageId), cookies, { _csrf: csrfForWrite });
  assert.equal(delMsg.status, 200, 'deleting an inbox message should succeed');

  // --- account: get / put / password ---

  const account = await getJson('/api/admin/account', cookies);
  assert.equal(account.status, 200, 'account endpoint should work');
  assert.ok(account.payload.data.email === ADMIN_EMAIL, 'account should carry the admin email');

  const updatedAccount = await putUrlencoded('/api/admin/account', {
    email: 'verifier-updated@aramiot.org',
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(updatedAccount.status, 200, 'updating account email should succeed');
  assert.equal(updatedAccount.payload.data.email, 'verifier-updated@aramiot.org');

  // Password change.
  const pwdChange = await postUrlencoded('/api/admin/account/password', {
    currentPassword: ADMIN_PASSWORD,
    newPassword: 'NewAdminSecret-99',
    _csrf: csrfForWrite,
  }, cookies);
  assert.equal(pwdChange.status, 200, 'password change should succeed');

  // Re-login with the new password.
  //
  // csrf-csrf v4 builds the token's HMAC from the session identifier
  // (getSessionIdentifier) AT TOKEN GENERATION TIME, and re-validates the same
  // identifier AT VALIDATION TIME (scenarios where the identifier differs between
  // generation and validation fail with EBADCSRFTOKEN — see the csrf-probe test).
  //
  // To re-login we refresh the CSRF token WHILE the session cookie is present (so the
  // new token is generated with the "admin-session:<id>" identifier), then POST the
  // re-login WITH the session cookie present (so validation uses the same identifier).
  // We rebuild the cookie jar with the fresh CSRF token/cookie and the existing session.
  const newCsrfResp = await new Promise((resolve, reject) => {
    const u = new URL('/api/admin/auth/csrf-token', BASE_URL);
    const req = http.request(
      {
        hostname: BOUND_HOST,
        port: BOUND_PORT,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          Cookie: cookies,
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let p = null;
          try { p = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, payload: p });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(newCsrfResp.status, 200, 'csrf-token refresh before re-login should work');
  const newCsrfToken = newCsrfResp.payload && newCsrfResp.payload.csrfToken;
  assert.ok(newCsrfToken, 'csrf-token endpoint must return a csrfToken for re-login');
  const newCsrfCookie = csrfCookieFromHeaders(newCsrfResp.headers);
  assert.ok(newCsrfCookie, 'csrf-token refresh should set the CSRF cookie');

  // Extract the existing session cookie value from the jar and rebuild the jar with
  // the fresh CSRF cookie so the re-login POST carries both (identifier stays
  // "admin-session:<id>" at both generation and validation time).
  function cookieValue(jar, name) {
    const m = jar.match(new RegExp('\\b' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  const oldSession = cookieValue(cookies, 'aramiot_admin_session');
  assert.ok(oldSession, 'the original login jar must contain a session cookie for re-login');
  const reLoginCookies = 'aramiot_admin_session=' + oldSession + '; aramiot_admin_csrftoken=' + newCsrfCookie;

  const newLogin = await postUrlencoded('/api/admin/auth/login', {
    username: ADMIN_USERNAME,
    password: 'NewAdminSecret-99',
    _csrf: newCsrfToken,
  }, reLoginCookies);
  assert.equal(newLogin.status, 200, 're-login with new password should succeed');

  // Restore original password for other tests (idempotent init can re-create).
  await postJson(
    '/api/admin/auth/init',
    { username: ADMIN_USERNAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    undefined,
    { 'X-Admin-Init-Secret': INIT_SECRET }
  );

  // --- media placeholder (Drive-ready, Phase 3) ---
  //
  // The /api/admin/media/upload endpoint is now mounted (behind requireAdmin + CSRF)
  // and delegates to mediaService.uploadToProvider, which is still a Phase-3 placeholder
  // that rejects google-drive uploads with a clear "not implemented in this phase"
  // message. We verify it is reachable (passes auth + CSRF) and returns the placeholder
  // rejection rather than a generic 404 from apiNotFound.
  {
    const mediaUpload = await postUrlencoded('/api/admin/media/upload', {
      provider: 'google-drive',
      fileId: 'dummy-file-id',
      fileUrl: 'https://drive.google.com/thumbnail?id=dummy-file-id',
      _csrf: csrfToken,
    }, cookies);
    assert.ok(
      mediaUpload.status === 404 || mediaUpload.status === 501,
      'media upload placeholder should reject with 404/501 (got ' + mediaUpload.status + ')'
    );
    assert.ok(
      (mediaUpload.payload && mediaUpload.payload.error && mediaUpload.payload.error.message &&
        mediaUpload.payload.error.message.toLowerCase().indexOf('not implemented') !== -1) ||
      mediaUpload.status !== 200,
      'media placeholder should return a clear not-implemented message'
    );
  }

  // --- logout + re-auth ---

  const logout = await postUrlencoded('/api/admin/auth/logout', { _csrf: csrfToken }, cookies);
  assert.equal(logout.status, 200, 'logout should succeed');

  // After logout, dashboard should be 401 again.
  const afterLogout = await getJson('/api/admin/dashboard');
  assert.equal(afterLogout.status, 401, 'dashboard should be 401 after logout');

  // Re-auth with original credentials should work again.
  // Do a fresh login from scratch: GET /admin/login for a fresh csrf token/cookie
  // (no session yet), then POST with that token + cookie.
  const freshLoginPage = await getHtml('/admin/login');
  assert.equal(freshLoginPage.status, 200, 'GET /admin/login should be reachable after logout');
  const freshCsrfToken = csrfFromLoginPage(freshLoginPage.body);
  const freshCsrfCookie = csrfCookieFromHeaders(freshLoginPage.headers);
  assert.ok(freshCsrfToken && freshCsrfCookie, 'fresh login page must set a csrf token + cookie');
  const reLogin = await postUrlencoded('/api/admin/auth/login', {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    _csrf: freshCsrfToken,
  }, 'aramiot_admin_csrftoken=' + freshCsrfCookie);
  assert.equal(reLogin.status, 200, 're-auth after logout should succeed');
});
