# ARAMIOT — Phase 1

Public website, Express REST API and MongoDB content architecture for ARAMIOT
(health · education · advocacy).

Phase 1 covers the public website, the backend foundation, the database models
and the REST API only. The admin dashboard, authentication and administrator
login are deliberately **not** part of this phase; the data model is shaped so
Phase 2 can add them without migrations.

---

## 1. Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript (ES5-safe classic scripts), Bootstrap 5 (CDN), GSAP + ScrollTrigger (CDN), Lucide icons (CDN), Google Fonts |
| Backend | Node.js, Express 4, REST JSON API |
| Database | MongoDB + Mongoose 8 |
| Config | dotenv (`.env`), no credentials in source |
| Tests | `node:test` + `mongodb-memory-server` |

Requires Node.js 18 or newer (developed and tested on Node 26) and either a
local MongoDB Community Edition server or a connection string to one.

---

## 2. Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
#    then set MONGODB_URI in .env

# 3. Insert the sample content (development only)
npm run seed

# 4. Start the site + API on http://localhost:5000
npm start
```

### Option: no local MongoDB

To review the site without installing MongoDB, start a throw-away in-memory
database that is seeded automatically:

```bash
npm run dev:memory
```

Data is discarded when the process stops. The `mongodb-memory-server` package
downloads a MongoDB binary the first time it runs.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the server (`backend/server.js`) |
| `npm run dev` | Start with `node --watch` (restarts on file changes) |
| `npm run dev:memory` | In-memory MongoDB + automatic sample seeding |
| `npm run seed` | Wipe content collections and insert sample content |
| `npm run seed -- --keep` | Insert sample content without deleting existing documents |
| `npm test` | Run the Phase 1 API integration suite (19 tests) |

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Production disables debug logging and enables static caching |
| `PORT` | `5000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `MONGODB_URI` | — | MongoDB connection string (required) |
| `CORS_ORIGINS` | — | Comma separated browser origins allowed to call the API |
| `SERVE_FRONTEND` | `true` | Serve `frontend/` from Express so both share one origin |
| `SITE_URL` | `http://localhost:5000` | Public site URL for metadata |
| `USE_IN_MEMORY_DB` | `false` | Development only: in-memory MongoDB |

When the frontend is served by Express, the API base URL is resolved
automatically from `window.location.origin` (`/api`). If you host the frontend
elsewhere, set `API_BASE_URL` in `frontend/config/config.js` and add that origin
to `CORS_ORIGINS`.

---

## 3. Project structure

```
.
├── frontend/
│   ├── index.html                  Home
│   ├── 404.html                    Not found
│   ├── pages/
│   │   ├── overview.html           About us → Overview
│   │   ├── about.html              About us → Story, mission, team
│   │   ├── health.html             Health
│   │   ├── education.html          Education
│   │   ├── advocacy.html           Advocacy
│   │   ├── our-work.html           Projects + programmes + impact
│   │   ├── resources.html          Learning materials + publications
│   │   ├── publications.html       Publications library
│   │   ├── get-involved.html       Volunteer + partnership forms
│   │   └── contact.html            Contact details + contact form
│   ├── components/                 Reusable UI (header, footer, dialogs, cards)
│   ├── assets/css/styles.css       Design system
│   ├── assets/js/                  api client, page renderers, forms
│   └── config/config.js            API base URL and site settings
│
├── backend/
│   ├── config/                     env + Mongo connection + shared constants
│   ├── models/                     13 Mongoose models + shared schema fragments
│   ├── controllers/                One controller per resource
│   ├── routes/                     API routers (mounted at /api)
│   ├── services/contentService.js  Shared list/detail/pagination/search logic
│   ├── middleware/                 errors, 404, security headers, body validation
│   ├── validators/                 Contact / volunteer / partnership rules
│   ├── utils/                      ApiError, asyncHandler, validation, query, slugify
│   ├── seed/                       Sample content + seeding CLI
│   ├── tests/api.test.js           Integration tests
│   ├── app.js                      Express application
│   └── server.js                   Entry point (DB connect → listen → shutdown)
│
├── .env.example
├── package.json
└── README.md
```

Frontend and backend are separate modules that communicate only through the REST
API. No HTML file contains content that should be editable, and no frontend file
contains database credentials.

---

## 4. Public API

Base URL: `/api`. All responses are JSON.

**Success**

```json
{ "success": true, "data": {}, "meta": { }, "message": "optional" }
```

**Error**

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "field": "email", "message": "…" }] } }
```

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/health` | Liveness + database state (503 when disconnected) |
| GET | `/api` | Endpoint index |
| GET | `/api/organization` | Institutional profile |
| GET | `/api/pages` | `?section=health` |
| GET | `/api/pages/:slug` | Published page + editable content |
| GET | `/api/articles` | `?search=&category=<slug>&tag=&page=&limit=&sort=` |
| GET | `/api/articles/:slug` | |
| GET | `/api/categories` | `?scope=articles\|projects\|programs\|publications\|resources` |
| GET | `/api/projects` | `?search=&category=&page=&limit=&sort=` |
| GET | `/api/projects/:slug` | |
| GET | `/api/programs` | `?search=&category=&page=&limit=&sort=` |
| GET | `/api/programs/:slug` | |
| GET | `/api/team` | Ordered by `displayOrder` |
| GET | `/api/publications` | `?search=&category=&publicationType=&page=&limit=&sort=` |
| GET | `/api/publications/:slug` | |
| GET | `/api/resources` | `?search=&category=&resourceType=&page=&limit=&sort=` |
| GET | `/api/resources/:slug` | |
| GET | `/api/impact` | Published impact statistics only |
| POST | `/api/contact` | Contact form |
| POST | `/api/volunteers` | Volunteer application |
| POST | `/api/partnerships` | Partnership inquiry |

