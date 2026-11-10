'use strict';

/**
 * Phase 1 API integration tests.
 *
 * Runs the real Express app against a throw-away in-memory MongoDB, seeded with
 * the sample content set, and exercises every public endpoint over HTTP.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.SERVE_FRONTEND = 'false';

const app = require('../app');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const { seedDatabase } = require('../seed/sampleData');
const ContactMessage = require('../models/ContactMessage');
const VolunteerApplication = require('../models/VolunteerApplication');
const PartnershipInquiry = require('../models/PartnershipInquiry');

let mongoServer;
let httpServer;
let baseUrl;

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

function postJson(path, payload) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('aramiot_test'));
  await seedDatabase({ clear: true });

  httpServer = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    httpServer.once('listening', resolve);
    httpServer.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

test.after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await disconnectDatabase();
  if (mongoServer) await mongoServer.stop();
});

test('GET /api/health reports a connected database', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.database, 'connected');
});

test('GET /api returns the endpoint index', async () => {
  const { status, body } = await api('/api');
  assert.equal(status, 200);
  assert.ok(body.data.endpoints.read.includes('GET /api/articles'));
});

test('GET /api/organization returns the seeded profile', async () => {
  const { status, body } = await api('/api/organization');
  assert.equal(status, 200);
  assert.equal(body.data.name, 'ARAMIOT');
  assert.match(body.data.mission, /healthier, educated/i);
});

test('GET /api/pages returns only published pages with pagination metadata', async () => {
  const { status, body } = await api('/api/pages?limit=3&page=1');
  assert.equal(status, 200);
  assert.equal(body.data.length, 3);
  assert.equal(body.meta.limit, 3);
  assert.equal(body.meta.page, 1);
  assert.ok(body.meta.total >= 9);
  assert.equal(body.meta.hasPrevPage, false);
  assert.equal(body.meta.hasNextPage, true);
  for (const page of body.data) assert.equal(page.status, 'published');
});

test('GET /api/pages/:slug returns editable page content', async () => {
  const { status, body } = await api('/api/pages/health');
  assert.equal(status, 200);
  assert.equal(body.data.section, 'health');
  assert.match(body.data.content, /Disease Prevention/);
});

test('GET /api/pages/:slug returns 404 for an unknown slug', async () => {
  const { status, body } = await api('/api/pages/does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('GET /api/pages/:slug rejects a malformed slug with 400', async () => {
  const { status, body } = await api('/api/pages/Not_A_Slug!');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('GET /api/articles hides drafts and scheduled articles', async () => {
  const { status, body } = await api('/api/articles?limit=100');
  assert.equal(status, 200);

  const slugs = body.data.map((article) => article.slug);
  assert.ok(slugs.includes('community-health-awareness-local-conversations'));
  assert.ok(!slugs.includes('draft-article-internal-review'), 'draft article leaked');
  assert.ok(!slugs.includes('scheduled-announcement-next-season'), 'scheduled article leaked');
  assert.equal(body.meta.total, 5);
  assert.ok(body.data.every((article) => article.status === 'published'));
});

test('GET /api/articles supports search, category filter and sorting', async () => {
  const search = await api('/api/articles?search=mental%20health');
  assert.equal(search.status, 200);
  assert.equal(search.body.data.length, 1);
  assert.equal(search.body.data[0].slug, 'mental-health-literacy-community-settings');

  const byCategory = await api('/api/articles?category=advocacy');
  assert.equal(byCategory.status, 200);
  assert.equal(byCategory.body.data.length, 1);
  assert.equal(byCategory.body.data[0].category.slug, 'advocacy');

  const sorted = await api('/api/articles?sort=title&limit=100');
  assert.equal(sorted.status, 200);
  const titles = sorted.body.data.map((article) => article.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
});

test('GET /api/articles rejects invalid paging and sort input', async () => {
  const badLimit = await api('/api/articles?limit=500');
  assert.equal(badLimit.status, 400);
  assert.match(badLimit.body.error.message, /limit must be between 1 and 100/i);

  const badSort = await api('/api/articles?sort=secretField');
  assert.equal(badSort.status, 400);
  assert.match(badSort.body.error.message, /sort must be one of/i);

  const badPage = await api('/api/articles?page=abc');
  assert.equal(badPage.status, 400);
});

test('GET /api/categories filters by scope and exposes the hierarchy', async () => {
  const { status, body } = await api('/api/categories?scope=publications');
  assert.equal(status, 200);
  const slugs = body.data.map((category) => category.slug);
  assert.ok(slugs.includes('reports'));
  assert.ok(!slugs.includes('guidelines'));

  const all = await api('/api/categories');
  const mentalHealth = all.body.data.find((category) => category.slug === 'mental-health');
  assert.equal(mentalHealth.parentCategory.slug, 'health');
});

test('GET /api/projects, /api/programs and /api/team return published content', async () => {
  const projects = await api('/api/projects');
  assert.equal(projects.status, 200);
  assert.equal(projects.body.data.length, 3);
  assert.equal(projects.body.data[0].category.slug, 'education'); // newest startDate after sort? see below

  const programs = await api('/api/programs');
  assert.equal(programs.status, 200);
  assert.equal(programs.body.data.length, 2);

  const team = await api('/api/team');
  assert.equal(team.status, 200);
  assert.equal(team.body.data.length, 3);
  assert.equal(team.body.data[0].position, 'Executive Director');
});

test('GET /api/publications and /api/resources support filters', async () => {
  const publications = await api('/api/publications?publicationType=policy-brief');
  assert.equal(publications.status, 200);
  assert.equal(publications.body.data.length, 1);
  assert.equal(publications.body.data[0].slug, 'policy-brief-youth-participation');

  const resources = await api('/api/resources?resourceType=guideline');
  assert.equal(resources.status, 200);
  assert.equal(resources.body.data.length, 1);
  assert.equal(resources.body.data[0].category.slug, 'guidelines');
});

test('GET /api/impact returns published statistics only', async () => {
  const { status, body } = await api('/api/impact');
  assert.equal(status, 200);
  assert.equal(body.data.length, 4);
  assert.ok(body.data.every((statistic) => statistic.isPublished === true));
  assert.equal(body.data[0].title, 'People reached');
});

test('POST /api/contact saves a validated message', async () => {
  const before = await ContactMessage.countDocuments();

  const { status, body } = await postJson('/api/contact', {
    name: 'Sample Sender',
    email: 'SAMPLE@example.org',
    subject: 'Partnership question',
    message: 'This is a sample enquiry used by the automated test suite.',
  });

  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.id);
  assert.equal(await ContactMessage.countDocuments(), before + 1);

  const saved = await ContactMessage.findById(body.data.id).lean();
  assert.equal(saved.email, 'sample@example.org'); // normalised
  assert.equal(saved.status, 'new');
});

test('POST /api/contact rejects invalid input with field-level details', async () => {
  const { status, body } = await postJson('/api/contact', {
    name: 'A',
    email: 'not-an-email',
    subject: '',
    message: 'short',
  });

  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  const fields = body.error.details.map((detail) => detail.field);
  assert.ok(fields.includes('email'));
  assert.ok(fields.includes('subject'));
  assert.ok(fields.includes('message'));

  const after = await ContactMessage.countDocuments();
  const repeated = await postJson('/api/contact', { name: 'A' });
  assert.equal(repeated.status, 400);
  assert.equal(await ContactMessage.countDocuments(), after);
});

test('POST /api/volunteers validates the area of interest and stores the application', async () => {
  const invalid = await postJson('/api/volunteers', {
    fullName: 'Sample Volunteer',
    email: 'volunteer@example.org',
    areaOfInterest: 'astrophysics',
    motivation: 'I would like to contribute to community health work.',
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

  const valid = await postJson('/api/volunteers', {
    fullName: 'Sample Volunteer',
    email: 'volunteer@example.org',
    phone: '+000 000 0000',
    areaOfInterest: 'health',
    experience: 'Sample experience text.',
    motivation: 'I would like to contribute to community health work.',
  });
  assert.equal(valid.status, 201);
  assert.equal(await VolunteerApplication.countDocuments(), 1);

  const saved = await VolunteerApplication.findById(valid.body.data.id).lean();
  assert.equal(saved.areaOfInterest, 'health');
});

test('POST /api/partnerships stores an inquiry and strips markup', async () => {
  const { status, body } = await postJson('/api/partnerships', {
    organizationName: 'Sample Partner Organization',
    contactPerson: 'Sample Contact',
    email: 'partner@example.org',
    subject: 'Joint initiative',
    message: '<script>alert(1)</script>We would like to discuss a joint community initiative.',
  });

  assert.equal(status, 201);
  const saved = await PartnershipInquiry.findById(body.data.id).lean();
  assert.ok(!saved.message.includes('<script>'), 'markup was not sanitised');
  assert.match(saved.message, /joint community initiative/);
});

test('unknown API endpoints return a JSON 404', async () => {
  const { status, body } = await api('/api/not-a-real-endpoint');
  assert.equal(status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');
});
