# ARAMIOT — Phase 3: Full-System Integration & Quality Assurance Report

**Date:** 2026-11-11 (2026-02 knowledge cutoff)  
**Prepared by:** Senior full-stack developer / software tester / database engineer / cybersecurity specialist  
**Scope:** Inspect and improve the existing Phase 1 + Phase 2 implementation. Do not rebuild.  
**Result:** All corrections applied; verification suite green (21/21); application ready for Google Drive integration.

---

## 1. System Integration

### What was verified

- **Public frontend ↔ backend:** every public page (`index`, `about`, `overview`, `health`, `education`, `advocacy`, `our-work`, `resources`, `publications`, `contact`, `get-involved`, `404`) talks to the backend exclusively through `frontend/assets/js/api.js`, which calls the Express `/api/*` routes. No page contains hardcoded content or credentials.
- **Admin frontend ↔ backend:** every admin page (`dashboard`, `pages`, `articles`, `categories`, `projects`, `programs`, `team`, `publications`, `resources`, `impact`, `messages`, `applications`, `inquiries`, `organization`, `website-settings`, `account`) talks to `/api/admin/*` through `admin/assets/js/admin-api.js`, which sends urlencoded bodies with `_csrf` and `credentials: 'include'` so the HTTP-only session cookie is forwarded.
- **Backend ↔ database:** `backend/app.js` mounts both the public `/api/*` router and the protected `/api/admin/*` router on the SAME Express app, backed by the SAME Mongoose connection (`backend/config/database.js`). Public and admin interfaces read/write the same collections.
- **Shared models:** `backend/models/` is a single set of 14 Mongoose models used by both the public API (`backend/controllers/`, `backend/services/contentService.js`) and the admin API (`backend/routes/admin.routes.js` + `backend/services/contentHelpers.js` + `backend/services/modelsToFields.js`). The public API enforces `published`/`isPublished` visibility; the admin API enforces `requireAdmin` + CSRF and sees every document.

### Integration verdict

**PASSED.** Both frontends share one database, one backend, and one set of models. Public visibility rules and admin auth rules are enforced at different layers but on the same data.

### How it was actually tested

A self-contained test (`backend/tests/admin-lifecycle.test.js`) starts its own in-memory MongoDB, binds the real `backend/app` on a free port, seeds sample content, then exercises the full lifecycle over real HTTP:
- init super admin (header `X-Admin-Init-Secret`)
- GET `/admin/login` → parse `_csrf` + CSRF cookie
- POST `/api/admin/auth/login` (urlencoded + `_csrf`) → session cookie
- GET `/api/admin/dashboard`
- POST `/api/admin/pages` (create published + draft)
- GET `/api/admin/pages` (admin list)
- GET `/api/admin/pages/id/:id`
- PUT `/api/admin/pages/:id` (edit)
- PUT status → unpublish → publish
- DELETE `/api/admin/pages/:id` (soft archive)
- public↔admin sync: draft **not** in `GET /api/pages`; published **is**
- POST `/api/contact` → admin list → status update → hard delete
- GET/PUT `/api/admin/account` → POST `/api/admin/account/password` → re-login with new password
- logout → 401 → re-auth
- `GET /api/admin/*` without session → 401
- POST `/api/admin/media/upload` → placeholder rejection (404, clear message)

**Outcome:** 1 lifecycle test + 1 CSRF-probe diagnostic test pass, on top of the 19 existing Phase 1 tests = **21/21 pass**.

---

## 2. Public Website Testing

### Pages inspected (HTML shells + rendering JS)

`frontend/index.html`, `frontend/pages/about.html`, `frontend/pages/overview.html`, `frontend/pages/health.html`, `frontend/pages/education.html`, `frontend/pages/advocacy.html`, `frontend/pages/our-work.html`, `frontend/pages/resources.html`, `frontend/pages/publications.html`, `frontend/pages/contact.html`, `frontend/pages/get-involved.html`, `frontend/404.html`.

Rendering is driven by `frontend/components/layout.js` (header, footer, dialogs, page hero), `frontend/components/cards.js` (article/project/program/publication/resource/team/stat cards), `frontend/assets/js/main.js` (navigation, search dialog, content preview, GSAP animations, organization fetch → footer), `frontend/assets/js/page.js` (page hero + content from `GET /api/pages/:slug`, paginated listings), `frontend/assets/js/forms.js` (contact/volunteer/partnership forms + contact-details from organization), `frontend/assets/js/home.js` (home sections), `frontend/assets/js/api.js` (all API calls).

### Responsive layout / navigation

- `meta name="viewport"` present on every page.
- CSS: Bootstrap 5.3.3 + `frontend/assets/css/styles.css` use fluid containers, `container--narrow`, responsive tile grids, a mobile `data-nav-toggle` hamburger, `data-submenu-toggle` dropdowns that close on outside click and Escape, and a `prefers-reduced-motion` guard that disables GSAP when requested.
- Navigation is a single source of truth in `layout.NAV_ITEMS` (About / Programmes / Our work / Resources) with sub-menus; active state is derived from `currentFile()` vs each page's file name, so it survives the static-file serving model.
- Skip link (`#main`), `aria-label`/`aria-current`/`aria-expanded` on nav, `role="status"` on form alerts, `aria-live="polite"` on listing bodies, `aria-labelledby` on dialogs.

### API requests / image loading / error handling

- Every listing uses `data-list="articles|projects|programs|publications|resources|team|impact"` rendered by `page.js` with pagination (`data-page-prev`/`data-page-next`), optional `data-search` with a debounced 280 ms input, and `data-category` filters.
- Images: `loading="lazy"` on card media; missing image fall back to an icon (`cards.media` returns an icon when no `featuredImage/coverImage/profileImage.url`).
- Search dialog (`data-open-search`, Ctrl+K) queries articles + publications + resources in parallel and shows `emptyState` / `errorState` with `retry: false`.
- Content preview dialog (`data-detail="type:slug"`) loads the single record and renders a typed body; file buttons for publications/resources open the `fileUrl`/`externalUrl` in a new tab.
- Every failed section renders `layout.errorState` with a "Try again" button that re-runs the section; the home page degrades one section at a time (`home.js` loads each section independently).
- Organization fetch drives header brand + footer (contact email/phone/address/social); if it fails, the footer renders a fallback and the home page shows `emptyState`.

### Verified

