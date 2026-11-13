# ARAMIOT

Public website, Express REST API, MongoDB and a Super Admin dashboard for
ARAMIOT (health · education · advocacy).

All three phases are complete:

- **Phase 1** — public website, Express REST API and MongoDB content
  architecture.
- **Phase 2** — Super Admin dashboard (authentication, protected routes, admin
  frontend, media contract).
- **Phase 3** — full-system integration and QA, security/database/performance
  audit and corrections, Quill rich-text editor on admin content forms, a
  Drive-ready media placeholder, and a testing report
  (`backend/Phase3-test-report.md`).

---

## 1. Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript (ES5-safe classic scripts), Bootstrap 5 (CDN), GSAP + ScrollTrigger (CDN), Lucide icons (CDN), Google Fonts |
| Admin frontend | HTML + Bootstrap 5 (CDN), Quill 2 (CDN) for rich-text fields, vanilla ES5-safe scripts |
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
#    then set MONGODB_URI (and the admin secrets) in .env

# 3. Insert the sample content (development only)
npm run seed

# 4. Start the site + API + admin on http://localhost:3000
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

### First Super Admin

```bash
npm run admin:init -- --username aramiot --email admin@aramiot.org --password 'SuperSecret1234!'
```

or `POST /api/admin/auth/init` with the `X-Admin-Init-Secret` header. Then sign
in at `http://localhost:3000/admin/login`.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the server (`backend/server.js`) |
| `npm run dev` | Start with `node --watch` (restarts on file changes) |
| `npm run dev:memory` | In-memory MongoDB + automatic sample seeding |
| `npm run seed` | Wipe content collections and insert sample content |
| `npm run seed -- --keep` | Insert sample content without deleting existing documents |
| `npm run admin:init` | Create the first Super Admin via the protected init endpoint |
| `npm test` | Run the test suite (21 tests: 19 Phase 1 API integration + 2 Phase 3 verification artifacts) |

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Production disables debug logging and enables static caching |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `MONGODB_URI` | — | MongoDB connection string (required) |
| `CORS_ORIGINS` | — | Comma separated browser origins allowed to call the API |
| `SERVE_FRONTEND` | `true` | Serve `frontend/` from Express so both share one origin |
| `SITE_URL` | `http://localhost:3000` | Public site URL for metadata |
| `USE_IN_MEMORY_DB` | `false` | Development only: in-memory MongoDB |
| `ADMIN_JWT_SECRET` | — | HMAC secret for admin session JWTs |
| `CSRF_SECRET` | — | HMAC secret for admin CSRF tokens |
| `ADMIN_INIT_SECRET` | — | Header secret for the protected admin init endpoint |
| `ADMIN_INIT_DISABLED` | `false` | Set to `true` to disable the init endpoint |

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
├── admin/                          Super Admin dashboard (Phases 2–3)
│   ├── dashboard.html              Stats + inbox tiles + content status
│   ├── account.html                Admin account (profile + password)
│   ├── organization.html           Institutional profile editor
│   ├── website-settings.html       Site settings editor
│   ├── pages.html                  Pages list + editor modal
│   ├── articles.html               Articles list + editor modal
│   ├── categories.html             Categories list + editor modal
│   ├── projects.html               Projects list + editor modal
│   ├── programs.html               Programmes list + editor modal
│   ├── team.html                   Team list + editor modal
│   ├── publications.html           Publications list + editor modal
│   ├── resources.html              Resources list + editor modal
│   ├── impact.html                 Impact statistics editor
│   ├── messages.html               Contact messages inbox
│   ├── applications.html           Volunteer applications inbox
│   ├── inquiries.html              Partnership inquiries inbox
│   ├── assets/
│   │   ├── css/admin.css           Admin design system
│   │   └── js/
│   │       ├── admin-api.js        Admin API client (session + CSRF)
│   │       ├── admin-auth.js       Login / session / CSRF helpers
│   │       ├── admin-dashboard.js  Dashboard render
│   │       ├── admin-content.js    Content lists + editor modal (Quill on richtext fields)
│   │       ├── admin-settings.js   Settings editors (Quill on richtext fields)
│   │       └── admin-richtext.js   Quill bridge + allow-list HTML sanitizer
│   └── components/                 Shared admin partials
│
├── backend/
│   ├── config/                     env + Mongo connection + shared constants
│   ├── models/                     14 Mongoose models (13 content + Admin) + shared schema fragments
│   ├── controllers/                One controller per public resource
│   ├── routes/                     Public API routers (/api) + admin routers (/api/admin)
│   ├── services/
│   │   ├── contentService.js       Shared list/detail/pagination/search logic
│   │   ├── contentHelpers.js       Admin CRUD allow-list + subdocument helpers
│   │   ├── modelsToFields.js       Per-model editable field descriptors
│   │   └── mediaService.js         Drive-ready media contract (placeholder)
│   ├── middleware/                 errors, 404, security headers, validation, admin auth
│   ├── validators/                 Contact / volunteer / partnership rules
│   ├── utils/                      ApiError, asyncHandler, auth, validation, query, slugify
│   ├── seed/                       Sample content + seeding CLI
│   ├── bin/init-admin.js           Create the first Super Admin
│   ├── tests/
│   │   ├── api.test.js             Phase 1 public API integration suite (19 tests)
│   │   ├── admin-lifecycle.test.js Phase 3 admin lifecycle verification (in-memory DB + real HTTP)
│   │   └── csrf-probe.test.js      Phase 3 CSRF session-identifier probe
│   ├── app.js                      Express application
│   ├── server.js                   Entry point (DB connect → listen → shutdown)
│   └── Phase3-test-report.md       Phase 3 testing / audit report
│
├── .github/workflows/              Node.js CI (install + test)
├── .env.example
├── package.json
└── README.md
```

`frontend/`, `admin/` and `backend/` are separate modules that communicate only
through the REST API. No HTML file contains content that should be editable, and
no frontend or admin file contains database or auth credentials.

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

### Admin API (`/api/admin/*`)

Every route is behind `requireAdmin` except the auth endpoints
(`/api/admin/auth/csrf-token`, `/session`, `POST /login`, `POST /logout`,
`POST /init`). Writes also require a valid CSRF token.

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/admin/auth/csrf-token` | Fresh submit token + CSRF cookie |
| GET | `/api/admin/auth/session` | Current session state |
| POST | `/api/admin/auth/login` | urlencoded `username` (username **or** account email), `password`, `_csrf` |
| POST | `/api/admin/auth/logout` | Clears the session cookie |
| POST | `/api/admin/auth/init` | Creates the first Super Admin (`X-Admin-Init-Secret`) |
| GET | `/api/admin/dashboard` | MongoDB-backed statistics |
| GET/POST | `/api/admin/{pages,articles,categories,projects,programs,team,publications,resources,impact}` | List (paginated, searchable) + create |
| GET/PUT/DELETE | `/api/admin/{type}/id/:id`, `/api/admin/{type}/:id` | Detail + update + archive |
| GET/PUT | `/api/admin/messages`, `/api/admin/applications`, `/api/admin/inquiries` | Inbox: list, status update, delete |
| GET/PUT | `/api/admin/organization`, `/api/admin/website-settings`, `/api/admin/account` | Settings |
| POST | `/api/admin/account/password` | Change password (rotates session) |
| POST | `/api/admin/media/upload` | Drive-ready media placeholder (rejects with a clear message) |

---

## 5. Content model

14 collections: `Organization`, `Page`, `Article`, `Category`, `Project`,
`Program`, `TeamMember`, `Publication`, `Resource`, `ImpactStatistic`,
`ContactMessage`, `VolunteerApplication`, `PartnershipInquiry`, `Admin`.

* Editorial status is shared by all content collections: `draft` → `published` →
  `archived`.
* Slugs are unique, lowercase and validated against `^[a-z0-9]+(?:-[a-z0-9]+)*$`;
  a `pre('validate')` hook generates one from the title when missing.
* Category references are `ObjectId` references (never duplicated documents);
  `Article`, `Project`, `Program`, `Publication` and `Resource` each point at a
  `Category`, and categories can be nested one level via `parentCategory`.
* Public GET routes return **published** documents only. Content with a future
  `publishedAt` / `publicationDate` stays hidden. Publishing from the dashboard
  stamps that date automatically when none is given, and a published document
  whose date is still missing stays hidden.
* `Organization` is a single document edited from the admin dashboard.
* `Admin` holds Super Admin accounts only (`username` and `email` unique,
  `passwordHash` bcrypt with 12 rounds and `select: false`, `role` only
  `super_admin`, `isActive`, `lastLogin`). There is no public route that touches
  this collection and `passwordHash` never leaves the server.
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
* impact statistics are `0` with a description saying the figure is not verified;
* one draft article and one future-dated article are included so the
  "must stay hidden" rules are visible in development.

Replace all of it through the Super Admin dashboard before launch.

---

## 7. Security notes

* Credentials live only in `.env`; `.env` is git-ignored and never sent to the
  browser.
* MongoDB is reached only from the backend; neither frontend has database access.
* Public GET routes are restricted to published content, with allow-listed sort
  fields and bounded pagination.
* Public POST bodies are validated against a rule map and sanitised (control
  characters and tag-like sequences removed) before reaching Mongoose.
* Admin sessions are HTTP-only JWT cookies (`aramiot_admin_session`,
  `SameSite=Lax`, `Secure` in production, 8 h lifetime). The CSRF cookie
  (`aramiot_admin_csrftoken`) is readable by admin JS by design.
* Admin writes require both the session cookie and a double-submit CSRF token;
  login and the init endpoint are rate limited to 10 attempts per 15 minutes per
  IP.
* Admin updates are filtered through a per-model field allow-list
  (`services/modelsToFields.js` + `ALLOWED_UPDATE_KEYS`), which is the NoSQL
  injection defence on the write path; public queries use allow-listed sort
  fields and escaped search regexes.
* Admin HTML is not served by a broad `express.static`: `/admin/login` is always
  reachable, every other `/admin/*` page requires a valid session, admin pages
  are `noindex,nofollow`, and admin assets are served same-origin only.
* `helmet` is enabled in production; standard `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` headers are set.

### Phase 3 corrections (found during audit)

* `backend/config/env.js` did not export `adminInitSecret` /
  `adminInitDisabled`, so the init endpoint always answered 403.
* `backend/routes/admin.routes.js` used `config`, `verifyPassword`,
  `hashPassword`, `mintSession` and `setSessionCookie` without importing them
  (dashboard and password change returned 500).
* `csrf-csrf` v4 defaults to reading the submit token from the `X-Csrf-Token`
  header while the admin client sends `_csrf` in the body; `getCsrfTokenFromRequest`
  is now configured to read the body (and still accept the header).
* `services/modelsToFields.js` excluded every path on Mongoose 8.x because all
  paths carry `_presplitPath`; it now excludes only genuinely nested paths, which
  restored admin create/update.
* `ALLOWED_UPDATE_KEYS` was missing `section`, `contactEmail` and `scopes`, so
  those admin edits were silently dropped.
* The `/admin/*` HTML fallback passed the unstripped URL to `express.static`
  (looking for `admin/admin/<page>.html`); it now resolves paths explicitly with
  a traversal check.
* `frontend/config/config.js` and `backend/bin/init-admin.js` still pointed at
  port 5000; both now use 3000.
* Publishing a page or article from the dashboard never set `publishedAt`, and
  the public filter requires a date, so newly published admin content silently
  stayed invisible on the public site. `applyPublishDate` now stamps the date on
  create/update (an explicit date is left alone, so scheduling still works).
* Login only matched `username`; it now also matches the account email address.

### Known gaps

* No live Google Drive integration yet: `mediaService.js` is the contract and
  `/api/admin/media/upload` returns a clear "not implemented in this phase"
  response.
* Rich-text HTML is sanitised in the browser (allow-list based). An authoritative
  server-side sanitizer is still recommended before accepting HTML from admins.
* No CSP with nonces, and no rate limiting on admin writes beyond login/init.

---

## 8. Tests

```bash
npm test
```

The suite starts the real Express app against an in-memory MongoDB, seeds the
sample content and exercises the stack over HTTP (21 tests):

* **19 Phase 1 public API tests** — published-only visibility, pagination,
  search, category filtering, validation failures, JSON 404s, and persistence of
  all three POST endpoints.
* **`backend/tests/admin-lifecycle.test.js`** — a self-contained admin lifecycle
  over real HTTP: init, unauthenticated 401s, login with CSRF, dashboard, page
  create/list/detail/edit/publish/unpublish, public↔admin sync (draft hidden,
  published visible), archive, contact inbox create/list/status/delete, account
  get/put, password change + re-login, logout + re-auth, and the media
  placeholder.
* **`backend/tests/csrf-probe.test.js`** — pins the CSRF session-identifier
  rules (token generation and validation must use the same identifier).

The two Phase 3 files are verification artifacts rather than part of the shipped
Phase 1 suite, but they run under the same `node --test` glob.

---

## 9. Phases

### Phase 1 — Public website, API and database (complete)

The public website (12 pages), the backend foundation, the 13 content models and
the REST API. The data model was shaped so Phase 2 could add an admin layer
without migrations.

### Phase 2 — Super Admin dashboard (complete)

* **Admin model** — `backend/models/Admin.js`.
* **Auth** — HTTP-only JWT session cookie, CSRF double-submit tokens, per-IP
  login rate limiting, logout, session expiry.
* **Protected routes** — dashboard statistics, CRUD on every content collection,
  the three inboxes, organization / website settings and account settings, all
  behind `requireAdmin`.
* **Admin frontend** — `admin/` with login, dashboard, editors for all content
  types, inbox readers, settings and account/password pages, served under
  `/admin/*` by the same Express app.
* **Media contract** — `backend/services/mediaService.js` plus the guarded
  `/api/admin/media/upload` endpoint.

### Phase 3 — Integration, QA, audit and corrections (complete)

* **Integration** — one Express app, one Mongo connection and one model set
  shared by the public site and the dashboard; proven end-to-end by the admin
  lifecycle test.
* **Public site QA** — all 12 pages checked for structure, navigation, API
  wiring, loading/empty/error states, search, forms and image fallbacks.
* **Admin QA** — login, dashboard statistics, content create/edit/delete,
  publish/unpublish, archive, media, website settings, contact messages,
  volunteer applications and partnership inquiries.
* **Synchronisation** — draft, archived and future-dated content stay out of
  public listings; published content appears immediately.
* **Security audit** — auth/authz middleware, bcrypt hashing, session and cookie
  flags, CSRF, CORS, validation, NoSQL injection defence, rate limiting,
  file-upload validation, env handling and admin file exposure.
* **Database audit** — all 14 models reviewed for required fields, types,
  validation, unique indexes, relationships, slug generation, timestamps,
  duplicate prevention, pagination and search. No schema or data changes, so no
  migration is required.
* **Performance audit** — no wasteful request patterns; two items flagged
  (image size caps / resized variants, and a real Lighthouse run).
* **Rich-text editor** — Quill on long-form admin HTML fields only, wired
  through `admin-richtext.js` (attach on modal open, sync on save, reattach after
  re-render, allow-list sanitizer as a first line). Short fields stay plain text.
* **Report** — `backend/Phase3-test-report.md`.

Visual/pixel verification in a real browser and in-browser clicking through the
admin UI remain manual follow-ups; everything server-side was actually tested.

---

## Not yet done

* Live Google Drive integration (service account or per-admin OAuth, resumable
  uploads, thumbnails, signed/preview URLs). The contract, the guarded endpoint
  and the `fileId` / `fileUrl` / `fileProvider` fields are already in place.
* Server-side HTML sanitisation as the authoritative check for admin-authored
  rich text.
* Content-Security-Policy with nonces, and rate limiting on admin writes beyond
  the login/init limiter.