Listing responses include `meta`: `{ page, limit, total, pages, hasNextPage, hasPrevPage, sort, search }`.
`limit` defaults to 12 and is capped at 100; `page`, `limit` and `sort` are
validated and rejected with `400` when invalid.

---

## 5. Content model

13 collections: `Organization`, `Page`, `Article`, `Category`, `Project`,
`Program`, `TeamMember`, `Publication`, `Resource`, `ImpactStatistic`,
`ContactMessage`, `VolunteerApplication`, `PartnershipInquiry`.

* Editorial status is shared by all content: `draft` → `published` → `archived`.
* Slugs are unique, lowercase and validated against `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
* Category references are `ObjectId` references (never duplicated documents);
  `Article`, `Project`, `Program`, `Publication` and `Resource` each point at a
  `Category`, and categories can be nested one level via `parentCategory`.
* Public GET routes return **published** documents only. Content with a future
  `publishedAt` / `publicationDate` stays hidden, and a published document with
  no date is visible.
* `Organization` is a single document edited by the future Super Admin.
* `Publication.fileId` / `Resource.fileId` and `fileProvider` are reserved for
  the Google Drive integration.
* `ImpactStatistic` values are never generated by the application. A statistic
  is public only when `isPublished` is true; seeded rows use value `0` and an
  explicit "not verified" description.

### Indexes

Unique slug indexes on every content collection; compound indexes for the
listing queries (`status + date`, `category + status + date`), `displayOrder`
for team and impact, `tags` for articles, and `status + createdAt` for the three
submission collections.

---

## 6. Sample data

`backend/seed/sampleData.js` inserts clearly labelled **development-only**
content:

* organization name, mission, vision and values are placeholder text;
* team profiles are "Sample Team Member" placeholders;
* article and page bodies begin with a "Sample content for development" notice;
* impact statistics are `0` with a description saying the figure is not verified.

Replace all of it through the Phase 2 admin dashboard before launch.

---

## 7. Security notes (Phase 1)

* Credentials live only in `.env`; `.env` is git-ignored and never sent to the browser.
* MongoDB is reached only from the backend; the frontend has no database access.
* Public GET routes are restricted to published content, with allow-listed sort
  fields and bounded pagination.
* Public POST bodies are validated against a rule map and sanitised (control
  characters and HTML tags removed) before reaching Mongoose.
* Mongoose schema validation is a second line of defence; errors are normalised
  into one JSON shape.
* `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
  `Permissions-Policy` headers are set. A full Content-Security-Policy, rate
  limiting and CAPTCHA/spam protection are Phase 2 work, as is admin auth.

---

## 8. Tests

```bash
npm test
```

The suite starts the real Express app against an in-memory MongoDB, seeds the
sample content and exercises every public endpoint over HTTP: published-only
visibility, pagination, search, category filtering, validation failures, JSON
404s, and that all three POST endpoints persist correctly.

---

## 9. Phase 2 readiness

* Every content model already supports create/edit/delete, draft/publish/archive,
  featured images, SEO fields, categories, tags and publication dates.
* `ContactMessage`, `VolunteerApplication` and `PartnershipInquiry` are stored for
  the admin inbox; they have no public read route.
* Authentication can be added as Express middleware in front of new
  `/api/admin/*` routers without touching the public controllers.
* Google Drive upload can populate `fileId` / `fileProvider` on `Publication`,
  `Resource` and `mediaSchema` without schema changes.

### Phase 2 — Super Admin dashboard (in progress)

A separate Super Admin dashboard has been added in the `admin/` directory and
wired into the same Express app:

* **Admin model** — `backend/models/Admin.js`: `username` (unique), `email`
  (unique), `passwordHash` (bcrypt, excluded from all API responses), `role`
  (only `super_admin`), `isActive`, `lastLogin`, timestamps.
* **Auth** — cookie-based sessions via a short-lived HTTP-only JWT (`aramiot_admin_session`),
  CSRF double-submit tokens, per-IP login rate limiting (10 attempts / 15 min),
  session expiry, logout that clears the cookie.
* **Protected routes** — `GET /api/admin/dashboard` (real MongoDB statistics),
  full CRUD on every content collection, inbox reads/status updates for the three
  submission collections, organization + website-settings + account-settings,
  all behind `requireAdmin`.
* **Security** — `helmet` in production, cookie-parser, CSRF on writes, NoSQL
  injection mitigation (admin updates filtered through an allow-list of known
  model fields), error handler unchanged.
* **Init** — `node backend/bin/init-admin.js --username X --email X --password X`
  creates the first Super Admin through the protected init endpoint (requires
  `ADMIN_INIT_SECRET`).

Required env vars (add to `.env`): `ADMIN_JWT_SECRET`, `CSRF_SECRET`,
`ADMIN_INIT_SECRET`, `ADMIN_INIT_DISABLED`. See `.env.example`.

**Not yet done:** Google Drive upload is represented by a pending integration
note in the admin media interface; a full admin content editor UI, rich-text
admin authoring, CSP nonces and rate limiting on admin writes are Phase 3 work.