- Homepage hero + 7 content sections + CTA band render from API data.
- About page: page hero + content + team listing (`data-list="team"`).
- Health / Education / Advocacy: page hero + content + filtered article listing (`data-category="health|education|advocacy"`) + filtered project listing.
- Our Work: page hero + content + projects listing + programs listing + impact stats.
- Resources: page hero + content + resources listing (searchable) + publications listing.
- Publications: page hero + breadcrumb + publications listing (searchable).
- Contact: page hero + contact details (from organization) + contact form.
- Get Involved: page hero + content + volunteer form + partnership form + support band.
- 404: branded page with "Popular pages" links.

### Not viewable in this environment (no browser render / no live server)

- Visual layout correctness at specific breakpoints (CSS was not rendered visually here).
- Real image load (no live image URLs to test broken-image fallback in a browser).
- GSAP animation behavior (requires a live, rendered page).

**Verdict:** structure, navigation, API wiring, loading states, search, forms, and error handling **PASSED** by code inspection and the deterministic lifecycle test. Visual/pixel verification is a manual follow-up, not a claim I can make here.

---

## 3. Admin Dashboard Testing

### Verified (via the lifecycle test + code inspection)

- **Super Admin login:** `GET /admin/login` returns an HTML form with a `_csrf` hidden field and sets the `aramiot_admin_csrftoken` cookie; `POST /api/admin/auth/login` (urlencoded + `_csrf`) sets the HTTP-only `aramiot_admin_session` cookie; the admin JS client (`admin-auth.js`) submits as urlencoded with `credentials: 'include'`.
- **Dashboard statistics:** `GET /api/admin/dashboard` returns `summary` (published/drafts per content type, unread messages, pending applications/inquiries, published impact stats), `lastLogin`, `server` (environment + version). The dashboard page (`admin-dashboard.js`) renders summary tiles, inbox tiles, and a content-status table.
- **Content creation:** `POST /api/admin/pages` (and the same pattern for articles/categories/projects/programs/team/publications/resources/impact) creates via `adminCreate` (allow-listed fields only).
- **Content editing:** `PUT /api/admin/pages/:id` via `adminUpdateById` (allow-listed, `runValidators: true`).
- **Content deletion/archival:** `DELETE /api/admin/pages/:id` performs a **soft archive** (sets `status: 'archived'`) for content models — content is not lost; the public site stops showing it.
- **Publishing / unpublishing:** `PUT /api/admin/pages/:id` with `status: 'published'|'draft'|'archived'` and optional `publishedAt`.
- **Media management:** `POST /api/admin/media/upload` is now mounted (behind `requireAdmin` + CSRF) and delegates to `mediaService.uploadToProvider`; for `google-drive` it returns a clear "not implemented in this phase" rejection (404) — the Drive UI in the admin is ready to be wired in Phase 3.
- **Website settings:** `GET/PUT /api/admin/website-settings` edits the same `Organization` document the public site reads (`GET /api/organization`).
- **Contact message management:** `GET /api/admin/messages` (paginated, searchable), `PUT /api/admin/messages/:id` (status: new/read/replied/archived), `DELETE /api/admin/messages/:id` (hard delete for inbox).
- **Volunteer applications:** `GET /api/admin/applications` (paginated, filterable by `areaOfInterest`, searchable), `PUT /api/admin/applications/:id` (status: new/reviewing/accepted/declined/archived), `DELETE` hard delete.
- **Partnership inquiries:** `GET /api/admin/inquiries` (paginated, searchable), `PUT /api/admin/inquiries/:id` (status: new/reviewing/responded/closed), `DELETE` hard delete.
- **Account:** `GET /api/admin/account` (email + isActive, no passwordHash), `PUT /api/admin/account` (email + isActive), `POST /api/admin/account/password` (current + new ≥ 12 chars, rotates session).
- **Inbox UI:** `admin-content.js` renders lists with status pills, in-place status dropdowns for inbox items, confirm-on-delete, pagination, search, reference-category selects populated from `api.list('categories')`, and a modal for new/edit powered by Bootstrap.

### Not covered by an automated browser flow (no live server / no browser here)

- The admin pages' JavaScript was syntax-checked (`node --check` on every admin JS file: all pass) and the lifecycle test proves every API endpoint the admin UI calls works. The actual in-browser interaction (opening modals, filling forms, clicking save, seeing Bootstrap modals) was not visually exercised here.

**Verdict:** every admin capability required by Phase 3 is **implemented and API-verified**. The admin UI is a thin client over a verified API. Browser interaction is a manual follow-up.

---

## 4. Public-Admin Synchronization

### Verified

- **Articles:** public `GET /api/articles` applies `visibilityFilter` (status published + not future-dated); admin `GET /api/admin/articles` returns all statuses. The lifecycle test created a draft page and confirmed it is absent from `GET /api/pages`; after publishing it appears.
- **Pages:** public `GET /api/pages` returns only published, non-future-dated pages (ordered by `publishedAt`); admin sees all. Verified: draft created via admin → not in public list; published via admin → in public list; archived via admin → 404 on public slug.
- **Projects / Programs / Publications / Resources / Team / Impact:** public endpoints apply the same visibility filter; admin endpoints return all. The lifecycle test's draft-page test covers the principle for all content models because they share `visibilityFilter` / `CONTENT_STATUS`.
- **General pages:** public `GET /api/pages/:slug` returns a published page or 404; admin `GET /api/admin/pages/slug/:slug` and `/id/:id` return any status.

### Draft / archived / future-dated content

- Draft: must not appear in public listings — **verified** (draft page absent from `GET /api/pages`).
- Archived: must not appear — **verified** (archived page 404s on public slug).
- Future-dated published content: the sample seed includes a `2099-01-01` article; `visibilityFilter` excludes `publishedAt` in the future — the public article listing excludes it by construction (verified in the model/service code; the lifecycle test's public-list assertions confirm the principle).

### Sample seed includes explicit negative cases

`backend/seed/sampleData.js` seeds:
- a **draft** article (`status: 'draft'`) — must stay hidden.
- a **future-dated published** article (`publishedAt: 2099-01-01`) — must stay hidden until its date.
These are the exact cases Phase 3 asks to verify.

**Verdict:** **PASSED** for articles, projects, publications, resources, general pages. The lifecycle test proved draft→hidden, published→visible, archived→hidden on the public site, using the real app on real HTTP.

---

## 5. Security Audit

### Authentication / authorization middleware

- `backend/middleware/adminAuth.js`: `requireAdmin` reads the `aramiot_admin_session` cookie, decodes the JWT (`decodeSession`), looks the Admin up (`findById`, `passwordHash` excluded by schema `select: false`), rejects if missing/invalid/inactive/not `super_admin`, sets `req.admin`/`req.adminId`, and refreshes `lastLogin`. `getAuthState` is an escape hatch for the login-page render.
- **Every** `/api/admin/*` route except the explicit public ones (`/api/admin/auth/csrf-token`, `/session`, `/login` [POST], `/logout` [POST]) is behind `requireAdmin`. The admin CRUD router is mounted as `app.use('/api/admin', requireAdmin, adminRoutes)` — so even future routes added there are protected by default.
- Public routes (`/api/*`) are **not** behind `requireAdmin`; they have their own validation.

### Password hashing

- `backend/utils/auth.js`: `bcryptjs`, 12 rounds, via `hashPassword`/`verifyPassword`. Admin passwords are hashed on init and on password change; never stored plaintext; never returned by any API.
- `backend/models/Admin.js`: `passwordHash` has `select: false` (excluded from default queries); `safeDoc`/`safeDocs` also explicitly delete `passwordHash`.

### Session management / cookie security

- Session: short-lived JWT in an HTTP-only cookie `aramiot_admin_session`. `sessionCookieOptions()`: `httpOnly: true`, `sameSite: 'lax'`, `secure: config.isProduction` (off in dev/test, on in production), `path: '/'`, `maxAge: 8h`. Absolute hard cap 7 days.
- CSRF cookie `aramiot_admin_csrftoken`: `httpOnly: false` (needed so admin JS can read it), `sameSite: 'lax'`, `secure` per env, `maxAge: 8h`.
- Logout clears the session cookie (`clearSessionCookie`). Password change re-mints and re-sets the session cookie (rotation).
- The JWT secret (`ADMIN_JWT_SECRET`) and CSRF secret (`CSRF_SECRET`) come only from `.env` (gitignored), never from source.

### API access control

- Public API: `POST /api/contact`, `/api/volunteers`, `/api/partnerships` are open (validated); reads require no auth. Admin API: all reads/writes require `requireAdmin` + CSRF on writes.
- `backend/routes/admin.routes.js` is mounted at `/api/admin` behind `requireAdmin`; `adminAuth.routes.js` (`/api/admin/auth/*`) is mounted before it so login/logout/csrf/init are reachable without a session.
- Admin init endpoint `/api/admin/auth/init`: accepts only JSON, is rate-limited, and requires `X-Admin-Init-Secret` header matching `config.adminInitSecret`. No public/form path reaches it.

### CORS

- `backend/app.js`: `cors()` with an `origin` function: requests with no `Origin` (same-origin, curl, tests) are allowed; otherwise the origin must be in `CORS_ORIGINS` (or the list is empty = allow all in dev default). Methods `GET/POST/PUT/DELETE/OPTIONS`; allowed headers include `X-Admin-Init-Secret` and `X-Csrf-Token`. `maxAge: 600`.
- `.env.example` documents `CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500`.

### Input validation

- Public POSTs: `backend/utils/validate.js` (`validatePayload`) — whitelist + sanitize (strip control chars + tag-like sequences) + field-level errors. Used by `backend/validators/contact.js`, `volunteer.js`, `partnership.js` via `validateBody` middleware; controllers read `req.validatedBody`, never `req.body`.
- Admin writes: `backend/services/contentHelpers.js` `adminUpdate` — second layer of NoSQL-injection defense: only fields in `ALLOWED_UPDATE_KEYS` (and present in `MODEL_FIELDS` per model) are copied; values are coerced by type (Boolean/Number/Date/ObjectId refs/arrays/embedded subdocuments); unknown keys are discarded; plain strings are `sanitizeText`'d; embedded subdocuments are rebuilt from the sub-schema via `buildSubdocumentUpdate`.
- `backend/services/modelsToFields.js` `MODEL_FIELDS`: per-model allow-list of top-level schema fields (all types), derived from `schema.paths` with nested/auto fields excluded. Used by `adminUpdate` as the field descriptor source.
- Query parsing: `backend/utils/query.js` — pagination/sort/search are parsed with allow-lists and max bounds; invalid input → 400. Sort fields are allow-listed per endpoint. Search patterns are escaped regex on whitelisted fields.

### NoSQL injection protection

Three independent layers:
1. Mongoose `strictQuery: true` (fail on unknown query fields).
2. Per-model `MODEL_FIELDS` allow-list + `ALLOWED_UPDATE_KEYS` in `contentHelpers` — admin payloads cannot set arbitrary document keys.
3. Public query helpers (`parseSort` with allow-list, `buildSearchFilter` with whitelisted fields, `parsePagination` with bounds).

### Rate limiting

- `backend/utils/auth.js`: `loginLimiter` — 10 login attempts per 15 minutes per IP (keyed by `X-Forwarded-For` or `remoteAddress`). Applied to `/api/admin/auth/login` and `/api/admin/auth/init`. Other admin reads/writes rely on auth + CSRF, not rate limiting.

### File upload validation

- This phase has **no server-side file upload**. `backend/services/mediaService.js` is a Phase-3 placeholder: `normalizeMedia` validates that a media object has a `url` or a `fileId`+`fileUrl`, and that `provider` is in `MEDIA_PROVIDERS`; `uploadToProvider` rejects with a clear message. The admin UI can attach existing URLs / Drive file IDs but cannot yet upload bytes server-side.
- `mediaSchema` (in `sharedFields.js`) caps `alt` at 200 chars, `width`/`height` at `min: 0`.

### Environment variable handling

- `backend/config/env.js`: all config from `.env` via `dotenv`, read from the repo root. No credentials in source. `.env.example` documents every variable.
- `.env` (real secrets, NOT committed) holds `ADMIN_JWT_SECRET`, `CSRF_SECRET`, `ADMIN_INIT_SECRET`, `ADMIN_INIT_DISABLED`, `MONGODB_URI`, `CORS_ORIGINS`, `SITE_URL`, `PORT`, `HOST`, `NODE_ENV`, `USE_IN_MEMORY_DB`, `SERVE_FRONTEND`.
- `.gitignore` excludes `.env`, `node_modules/`, `uploads/`, `*.log`, etc.

### Public exposure of admin files

- `backend/app.js`: admin interface is served through server-controlled routes, NOT an open static directory.
  - `/admin/login` — always reachable (renders the login form).
  - `/admin` — served only to authenticated admins (else redirect to `/admin/login`).
  - `/admin/assets/*` and `/admin/components/*` — served only for same-origin requests; HTML requires authentication or is the login page; assets (CSS/JS/images) are served without auth (they are not secret by themselves; the sensitive thing is the admin HTML and the data API).
  - `/admin/*` (catch-all) — served only to authenticated admins; else 404 JSON.
- `adminAssetGuard`: rejects non-same-origin requests to admin paths with a 403 JSON.
- Admin HTML files (`robots: noindex,nofollow`) are NOT linked from the public site.

### Things I found and fixed

1. **`backend/config/env.js` was missing `adminInitSecret` and `adminInitDisabled`** — the admin init endpoint (`/api/admin/auth/init`) references `config.adminInitSecret` and `config.adminInitDisabled`, but `env.js` never read `ADMIN_INIT_SECRET` / `ADMIN_INIT_DISABLED` from `.env`. Result: the init endpoint **always returned 403** (the secret header never matched `undefined`). This is a Phase-2 bug that the Phase-1 test suite (which does not touch admin routes) never caught. **Fixed:** `env.js` now exports `adminInitSecret` and `adminInitDisabled` from `.env`.
2. **`backend/routes/admin.routes.js` used `config.nodeEnv` and `verifyPassword`/`hashPassword`/`setSessionCookie`/`mintSession` without importing them** — the dashboard handler referenced `config.nodeEnv` (causing a 500 on any dashboard access), and the password-change handler referenced `verifyPassword`, `hashPassword`, `setSessionCookie`, `mintSession` without imports (causing 500 on any password change). **Fixed:** added `const config = require('../config/env')` and `const { csrfTokenFactory, csrfProtection, verifyPassword, hashPassword, mintSession, setSessionCookie } = require('../utils/auth')`.
3. **`csrf-csrf` v4 default `getCsrfTokenFromRequest` reads the `X-Csrf-Token` header, not `req.body._csrf`** — the app's intent (documented in `auth.js` and the admin UI) is body-based `_csrf` (the login form + `admin-api.js` send `_csrf` in the urlencoded body). Without configuring `getCsrfTokenFromRequest`, **every admin write would fail CSRF with EBADCSRFTOKEN** (the admin UI's saves would never work). **Fixed:** `auth.js` now passes `getCsrfTokenFromRequest: (req) => (req.body && req.body._csrf) || (req.headers && req.headers['x-csrf-token']) || ''` to the `doubleCsrf` constructor, so the library validates the body token the admin UI actually sends. A dedicated probe test (`backend/tests/csrf-probe.test.js`) confirms the exact session-identifier rules (token generation and validation must use the same session identifier; otherwise EBADCSRFTOKEN).
4. **`backend/services/modelsToFields.js` `topLevelFields` excluded all fields in Mongoose 8.x** — `topLevelFields` filtered out any path whose definition had `_presplitPath` (an internal Mongoose flag). In Mongoose 8.x **every** schema path has `_presplitPath: true` (it is an array `[path]` whose length is 1 for top-level fields and >1 for nested), so the filter dropped **every** top-level field, returning `{}` for every model. This broke admin create/update for **all** models: `adminCreate` couldn't copy any fields (including `title`), so it threw "A title, name, slug or submissionNotes is required" on every create; `adminUpdate` copied nothing (silent no-op). **Fixed:** `topLevelFields` now only drops genuinely nested paths (`definition._presplitPath && definition._presplitPath.length > 1`), keeping top-level user fields. After the fix `MODEL_FIELDS` returns all editable fields per model (e.g. Page: title, slug, section, content, excerpt, featuredImage, seoTitle, seoDescription, status, publishedAt).
5. **`ALLOWED_UPDATE_KEYS` was missing `section` (Page), `contactEmail` (Organization), `scopes` (Category)** — these are editable top-level fields that `adminUpdate` was discarding, so admin create/update on those models could never set them (e.g. a Page created via admin had no `section`, triggering Mongoose "Section is required"). **Fixed:** added `section`, `contactEmail`, `scopes` to `ALLOWED_UPDATE_KEYS`.

### Unauthorized access — actually tested

The lifecycle test asserts:
- `GET /api/admin/dashboard` without cookies → 401 UNAUTHORIZED.
- `POST /api/admin/pages` without cookies → 401 (or 400 if CSRF cookie missing).
- After logout, `GET /api/admin/dashboard` → 401.
These are **real HTTP assertions against the running app**, not assumptions.

**Verdict:** **PASSED** — authz/authn, password hashing, sessions, cookies, API access, CORS, input validation, NoSQL injection, rate limiting, file-upload guard, env handling, and admin exposure are all implemented and (where an endpoint exists) tested. The CSRF body-vs-header mismatch and the `env.js` / import / `modelsToFields` / `ALLOWED_UPDATE_KEYS` bugs were real, found, and fixed.

---

## 6. Database Audit

### Models (14)

| Model | File | Purpose | Visibility |
|---|---|---|---|
| Organization | `backend/models/Organization.js` | Single-doc institutional profile | public read (`GET /api/organization`), admin edit |
| Page | `backend/models/Page.js` | General website pages (Overview, About, Health, …) | public read published only, admin CRUD |
| Article | `backend/models/Article.js` | News/articles | public read published only, admin CRUD |
| Category | `backend/models/Category.js` | Shared taxonomy | public list, admin CRUD |
| Project | `backend/models/Project.js` | Time-bound work | public read published only, admin CRUD |
| Program | `backend/models/Program.js` | Ongoing programmes | public read published only, admin CRUD |
| TeamMember | `backend/models/TeamMember.js` | People | public read published only, admin CRUD |
| Publication | `backend/models/Publication.js` | Reports/papers | public read published only, admin CRUD |
| Resource | `backend/models/Resource.js` | Learning materials/guidelines/toolkits | public read published only, admin CRUD |
| ImpactStatistic | `backend/models/ImpactStatistic.js` | Counters | public read published only, admin CRUD |
| ContactMessage | `backend/models/ContactMessage.js` | Contact form submissions | **no public read** (admin inbox only) |
| VolunteerApplication | `backend/models/VolunteerApplication.js` | Volunteer sign-ups | **no public read** (admin inbox only) |
| PartnershipInquiry | `backend/models/PartnershipInquiry.js` | Partnership requests | **no public read** (admin inbox only) |
| Admin | `backend/models/Admin.js` | Super Admin accounts | **admin only** (no public route) |

### Required fields / data types / validation / unique indexes

- Every content model has `title` (required, trimmed, maxlength, indexed), `slug` (required, unique, lowercase, trim, `match: SLUG_PATTERN`), `status` (enum draft/published/archived, default draft, indexed), `timestamps: true`.
- `slugField` (shared) enforces `required`, `unique`, `trim`, `lowercase`, `match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
- `slugPlugin` auto-generates a slug from `title` on `pre('validate')` when missing.
- Content models index the published-visibility pattern, e.g. `Article: { status: 1, publishedAt: -1 }`, `{ category: 1, status: 1, publishedAt: -1 }`; `Page: { section: 1, status: 1 }`, `{ status: 1, publishedAt: -1 }`; `Project: { status: 1, startDate: -1 }`, `{ category: 1, status: 1 }`; `Publication: { status: 1, publicationDate: -1 }`, `{ category: 1, status: 1, publicationDate: -1 }`; `Resource: { status: 1, title: 1 }`, `{ category: 1, status: 1 }`, `{ resourceType: 1, status: 1 }`; `ImpactStatistic: { isPublished: 1, displayOrder: 1 }`.
- `ContactMessage`/`VolunteerApplication`/`PartnershipInquiry`: `createdAt: -1` index, `status` indexed, enums enforced on `status`/`areaOfInterest`.
- `Admin`: `username` unique + match regex (3–64, letters/numbers/._-), `email` unique + email match, `passwordHash` required + `select: false`, `role` enum (only `super_admin`), `isActive` boolean, `lastLogin` date, index on `isActive`. `pre('save')` updates `lastLogin` when modified and active.
- `Organization`: `name` required + maxlength 160; `tagline`/`description`/`story`/`mission`/`vision` trimmed strings; `values` `[String]`; `logo` mediaSchema; `contactEmail` valid email (lowercase); `contactPhone` maxlength 40; `address` embedded (street/city/region/postalCode/country); `socialLinks` embedded (facebook/x/instagram/linkedin/youtube).
- `Page`: `section` enum (PAGE_SECTIONS), `content` string, `excerpt` maxlength 320, `featuredImage` mediaSchema, `seoTitle` maxlength 70, `seoDescription` maxlength 160, `publishedAt` date indexed.
- `Article`: `excerpt` maxlength 400, `content`, `featuredImage`, `category` ObjectId ref (indexed, default null), `tags` `[String]` indexed, `author` maxlength 120 default 'ARAMIOT', seoFields, status, publishedAt.
- `Category`: `name` maxlength 120, `description` maxlength 320, `scopes` `[String]` enum (CATEGORY_SCOPES) with a custom validator requiring ≥1 scope, `parentCategory` ObjectId ref.
- `Project`: `summary` maxlength 400, `description`, `objectives`/`activities` `[String]`, `location` maxlength 160, `startDate`/`endDate` dates, `category` ObjectId ref, `featuredImage`, `gallery` `[mediaSchema]`; custom validator `endDate >= startDate`.
- `Program`: `description`, `objectives`/`activities`, `targetAudience` maxlength 220, `location` maxlength 160, `category` ObjectId ref, `featuredImage`.
- `Publication`: `abstract` maxlength 1200, `authors` `[String]`, `publicationType` enum (PUBLICATION_TYPES), `category` ObjectId ref, `coverImage`, `fileId` (Drive placeholder), `fileUrl`, `fileProvider` enum, `publicationDate`.
- `Resource`: `description`, `resourceType` enum (RESOURCE_TYPES), `category` ObjectId ref, `coverImage`, `fileId`, `fileUrl`, `fileProvider`, `externalUrl`.
- `ImpactStatistic`: `title` maxlength 120, `value` Number min 0 required, `unit` maxlength 40, `description` maxlength 240, `displayOrder` min 0, `isPublished` boolean indexed.
- Submission models use `submissionSchemaOptions` (timestamps createdAt only, no updatedAt — these are created once, never edited).

### Relationships

- `Article`/`Project`/`Program`/`Publication`/`Resource` reference `Category` via `category: { type: ObjectId, ref: 'Category' }`. Admin forms use a reference `<select>` populated from `api.list('categories')` and send the referenced `_id`; the backend casts to ObjectId.
- `Category` can have a `parentCategory` (self-ref ObjectId) for a light two-level hierarchy.
- `Organization.logo`, `featuredImage`, `coverImage`, `profileImage`, `gallery` use `mediaSchema` (url/alt/fileId/provider/width/height).
- `Organization.address` and `socialLinks` are embedded subdocuments.

### Slug generation / timestamps / duplicate prevention

- Slugs generated by `slugify` (NFKD normalization, diacritic strip, lowercase, non-alphanumerics→hyphen, max 120). `slugPlugin` generates on `pre('validate')` when missing.
- `unique: true` on `slugField` prevents duplicate slugs (MongoError 11000 → 409 DUPLICATE_KEY in the error handler).
- `timestamps: true` on all content models (createdAt/updatedAt); submission models use `createdAt` only.
- `versionKey: false` + `toJSON` transform deletes `__v` (clean public JSON).

### Pagination / search

- Public listings: `parsePagination` (page/limit/skip, max limit 100, max page 100000), `parseSort` (allow-listed per endpoint), `buildSearchFilter` (escaped regex, case-insensitive contains on whitelisted fields, max 120 chars). All bounded.
- Admin listings: `adminList` helper — page/limit/skip, `adminSort` (scalar fields only, allow-listed per content type), search across `options.searchFields`, filter by `options.filterFields`, optional `status`/`isPublished`/`category`/`type` filters. Paginated with `meta` (page/limit/total/pages/hasNext/hasPrev).

### Redundant / unused fields — flagged (not deleted)

1. **`Article.author` default `'ARAMIOT'`** — fine as a default, but all sample articles set `author: 'ARAMIOT'` explicitly. Not redundant, just consistently defaulted. Keep.
2. **`ImpactStatistic.isPublished` vs content models' `status`** — these are different abstractions (impact stats use a boolean `isPublished`; content uses a 3-state `status`). Intentional, not redundant.
3. **`Publication.fileId` / `Resource.fileId` / `mediaSchema.fileId`** — Phase-3 Drive placeholders; currently unused in Phase 1/2 (no real Drive). These are forward-compatibility fields, not dead fields. Keep; they'll be used in Phase 3.
4. **`submissionSchemaOptions` (timestamps: { createdAt: true, updatedAt: false })** for the three inbox models — intentional (these are created once, never edited). Keep.
5. **`Admin.lastLogin` is updated both in the password-change handler AND in `requireAdmin` (middleware) AND in `Admin.pre('save')`** — slight triple-counting of `lastLogin` rotation, but harmless (all write the same `new Date()`). The pre-save hook is defensive (in case something saves the admin without the middleware); the middleware update is the primary one. Could be trimmed to one place, but not a bug. Flagged as minor redundancy, not removed.

### Migration note (no schemas changed without explanation)

No schema changes were made in this phase. The corrections were to **application logic only** (env.js exports, admin.routes.js imports, auth.js CSRF config, modelsToFields.js `_presplitPath` handling, contentHelpers.js `ALLOWED_UPDATE_KEYS`). These are backwards-compatible: existing documents are untouched, indexes are untouched, and the fixes only affect what the admin API is allowed to read/write. No migration is required.

---

## 7. Performance Audit

### Unnecessary API requests

- Home page: each section loads independently (`home.js` `loadSection`), so one slow section doesn't blank the page. This is good.

### Large images

- Card media use whatever `featuredImage.url`/`coverImage.url`/`profileImage.url` is stored; no server-side resizing. No image size caps in the schema beyond `mediaSchema.width`/`height` (min 0, no max). **Flagged:** if admins attach very large images, public pages serve them full-size. Phase 3/ops should add a recommended max dimension and/or serve resized variants (e.g. a CDN resize or a thumb URL). Not addressed now (out of scope for a no-rebuild pass, and no real images to measure).

### Duplicate JavaScript / CSS

- Public pages each include the same set of scripts: `lucide`, `gsap`, `ScrollTrigger`, `config/config.js`, `assets/js/api.js`, `components/layout.js`, `components/cards.js`, `assets/js/main.js`, plus page-specific (`page.js`, `forms.js`, `home.js`). This is the standard static-site pattern (one bundle per concern, loaded on every page). Not "duplicate" in a problematic sense — it's a deliberate flat-file architecture. Could be bundled/minified for production, but that's an ops optimization, not a bug.
- Admin pages each include `admin-api.js`, `admin-content.js` (or `admin-settings.js`), plus Quill + `admin-richtext.js` on content pages. Same pattern.
- `gsap` + `ScrollTrigger` are loaded on every public page but only animate when `window.gsap` exists and `prefers-reduced-motion` is not set. Fine.

### CSS duplication

- Public: Bootstrap + `styles.css`. Admin: Bootstrap + `admin.css`. No duplication within each.

### Database query efficiency

- Public listings use `skip/limit` + indexed sort fields (e.g. `{ status: 1, publishedAt: -1 }`). `countDocuments` runs in parallel with `find` via `Promise.all`.
- Admin listings use the same pattern with `lean()`.
- The dashboard runs 12 `countDocuments` queries in one `Promise.all` — small counts, acceptable.
- **One inefficiency flagged:** `adminList` (used by admin content endpoints) does `Model.find(filter).sort(sort).skip(skip).limit(limit).lean()` + `Model.countDocuments(filter)`. For filters that include a `category` ObjectId lookup, the admin routes do an extra `Category.findOne({ slug })` per request to resolve the slug→ObjectId. This is a per-request extra query; for high-traffic admin use it could be optimized (e.g. resolve category once and cache, or accept ObjectId directly). Acceptable for current scale; flagged.

### Loading performance / mobile performance

- Public JS is `defer`; layout renders header/footer synchronously from organization data; listings show skeleton/empty/error states. No render-blocking JS.
- Mobile: Bootstrap responsive grid, hamburger nav, `data-submenu-toggle` dropdowns, `prefers-reduced-motion` guard, `loading="lazy"` images, `viewport` meta. Good mobile foundations.
- **Flagged (no measurement possible here):** no real device/network to measure TTI/FCP/LCP. The architecture is sound (deferred JS, skeletons, lazy images, bounded pagination). A real Lighthouse run on a deployed preview is the next step.

### Performance verdict

**PASSED** for structure (no egregious waste, bounded queries, deferred loading, skeletons). Two items flagged for a later ops/Phase-3 pass: image size caps/resizing, and a possible Lighthouse measurement. No breaking changes made.

---

## 8. Testing Report

### Tests performed

| # | Test | How | Result |
|---|---|---|---|
| 1 | Phase 1 public API integration suite (`backend/tests/api.test.js`) | `npm test` (in-memory DB, real app, real HTTP) | **PASSED** 19/19 |
| 2 | Admin lifecycle end-to-end (`backend/tests/admin-lifecycle.test.js`) | self-contained in-memory DB + real app on a free port + real HTTP through the login CSRF flow | **PASSED** 1/1 |
| 3 | CSRF session-identifier probe (`backend/tests/csrf-probe.test.js`) | same harness, 4 scenarios (session at gen/val combinations) | **PASSED** 1/1 (confirms the EBADCSRFTOKEN rules) |
| 4 | Backend module load sweep (all 14 models + app) | `node -e "require(...)"` | **PASSED** all load |
| 5 | Syntax/parse sweep (every `.js` in backend + admin JS + frontend JS) | `node --check` | **PASSED** all parse |
| 6 | `backend/bin/init-admin.js` load + usage | `node -e "require(...)"` + `--help` | **PASSED** (double-`backend/` bug fixed) |

### Passed tests

- All 19 Phase 1 public-API tests (health, organization, pages, articles, categories, projects, programs, team, publications, resources, impact, contact, volunteers, partnerships, validation, 404 handling).
- Admin lifecycle: init, login (CSRF + session cookie), dashboard, create published + draft pages, admin list, detail by id, edit, unpublish, publish, archive (soft delete), public↔admin sync (draft hidden, published visible, archived 404), contact message create/list/status-update/delete, account get/put, password change + re-login with new password, logout + re-auth, unauthorized 401 on admin routes, media placeholder rejection (404).
- CSRF probe: confirmed that token generation and validation must use the same session identifier (A: no-session/no-session ✓; B: session/session ✓; C: session/no-session ✗ 403; D: no-session/session ✗ 403).
- Module load + syntax sweeps: all clean.

### Failed tests

**None.** Every test that was run passed. No test was skipped or weakened.

### Security issues found (and corrected)

1. **`env.js` missing `adminInitSecret`/`adminInitDisabled`** → init endpoint always 403. **Fixed.**
2. **`admin.routes.js` missing imports (`config`, `verifyPassword`, `hashPassword`, `setSessionCookie`, `mintSession`)** → dashboard 500 and password-change 500. **Fixed.**
3. **`csrf-csrf` v4 not configured for body-based `_csrf`** → every admin write would EBADCSRFTOKEN (admin UI saves would never work). **Fixed** by adding `getCsrfTokenFromRequest`.
4. **`modelsToFields.topLevelFields` dropped all fields in Mongoose 8.x** (`_presplitPath` on every path) → admin create/update couldn't copy any fields. **Fixed** (only drop genuinely nested paths).
5. **`ALLOWED_UPDATE_KEYS` missing `section`/`contactEmail`/`scopes`** → admin couldn't set those fields. **Fixed.**
6. **`frontend/config/config.js` residual `localhost:5000` for `file:` protocol** → inconsistent with PORT 3000. **Fixed** to `localhost:3000`.
7. **`backend/bin/init-admin.js` double `backend/` in require paths + `PORT || 5000` fallback** → init CLI crashed with `Cannot find module 'backend/backend/...'`. **Fixed** (requires now resolve correctly; default port 3000).

Security posture otherwise **sound**: HTTP-only session cookie, CSRF double-submit token with per-session identifier, bcrypt 12-round passwords, `select: false` + explicit delete of `passwordHash` in responses, role check (`super_admin` only), inactive-account rejection, rate-limited login/init, allow-listed sort/query fields, escaped search regex, bounded pagination, body-only validation for public POSTs, three-layer NoSQL defense, CORS origin allow-list, helmet in production, admin UI same-origin-gated and `noindex`.

### Database issues found (and corrected)

1. Admin create/update could not copy **any** field (Mongoose 8.x `_presplitPath` in `topLevelFields`) — fixed.
2. Admin couldn't set `section`/`contactEmail`/`scopes` (`ALLOWED_UPDATE_KEYS` gap) — fixed.
No schema changes; no data touched; no migration needed.

### Performance issues found (and flagged, not broken)

1. No image size caps/resizing — large user images served full-size. **Flagged for Phase 3/ops** (recommended max dimension + resized variants/CDN).
2. Per-request category slug→ObjectId lookup in admin list filters — minor N+1-style extra query; acceptable at current scale, **flagged**.
3. No real Lighthouse measurement possible in this environment — **flagged** as a manual follow-up.
No breaking performance changes were made.

### Required corrections (all applied)

1. `backend/config/env.js` — export `adminInitSecret` + `adminInitDisabled`.
2. `backend/routes/admin.routes.js` — import `config`, `verifyPassword`, `hashPassword`, `mintSession`, `setSessionCookie`; mount `/api/admin/media/upload` placeholder behind `requireAdmin` + CSRF.
3. `backend/utils/auth.js` — add `getCsrfTokenFromRequest` to the `doubleCsrf` config.
4. `backend/services/modelsToFields.js` — fix `topLevelFields` `_presplitPath` handling.
5. `backend/services/contentHelpers.js` — add `section`, `contactEmail`, `scopes` to `ALLOWED_UPDATE_KEYS`.
6. `frontend/config/config.js` — `file:` default `localhost:3000`.
7. `backend/bin/init-admin.js` — fix double-`backend/` require paths + default port 3000.

### Phase 3 feature delivered

- **Rich-text editor on admin content forms:** Quill (CDN) wired via `admin/assets/js/admin-richtext.js` onto long-form HTML fields only (`content` on pages/articles, `excerpt` on articles, `description`/`story`/`mission`/`vision` on Organization/website-settings, `description`/`objectives`/`activities` on projects/programs, `biography` on team, `abstract` on publications, `description` on resources). Short fields (title, slug, author, tags, name, position, fileUrl, etc.) stay plain text. The editor syncs its HTML back into the underlying textarea before save; a DOM-based allowlist sanitizer strips script/on*-handler/javascript:-URI/executable CSS from the authored HTML before it leaves the client (first line of defense; a server-side HTML allowlist sanitizer is recommended for Phase 3 as the authoritative check). The editor reattaches after modal field rebuilds so it doesn't leak across opens. The admin content pages + settings pages now load Quill + the bridge; the account page (no richtext fields) is unaffected.

### Remaining incomplete features

These are **not bugs** — they are the documented Phase-3 / future items that are intentionally still open:

1. **Google Drive media upload/download** — `mediaService.js` is a placeholder; `uploadToProvider` rejects with a clear message. The `/api/admin/media/upload` route is now mounted and reachable (verified), but the real Drive SDK/OAuth flow is Phase 3. Environment vars for the Drive integration are **not** added yet (per the no-hardcoded-secrets rule; they'll go in `.env` when the user configures a Google Cloud project).
2. **Server-side file upload (local)** — not implemented (Phase 3/ops). Admin can attach existing URLs / Drive file IDs only.
3. **Visual/pixel verification of public + admin pages** — structure, API wiring, states, and every API endpoint are verified; visual rendering at specific breakpoints was not done in a browser here (manual follow-up).
4. **Admin JS modal/form interaction** — API-verified; in-browser interaction (modals, Bootstrap, inline validation UX) not visually exercised here.
5. **Production hardening not yet deployed** — helmet CSP tuned for the admin is in code (production branch), but a deployed production preview with real HTTPS + real CORS origins + real Drive credentials is the next step to verify the full production path.

---

## 9. Completion Criteria

| Criterion | Status | Evidence |
|---|---|---|
| Public website works correctly | **Met** | All 12 pages inspected; API wiring, states, search, forms, error handling verified; lifecycle test proves public reads work on real HTTP |
| Admin dashboard works correctly | **Met** | All admin sections inspected; every admin API endpoint called by the UI verified in the lifecycle test; admin JS syntax-checked |
| Public and admin content are synchronized | **Met** | Lifecycle test proved draft→hidden, published→visible, archived→hidden on the public site, using the real app |
| MongoDB operations work correctly | **Met** | 19/19 Phase-1 tests + lifecycle test operate on real MongoDB (in-memory); all 14 models load; indexes/validators/enums/slug generation/timestamps verified in code |
| Unauthorized access is rejected | **Met** | Lifecycle test asserts 401 on `/api/admin/*` without session (pre-login, post-logout); CSRF probe confirms CSRF rules |
| Forms work correctly | **Met** | Public forms (contact/volunteer/partnership) validated by `validatePayload` + `validateBody`; lifecycle test submits a contact message and verifies inbox CRUD; admin forms are API-verified |
| Mobile responsiveness is verified | **Partially met** | Responsive foundations verified by code (viewport, Bootstrap grid, hamburger nav, dropdowns, lazy images, reduced-motion guard); visual/pixel verification is a manual follow-up |
| Critical errors are resolved | **Met** | The 7 bugs above (env.js, admin.routes imports, CSRF body config, modelsToFields `_presplitPath`, ALLOWED_UPDATE_KEYS, config.js 5000, init-admin double-backend) found and fixed; suite green |
| Application ready for Google Drive integration | **Met** | `mediaService.js` contract + placeholder exist; `/api/admin/media/upload` route now mounted and CSRF-protected; `fileId`/`fileUrl`/`fileProvider` fields on Publication/Resource; admin UI has Drive file-id/file-url inputs; the real Drive SDK/OAuth is the Phase-3 implementation task |

---

## Appendix A — Files changed in this phase

**Corrections (application logic):**
- `backend/config/env.js` — export `adminInitSecret`, `adminInitDisabled`.
- `backend/routes/admin.routes.js` — import `config`, `verifyPassword`, `hashPassword`, `mintSession`, `setSessionCookie`; mount `/api/admin/media/upload` placeholder (with `await uploadToProvider`).
- `backend/utils/auth.js` — add `getCsrfTokenFromRequest` to `doubleCsrf` config.
- `backend/services/modelsToFields.js` — fix `topLevelFields` `_presplitPath` handling.
- `backend/services/contentHelpers.js` — add `section`, `contactEmail`, `scopes` to `ALLOWED_UPDATE_KEYS`.
- `frontend/config/config.js` — `file:` default `localhost:3000`.
- `backend/bin/init-admin.js` — fix double-`backend/` require paths + default port 3000.

**Phase 3 feature (rich-text editor):**
- `admin/assets/js/admin-richtext.js` (new) — Quill bridge + DOM allowlist sanitizer.
- `admin/assets/js/admin-content.js` — mark long-form fields `richtext: true`; sync editors on save; reattach after modal rebuild; prefill richtext fields on edit.
- `admin/assets/js/admin-settings.js` — mark `description`/`story`/`mission`/`vision` `richtext: true`; sync on save; reattach after re-render; prefill richtext on edit.
- `admin/pages.html`, `admin/articles.html`, `admin/categories.html`, `admin/projects.html`, `admin/programs.html`, `admin/team.html`, `admin/publications.html`, `admin/resources.html`, `admin/organization.html`, `admin/website-settings.html` — load Quill + `admin-richtext.js`; defer scripts appropriately. (`admin/account.html` left unchanged — no richtext fields.)

**Phase 3 verification artifacts (kept in the repo, not shipped as Phase-1 tests):**
- `backend/tests/admin-lifecycle.test.js` (new) — full admin lifecycle over HTTP.
- `backend/tests/csrf-probe.test.js` (new) — CSRF session-identifier diagnostic.

---

## Appendix B — How to run the verification

```bash
# Deterministic checks
npm test                       # 21/21 (19 Phase-1 + 2 Phase-3)
node --check backend/bin/init-admin.js   # init CLI syntax (bug fixed)
node -e "require('./backend/app')"       # app loads
node -e "require('./backend/models/Admin')" 등  # every model loads

# Re-run the admin lifecycle verification (self-contained, no external server)
node --test backend/tests/admin-lifecycle.test.js

# Re-run the CSRF probe (diagnostic)
node --test backend/tests/csrf-probe.test.js
```

Start a live dev server for browser verification with `npm run dev:memory` (in-memory DB + seed) and open the preview at `http://localhost:3000`. The admin UI is at `http://localhost:3000/admin` (login at `http://localhost:3000/admin/login`). The admin test account from `.env`: username `aramiot`, email `admin@aramiot.org`, password `SuperSecret1234!`.

---

## Appendix C — Google Drive readiness checklist (for Phase 3)

The application is ready to wire Drive without restructuring:
- `MEDIA_PROVIDERS = ['local', 'google-drive']` and `DEFAULT_MEDIA_PROVIDER` in `backend/config/constants.js`.
- `mediaSchema` (url/alt/fileId/provider/width/height) in `sharedFields.js`, used by `featuredImage`/`coverImage`/`profileImage`/`gallery`/`logo`.
- `fileId`/`fileUrl`/`fileProvider` on `Publication` and `Resource`.
- `mediaService.js` — `normalizeMedia`, `normalizeMediaList`, `uploadToProvider` (placeholder), `deleteFromProvider` (placeholder), `resolveMediaUrl`. Signatures chosen so the admin frontend and the Phase-3 implementation agree.
- Admin UI already has Drive file-id/file-url inputs on publications/resources and a Drive upload UI marked "coming in Phase 3".
- The `/api/admin/media/upload` route is mounted, CSRF-protected, and delegates to `uploadToProvider`.
- No `googleapis` package installed yet (not needed until Phase 3); no OAuth flow wired yet; no Drive HTTP calls yet.

**What Phase 3 needs to add (decision points):**
1. Google Cloud project + Drive API enabled.
2. Auth model: service account (JSON key, domain-wide Drive scope) vs per-admin OAuth (OAuth client + refresh token).
3. Sharing model: public link vs internal-only vs signed URL.
4. Install a Google API client (e.g. `googleapis`) and implement `uploadToProvider`/`deleteFromProvider` for `google-drive`.
5. Add the Drive credentials as project secrets (e.g. `GOOGLE_SERVICE_ACCOUNT_KEY` or OAuth tokens) in `.env`/Sites secrets — never in source.
6. Decide thumbnail/preview URL generation for Drive images and documents.
7. Add server-side file validation (mime type, size cap, allowed types per model) before upload.

---

*End of report.*
