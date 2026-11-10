# ARAMIOT — Phase 1 Implementation

**Public website · Express REST API · MongoDB/Mongoose content architecture**

| | |
| --- | --- |
| Project | ARAMIOT organisational website |
| Phase | 1 — public website, backend foundation, database, REST API |
| Document | `execute1.md` |
| Generated | from the actual source files in this repository |
| Node.js used | v26.13.0 |
| Express | 4.22.3 |
| Mongoose | 8.24.8 |
| MongoDB driver | 6.22.0 |
| Test runner | `node:test` + mongodb-memory-server 10.4.3 |

---

## 0. Status of this phase

Phase 1 is implemented and verified in this repository:

* 12 static pages are served by Express alongside the API.
* 13 Mongoose models with shared slug/status/SEO/media fragments.
* 17 public GET endpoints and 3 public POST endpoints.
* 19 integration tests pass against a real MongoDB instance (in-memory server).
* Contact, volunteer and partnership submissions persist to MongoDB.
* Published-only visibility, pagination, search, sorting, filtering, validation
  and consistent error envelopes are in place.

Not built in Phase 1, by design: the admin dashboard, authentication, admin
login, Google Drive upload, donations/payments. Section 11 explains how they
attach without schema migrations.

---

## 1. Scope delivered

### 1.1 Public website

| Page | File | API data rendered |
| --- | --- | --- |
| Home | `frontend/index.html` | organization, pages (areas), projects, articles, publications, impact |
| Overview | `pages/overview.html` | `pages/overview` + impact |
| About us | `pages/about.html` | `pages/about` + team |
| Health | `pages/health.html` | `pages/health` + articles and projects in the health category |
| Education | `pages/education.html` | `pages/education` + education articles and projects |
| Advocacy | `pages/advocacy.html` | `pages/advocacy` + advocacy articles and projects |
| Our Work | `pages/our-work.html` | `pages/our-work` + projects + programmes + impact |
| Resources | `pages/resources.html` | `pages/resources` + resources + publications |
| Publications | `pages/publications.html` | publications library (search) |
| Get Involved | `pages/get-involved.html` | `pages/get-involved` + volunteer and partnership forms |
| Contact | `pages/contact.html` | `pages/contact` + organization contact details + contact form |
| Not found | `404.html` | static |

All page copy that should be editable comes from MongoDB through the API. HTML
files contain structure only.

### 1.2 Backend

Express application with separated concerns: routes → controllers → services →
models, with middleware for validation, error handling and security headers.

### 1.3 Database

13 collections, described field by field in section 5 and in the model sources
in Appendix A.

---

## 2. Technology stack as installed

| Layer | Choice | Version |
| --- | --- | --- |
| Runtime | Node.js | v26.13.0 |
| Server | Express | 4.22.3 |
| ODM | Mongoose | 8.24.8 |
| Database | MongoDB | in-memory server for verification; any MongoDB URI in the environment |
| Env | dotenv | 16.6.1 |
| CORS | cors | 2.8.6 |
| Frontend | HTML5, CSS3, ES5-safe JavaScript, Bootstrap 5.3.3 (CDN) | — |
| Animation | GSAP 3.12.5 + ScrollTrigger (CDN) | — |
| Icons | Lucide 0.446.0 (CDN) | — |
| Type | Google Fonts — Inter + Newsreader | — |
| Tests | `node:test`, mongodb-memory-server | 10.4.3 |

Bootstrap 5 is the only CSS framework used; no Tailwind. GSAP is limited to a
hero entrance and static section reveals, and is skipped entirely when the user
prefers reduced motion.

---

## 3. How to run

```bash
npm install
cp .env.example .env          # set MONGODB_URI
npm run seed                  # sample content (development only)
npm start                     # http://localhost:5000
```

Without a local MongoDB:

```bash
npm run dev:memory            # in-memory MongoDB, seeded automatically
```

Verification:

```bash
npm test                      # 19 integration tests
```

Full instructions, environment variables and scripts are in `README.md`
(reproduced in Appendix A).

---

## 4. Architecture

### 4.1 Layers

```
Browser
  │  static HTML/CSS/JS  (frontend/)
  │  fetch() JSON        (frontend/assets/js/api.js)
  ▼
Express app (backend/app.js)
  │  security headers → CORS → body parsers (100 kB limit)
  │  /api/health
  │  /api/*  → routes/ → controllers/ → services/ → models/
  │  static frontend (SERVE_FRONTEND=true)
  │  404 (JSON for /api, 404.html for pages) → errorHandler
  ▼
Mongoose models (backend/models/)
  ▼
MongoDB
```

### 4.2 Why the duplication is low

* `services/contentService.js` implements list + detail once: published-only
  filter, pagination, allow-listed sorting, escaped regex search, category
  resolution and `meta` construction. Each content controller is then 10–20
  lines of configuration.
* `models/sharedFields.js` holds the slug field, status enum, media subdocument,
  SEO fields, base schema options and the slug-generation plugin.
* `frontend/components/layout.js` owns the header, footer, dialogs and the
  loading/empty/error states; `frontend/components/cards.js` owns every card.
  No HTML file repeats navigation or footer markup.

### 4.3 Request lifecycle for a listing

```
GET /api/articles?search=mental&category=health&page=2&limit=6&sort=-publishedAt
  → contentService.buildListHandler
      parsePagination  → rejects page/limit outside 1..100 (400)
      parseSort        → rejects fields outside the allow-list (400)
      visibilityFilter → { status: 'published', publishedAt: { $lte: now } }
      filterFields     → ?tag maps to the tags array
      categoryFilter   → resolves the slug to an ObjectId (unknown slug = no results)
      buildSearchFilter→ escaped, case-insensitive $or across title/excerpt/tags
      find + countDocuments in parallel, populate category (name, slug)
  → { success: true, data: [...], meta: { page, limit, total, pages, hasNextPage, hasPrevPage, sort, search } }
```

---

## 5. Database design

### 5.1 Collections

| Collection | Purpose | Notable fields | References | Main indexes |
| --- | --- | --- | --- | --- |
| `organizations` | Singleton institutional profile | name, tagline, description, story, mission, vision, values[], logo, contactEmail, contactPhone, address, socialLinks | — | — |
| `pages` | Editable website pages | title, slug, section, content (HTML), excerpt, featuredImage, seoTitle, seoDescription, status, publishedAt | — | slug (unique), section+status, status+publishedAt, title |
| `articles` | News and articles | title, slug, excerpt, content (HTML), featuredImage, tags[], author, status, publishedAt | `category → categories` | slug (unique), status+publishedAt, category+status+publishedAt, tags, title |
| `categories` | Shared taxonomy | name, slug, description, scopes[], parentCategory | `parentCategory → categories` (self) | slug (unique), scopes, parentCategory, name |
| `projects` | Time-bound work | title, slug, summary, description, objectives[], activities[], location, startDate, endDate, gallery[], status | `category → categories` | slug (unique), status+startDate, category+status, title |
| `programs` | Ongoing programmes | title, slug, description, objectives[], activities[], targetAudience, location, status | `category → categories` | slug (unique), status+title, category+status, title |
| `teammembers` | Public profiles | name, position, biography, profileImage, department, displayOrder, status | — | name, status+displayOrder |
| `publications` | Reports and papers | title, slug, abstract, authors[], publicationType, coverImage, fileId, fileUrl, fileProvider, publicationDate, status | `category → categories` | slug (unique), status+publicationDate, category+status+publicationDate, publicationDate, title |
| `resources` | Learning materials | title, slug, description, resourceType, coverImage, fileId, fileUrl, fileProvider, externalUrl, status | `category → categories` | slug (unique), status+title, category+status, resourceType+status, title |
| `impactstatistics` | Impact counters | title, value, unit, description, displayOrder, isPublished | — | isPublished+displayOrder |
| `contactmessages` | Contact enquiries | name, email, subject, message, status, createdAt | — | status, createdAt |
| `volunteerapplications` | Volunteer applications | fullName, email, phone, areaOfInterest, experience, motivation, status, createdAt | — | status, createdAt |
| `partnershipinquiries` | Partnership requests | organizationName, contactPerson, email, subject, message, status, createdAt | — | status, createdAt |

### 5.2 Relationships

```
categories ──< categories            (parentCategory, one level of nesting)
categories ──< articles              (Article.category)
categories ──< projects              (Project.category)
categories ──< programs              (Program.category)
categories ──< publications          (Publication.category)
categories ──< resources             (Resource.category)

organizations                        (single document, no references)
pages                                (section is an enum, not a reference)
teammembers, impactstatistics        (standalone, ordered by displayOrder)
contactmessages, volunteerapplications, partnershipinquiries
                                     (standalone submissions, no public read route)
```

References are `ObjectId` + `ref`, never duplicated documents. Public read
routes populate only `name` and `slug` from the category (select-projection), so
a listing cannot leak unpublished category data or embed large documents.

Why one `categories` collection instead of five: the organisation's topics
(health, education, advocacy, mental health …) are shared across content types.
Each category declares which content types it classifies through `scopes[]`
(`articles`, `projects`, `programs`, `publications`, `resources`, `general`), and
`GET /api/categories?scope=publications` filters on it. Slugs are globally unique
because URLs and `?category=<slug>` filters address a category by slug alone.

### 5.3 Content lifecycle and public visibility

Every content model shares one status enum:

| Status | Meaning | Public API |
| --- | --- | --- |
| `draft` | Work in progress | hidden |
| `published` | Live | visible once its date has passed |
| `archived` | Retired, kept for history | hidden |

The public visibility filter is:

```js
{ status: 'published' }                                  // no date field
{ status: 'published', publishedAt: { $lte: new Date() } } // dated content
```

Consequences verified by tests: a draft article is absent from
`GET /api/articles` and its detail request returns 404; an article published with
a future `publishedAt` (scheduling) stays hidden until that date. Impact
statistics use `isPublished` instead of the status enum and are never inferred.

This gives the Phase 2 dashboard its publish / unpublish / schedule behaviour
without any schema change.

### 5.4 Field-level conventions

* Slugs: unique, lowercase, `^[a-z0-9]+(?:-[a-z0-9]+)*$`; generated from the
  title by a shared pre-validate plugin when not supplied.
* `content` fields (`Page`, `Article`) hold trusted HTML authored in the admin
  area. `excerpt`, `summary`, `abstract`, `description` are plain text and are
  always rendered escaped by the frontend.
* Media: one subdocument shape `{ url, alt, fileId, provider, width, height }`
  used by `featuredImage`, `coverImage`, `profileImage`, `logo` and `gallery[]`.
  `provider` is `local` today and `google-drive` for Phase 3.
* `updatedAt` is omitted on the three submission collections: submissions are
  never edited, only triaged by status.

### 5.5 Google Drive readiness

`Publication` and `Resource` store `fileId` + `fileUrl` + `fileProvider`; the
media subdocument does the same for images. Phase 3 upload writes the Drive file
id and serves/streams through the backend — no migration needed, and no Drive
credential ever reaches the browser.

### 5.6 Sample-data policy

`backend/seed/sampleData.js` is labelled development-only at the top of the file.
Organization text is placeholder; team profiles are named "Sample Team Member";
seeded article and page bodies carry a visible "Sample content for development"
notice; impact statistics are `0` with a description stating the figure is not
verified. Real figures and copy must be entered by the organisation.

---

## 6. API reference

### 6.1 Envelope

```json
{ "success": true, "data": {}, "meta": {}, "message": "optional" }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "field": "email", "message": "…" }] } }
```

Error codes: `BAD_REQUEST`, `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`,
`CONFLICT`, `DUPLICATE_KEY`, `INVALID_IDENTIFIER`, `INVALID_JSON`,
`PAYLOAD_TOO_LARGE`, `INTERNAL_ERROR`.

### 6.2 Endpoints

| Method | Path | Query / body | Returns |
| --- | --- | --- | --- |
| GET | `/api/health` | — | status, database state, uptime, version (503 when DB down) |
| GET | `/api` | — | endpoint index |
| GET | `/api/organization` | — | organization document |
| GET | `/api/pages` | `section`, `search`, `page`, `limit`, `sort` | pages + meta |
| GET | `/api/pages/:slug` | — | one published page |
| GET | `/api/articles` | `search`, `category`, `tag`, `page`, `limit`, `sort` | articles + meta |
| GET | `/api/articles/:slug` | — | one published article |
| GET | `/api/categories` | `scope`, `parent` | categories with parent populated |
| GET | `/api/projects` | `search`, `category`, `page`, `limit`, `sort` | projects + meta |
| GET | `/api/projects/:slug` | — | one published project |
| GET | `/api/programs` | `search`, `category`, `page`, `limit`, `sort` | programmes + meta |
| GET | `/api/programs/:slug` | — | one published programme |
| GET | `/api/team` | `search`, `page`, `limit` | team members, ordered |
| GET | `/api/publications` | `search`, `category`, `publicationType`, `page`, `limit`, `sort` | publications + meta |
| GET | `/api/publications/:slug` | — | one published publication |
| GET | `/api/resources` | `search`, `category`, `resourceType`, `page`, `limit`, `sort` | resources + meta |
| GET | `/api/resources/:slug` | — | one published resource |
| GET | `/api/impact` | `search`, `page`, `limit` | published statistics only |
| POST | `/api/contact` | name, email, subject, message | 201 + id |
| POST | `/api/volunteers` | fullName, email, phone?, areaOfInterest, experience?, motivation | 201 + id |
| POST | `/api/partnerships` | organizationName, contactPerson, email, subject, message | 201 + id |

Listing contract: `limit` 1–100 (default 12), `page` ≥ 1, `sort` restricted per
collection. Invalid paging/sort returns 400 with the allowed values in the
message — verified by tests.

### 6.3 Live response samples

Captured from the running server while this document was generated.

#### GET /api/health — 200

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "environment": "development",
    "uptimeSeconds": 152,
    "version": "1.0.0"
  }
}
```

#### GET /api/organization — 200

```json
{
  "success": true,
  "data": {
    "_id": "6af1f5cb4813b32c2ef42ca0",
    "name": "ARAMIOT",
    "tagline": "Health, education and advocacy for healthier, educated and empowered communities.",
    "description": "ARAMIOT is a community-oriented initiative working across three interconnected areas: health, education and advocacy. We believe that access to health information, quality education and the protection of fundamental rights are essential to inclusive, resilient communities.",
    "story": "This is sample organizational text. The verified history of ARAMIOT — founding, milestones and the communities it works with — should be written and approved by the organization, then entered through the admin dashboard.",
    "mission": "To promote healthier, educated and empowered communities through accessible health information, inclusive education, research and human rights advocacy.",
    "vision": "A society where every individual can access essential health knowledge, meaningful educational opportunities and fundamental rights without discrimination.",
    "values": [
      "Community participation",
      "Evidence and research",
      "Inclusion and equity",
      "Accountability"
    ],
    "contactEmail": "contact@example.org",
    "contactPhone": "+000 000 0000",
    "address": {
      "street": "Sample address",
      "city": "Sample city",
      "region": "",
      "postalCode": "",
      "country": "Sample country"
    },
    "socialLinks": {
      "facebook": "",
      "x": "",
      "instagram": "",
      "linkedin": "",
      "youtube": ""
    },
    "createdAt": "2026-11-09T16:33:15.435Z",
    "updatedAt": "2026-11-09T16:33:15.435Z",
    "id": "6af1f5cb4813b32c2ef42ca0"
  }
}
```

#### GET /api/articles?limit=2 — 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "6af1f5cb4813b32c2ef42ce7",
      "title": "Community health awareness: why local conversations matter",
      "slug": "community-health-awareness-local-conversations",
      "excerpt": "Awareness begins with a conversation held in a language people already use.",
      "content": "<p class=\"lead\">Health awareness works best when it starts from the questions a community is already asking.</p>\n<p class=\"content-notice\"><em>Sample content for development. Replace it with verified ARAMIOT information before launch.</em></p>\n<p>Sample article text. This placeholder describes how community dialogues are organised, who takes part and what participants say they find useful.</p>\n<p>Replace this text with a verified ARAMIOT article before publishing the site.</p>",
      "category": {
        "_id": "6af1f5cb4813b32c2ef42cb3",
        "name": "Public Health",
        "slug": "public-health",
        "id": "6af1f5cb4813b32c2ef42cb3"
      },
      "tags": [
        "health",
        "awareness"
      ],
      "author": "ARAMIOT",
      "status": "published",
      "publishedAt": "2026-09-18T09:00:00.000Z",
      "createdAt": "2026-11-09T16:33:15.575Z",
      "updatedAt": "2026-11-09T16:33:15.575Z",
      "id": "6af1f5cb4813b32c2ef42ce7"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 2,
    "total": 5,
    "pages": 3,
    "hasNextPage": true,
    "hasPrevPage": false,
    "sort": "-publishedAt",
    "search": null,
    "note": "additional records omitted from this document"
  }
}
```

#### GET /api/pages/health — 200

```json
{
  "success": true,
  "data": {
    "_id": "6af1f5cb4813b32c2ef42cd3",
    "title": "Health",
    "slug": "health",
    "section": "health",
    "content": "<p class=\"lead\">Health information should be understandable, accessible and useful in everyday life.</p>\n<p class=\"content-notice\"><em>Sample content for development. Replace it with verified ARAMIOT information before launch.</em></p>\n<h2>Public Health</h2>\n<p>Community-based health promotion, preventive services and practical information about healthy living.</p>\n<h2>Mental Health</h2>\n<p>Awareness activities and learning materials that reduce stigma and encourage people to seek support.</p>\n<h2>Health Awareness</h2>\n<p>Dialogues, campaigns and printed materials developed with community health volunteers.</p>\n<h2>Disease Prevention</h2>\n<p>Prevention-focused sessions on hygiene, immunisation, non-communicable disease and early screening.</p>",
    "excerpt": "Public health, mental health, health awareness and disease prevention.",
    "status": "published",
    "publishedAt": "2026-01-10T09:00:00.000Z",
    "createdAt": "2026-11-09T16:33:15.536Z",
    "updatedAt": "2026-11-09T16:33:15.536Z",
    "id": "6af1f5cb4813b32c2ef42cd3"
  }
}
```

#### GET /api/impact — 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "6af1f5cb4813b32c2ef42d1d",
      "title": "People reached",
      "value": 0,
      "unit": "",
      "description": "Sample placeholder. Replace with a verified figure provided by ARAMIOT.",
      "displayOrder": 1,
      "isPublished": true,
      "createdAt": "2026-11-09T16:33:15.654Z",
      "updatedAt": "2026-11-09T16:33:15.654Z",
      "id": "6af1f5cb4813b32c2ef42d1d"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "total": 4,
    "pages": 1,
    "hasNextPage": false,
    "hasPrevPage": false,
    "sort": "displayOrder",
    "search": null,
    "note": "additional records omitted from this document"
  }
}
```

#### POST /api/contact (valid) — 201

```json
{
  "success": true,
  "message": "Thank you for contacting ARAMIOT. Your message has been received.",
  "data": {
    "id": "6af1f6624813b32c2ef42d38",
    "status": "new",
    "createdAt": "2026-11-09T16:35:46.401Z"
  }
}
```

#### POST /api/contact (invalid) — 400

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is invalid",
    "details": [
      {
        "field": "name",
        "message": "Name must be at least 2 characters"
      },
      {
        "field": "email",
        "message": "Email must be a valid email address"
      },
      {
        "field": "subject",
        "message": "Subject is required"
      },
      {
        "field": "message",
        "message": "Message must be at least 10 characters"
      }
    ]
  }
}
```

### 6.4 Validation and sanitisation

`backend/utils/validate.js` is a small declarative engine: a rule map per
endpoint, a whitelist (only declared fields reach Mongoose), trimming, control
character and tag removal for plain-text fields, email/phone/URL/enum/length
checks, and every failure reported at once as `{ field, message }`.

Mongoose schema validation (enums, ranges, required, unique) is the second
defence; Mongo duplicate-key errors become `409 DUPLICATE_KEY`.

---

## 7. Frontend architecture

### 7.1 Components

| Component | File | Responsibility |
| --- | --- | --- |
| Header | `components/layout.js` | brand, primary navigation with accessible dropdowns, search button, Get involved |
| Mobile navigation | `assets/js/main.js` | toggle with `aria-expanded`, closes on Escape/outside click |
| Search dialog | `components/layout.js` + `assets/js/main.js` | native `<dialog>`, debounced search over articles, publications, resources |
| Content preview | `assets/js/main.js` | `<dialog>` that loads `/api/{type}/:slug` |
| Footer | `components/layout.js` | description, explore/programme links, contact details from the organization document |
| Section heading | markup in pages | eyebrow + title + optional lead and link |
| Article / project / programme / publication / resource / team cards | `components/cards.js` | escaped previews with `data-detail` triggers |
| Statistics | `components/cards.js` | formatted values from published impact statistics |
| Listings + pagination | `assets/js/page.js` | search, previous/next paging, counts |
| Loading / empty / error states | `components/layout.js` | skeletons, empty copy, retry button |
| Forms | `assets/js/forms.js` | client checks, disabled submit, API success/field errors |

### 7.2 Rendering model

Each page is a static shell with explicit slots:

```html
<main id="main" data-page="health" data-page-slug="health">
  <div data-page-hero data-fallback-title="Health" …></div>
  <section class="section"><div class="container container--narrow" data-page-content></div></section>
  <section class="section"><div class="container"><div data-list="articles" data-category="health" data-limit="3"></div></div></section>
  …
</main>
```

`page.js` fills the hero and content from the Page document and mounts every
`[data-list]` with its own pagination state. The home page uses `data-home="…"`
containers and loads each section independently, so one failed request degrades a
single section rather than the page.

### 7.3 Requirements coverage

| Requirement | Implementation |
| --- | --- |
| Responsive desktop/tablet/mobile | CSS grid + Bootstrap container, breakpoints at 980 px and 640 px, mobile nav |
| Accessible structure | skip link, one `h1` per page, landmarks, `aria-current`, `aria-expanded`, labels on every field, `aria-live` on listings, native dialogs with focus handling, visible focus rings |
| Consistent typography/spacing | CSS custom-property design system (`styles.css`) |
| Reusable classes/functions | component modules + shared state helpers |
| Responsive dropdown navigation | desktop hover/focus-within, mobile click-to-expand |
| Search interface | header search dialog + per-listing search on projects, resources and publications |
| Loading indicators | skeleton tiles |
| Empty states | dedicated component with contextual copy |
| Error messages | error state with retry, plus field-level form errors from the API |
| SEO metadata | unique title, description, Open Graph tags, `theme-color`, `lang="en"` per page |
| Animation restraint | GSAP hero entrance + static section reveals; disabled for `prefers-reduced-motion` |

No frontend file hardcodes content that belongs in MongoDB, and the API base URL
is the only configuration value (no secrets).

---

## 8. Security decisions

1. MongoDB credentials only exist in `.env` (git-ignored); the browser never
   receives them and the frontend talks only to `/api`.
2. Public reads are published-only, sort fields are allow-listed, and page size
   is capped at 100 — a client cannot enumerate drafts or dump a collection.
3. Public writes: whitelisted, validated, sanitised, 100 kB body limit, and the
   three collections have no public read route.
4. `json escape` is enabled on the Express app, so `<` and `>` inside JSON are
   escaped (XSSI mitigation).
5. Errors return a stable shape with no stack traces or database detail in
   production.
6. Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
   `Referrer-Policy`, `Permissions-Policy`.

Deferred to Phase 2 (documented, not silently skipped): authentication and
RBAC, rate limiting, CSRF strategy for the admin API, CSP tuned for the admin
dashboard, CAPTCHA/honeypot on public forms, and HTML sanitisation for
admin-authored `content` fields.

---

## 9. Testing and verification

### 9.1 Automated suite

```bash
npm test
```

`backend/tests/api.test.js` starts the real Express app against a throw-away
MongoDB, seeds sample content, and asserts over HTTP:

1. `GET /api/health` reports a connected database
2. `GET /api` returns the endpoint index
3. `GET /api/organization` returns the seeded profile
4. `GET /api/pages` paginates and returns published pages only
5. `GET /api/pages/:slug` returns editable content
6. unknown page slug → `404 NOT_FOUND`
7. malformed slug → `400 BAD_REQUEST`
8. drafts and future-dated articles stay hidden (`total = 5`)
9. search, category filter and sorting behave correctly
10. invalid `limit`/`sort`/`page` → 400
11. `GET /api/categories?scope=` filters, and parent categories are populated
12. projects, programmes and team return published content in order
13. publications filter by type; resources filter by type
14. `GET /api/impact` returns published statistics only
15. `POST /api/contact` saves a validated message (and normalises the email)
16. `POST /api/contact` rejects invalid input with field details and saves nothing
17. `POST /api/volunteers` enforces the area-of-interest enum and stores valid data
18. `POST /api/partnerships` stores an inquiry and strips markup
19. unknown API paths return a JSON 404

Result: **19 tests, 19 pass, 0 fail.**

### 9.2 Manual HTTP verification

The site was started with `npm run dev:memory` and checked over HTTP:

| Request | Result |
| --- | --- |
| `GET /` | 200 `text/html` |
| `GET /pages/health.html` | 200 `text/html` |
| `GET /pages/get-involved.html` | 200 `text/html` |
| `GET /pages/publications.html` | 200 `text/html` |
| `GET /assets/css/styles.css` | 200 `text/css` |
| `GET /components/layout.js` | 200 `application/javascript` |
| `GET /api/health` | 200 `application/json` |
| `GET /api/organization` | 200 `application/json` |
| `GET /api/articles?limit=2` | 200 `application/json` |
| `GET /api/pages/health` | 200 `application/json` |
| `GET /api/impact` | 200 `application/json` |
| `GET /does-not-exist` | 404 `text/html` (404 page) |

JavaScript syntax of every frontend file was checked with `node --check`, and the
CDN assets (Bootstrap, Lucide, GSAP, ScrollTrigger) returned 200.

### 9.3 Known verification limits

* No MongoDB Community Edition binary is installed on the build machine; the
  models and indexes were exercised against `mongodb-memory-server` (the same
  server binary version family). Running against a production MongoDB instance
  remains part of deployment.
* The rendered pages were served and their HTML/JS/CSS responses verified, but
  no visual browser inspection (screenshot/design QA) was performed in this
  environment.
* Email delivery on form submission is intentionally not implemented: Phase 1
  stores submissions in MongoDB. Notification email is Phase 2 work.

---

## 10. Project structure

```text
.
├── backend/
│   ├── config/
│   │   ├── constants.js
│   │   ├── database.js
│   │   └── env.js
│   ├── controllers/
│   │   ├── articleController.js
│   │   ├── categoryController.js
│   │   ├── formController.js
│   │   ├── impactController.js
│   │   ├── organizationController.js
│   │   ├── pageController.js
│   │   ├── programController.js
│   │   ├── projectController.js
│   │   ├── publicationController.js
│   │   ├── resourceController.js
│   │   └── teamController.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   ├── securityHeaders.js
│   │   └── validateBody.js
│   ├── models/
│   │   ├── Article.js
│   │   ├── Category.js
│   │   ├── ContactMessage.js
│   │   ├── ImpactStatistic.js
│   │   ├── Organization.js
│   │   ├── Page.js
│   │   ├── PartnershipInquiry.js
│   │   ├── Program.js
│   │   ├── Project.js
│   │   ├── Publication.js
│   │   ├── Resource.js
│   │   ├── sharedFields.js
│   │   ├── TeamMember.js
│   │   └── VolunteerApplication.js
│   ├── routes/
│   │   ├── categories.routes.js
│   │   ├── content.routes.js
│   │   ├── forms.routes.js
│   │   ├── impact.routes.js
│   │   ├── index.js
│   │   ├── organization.routes.js
│   │   └── team.routes.js
│   ├── seed/
│   │   ├── sampleData.js
│   │   └── seed.js
│   ├── services/
│   │   └── contentService.js
│   ├── tests/
│   │   └── api.test.js
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── asyncHandler.js
│   │   ├── query.js
│   │   ├── slugify.js
│   │   └── validate.js
│   ├── validators/
│   │   ├── contact.js
│   │   ├── partnership.js
│   │   └── volunteer.js
│   ├── app.js
│   └── server.js
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   │   └── styles.css
│   │   └── js/
│   │       ├── api.js
│   │       ├── forms.js
│   │       ├── home.js
│   │       ├── main.js
│   │       └── page.js
│   ├── components/
│   │   ├── cards.js
│   │   └── layout.js
│   ├── config/
│   │   └── config.js
│   ├── pages/
│   │   ├── about.html
│   │   ├── advocacy.html
│   │   ├── contact.html
│   │   ├── education.html
│   │   ├── get-involved.html
│   │   ├── health.html
│   │   ├── our-work.html
│   │   ├── overview.html
│   │   ├── publications.html
│   │   └── resources.html
│   ├── 404.html
│   └── index.html
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 11. Phase 2 readiness (admin dashboard and authentication)

The data model is already shaped for it:

* **Draft/publish/archive** exists on every content model, including scheduled
  publication via future dates — the admin UI only needs to set these fields.
* **Editability** — every public page's copy is a `Page` document; the home page
  sections read `Organization`, `ImpactStatistic`, `Project`, `Article` and
  `Publication`.
* **Admin inbox** — `ContactMessage`, `VolunteerApplication` and
  `PartnershipInquiry` are stored with triage statuses (`new`, `read`,
  `reviewing`, `accepted`, `responded`, …).
* **Auth** — add `User` + role models, then mount `/api/admin/*` routers behind
  authentication middleware. Public controllers do not need to change.
* **Drive** — populate `fileId`/`fileProvider` through a dedicated upload service.
* **Secret hygiene** — credentials stay in `.env`; the admin frontend will call
  the same JSON API with a session/token, never the database.

---

## Appendix A — Complete source code

Every file of the Phase 1 implementation, exactly as it exists in the repository.


### Repository root

#### `package.json`

```json
{
  "name": "aramiot-website",
  "version": "1.0.0",
  "private": true,
  "description": "ARAMIOT Phase 1 - public website, Express REST API and MongoDB/Mongoose content architecture",
  "main": "backend/server.js",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "start": "node backend/server.js",
    "dev": "node --watch backend/server.js",
    "dev:memory": "USE_IN_MEMORY_DB=true node backend/server.js",
    "seed": "node backend/seed/seed.js",
    "test": "node --test backend/tests/*.test.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mongoose": "^8.5.1"
  },
  "devDependencies": {
    "mongodb-memory-server": "^10.0.0"
  }
}
```

#### `README.md`

````markdown
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
````

#### `.env.example`

```ini
# ------------------------------------------------------------------
# ARAMIOT - Phase 1 environment template
# Copy this file to .env and adjust the values for your machine.
# Never commit .env (it is git-ignored).
# ------------------------------------------------------------------

# Runtime
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# MongoDB (Community Edition, local or Atlas connection string)
MONGODB_URI=mongodb://127.0.0.1:27017/aramiot

# Comma separated list of origins allowed to call the API from a browser.
# Only needed when the frontend is served from a different origin than the API.
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500

# Serve the static frontend from the Express server (convenient for local dev).
SERVE_FRONTEND=true

# Public site URL, used for canonical/Open Graph metadata in the frontend.
SITE_URL=http://localhost:5000

# Dev only: start a throw-away in-memory MongoDB and seed sample data.
# Requires the mongodb-memory-server dev dependency. Never enable in production.
USE_IN_MEMORY_DB=false
```

#### `.gitignore`

```gitignore
# Dependencies
node_modules/

# Environment secrets
.env
.env.*
!.env.example

# Logs
*.log
npm-debug.log*

# Local file uploads (Phase 1 uses URLs / Google Drive file ids)
uploads/
!uploads/.gitkeep

# OS / editor noise
.DS_Store
Thumbs.db
.vscode/
.idea/

# Test and build output
coverage/
dist/
.mongodb-binaries/
```

### Backend — configuration

#### `backend/config/env.js`

```js
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

const port = Number.parseInt(process.env.PORT || '5000', 10);
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
};

module.exports = config;
```

#### `backend/config/database.js`

```js
'use strict';

/**
 * MongoDB connection management.
 *
 * The URI always comes from the environment (MONGODB_URI); no credentials are
 * ever written into source files or sent to the browser.
 */

const mongoose = require('mongoose');

// Fail fast on query fields that are not in the schema instead of silently ignoring them.
mongoose.set('strictQuery', true);

let listenersAttached = false;

function attachConnectionLogging() {
  if (listenersAttached) return;
  listenersAttached = true;

  const { connection } = mongoose;

  connection.on('connected', () => {
    // Never log the URI itself: it can contain credentials.
    console.log(`[db] connected to MongoDB database "${connection.name}"`);
  });

  connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  connection.on('error', (error) => {
    console.error('[db] MongoDB connection error:', error.message);
  });
}

/**
 * Connect to MongoDB.
 * @param {string} [uri] Optional override, defaults to process.env.MONGODB_URI.
 * @returns {Promise<import('mongoose').Connection>}
 */
async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env and provide a MongoDB connection string.'
    );
  }

  attachConnectionLogging();

  await mongoose.connect(uri, {
    // Give up quickly instead of hanging the API when MongoDB is not running.
    serverSelectionTimeoutMS: 10000,
    // Indexes are created automatically in development; production should build
    // them deliberately (see README).
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  return mongoose.connection;
}

/** Close the connection (used by tests and graceful shutdown). */
async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/** True when the connection is ready to accept queries. */
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseConnected };
```

#### `backend/config/constants.js`

```js
'use strict';

/**
 * Shared enums and constants.
 *
 * A single source of truth for the values that appear in Mongoose schemas,
 * validators and the public API, so a mismatch is impossible.
 */

/** Editorial lifecycle shared by every content model (Phase 2 admin uses these). */
const CONTENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

const CONTENT_STATUS_VALUES = Object.freeze([
  CONTENT_STATUS.DRAFT,
  CONTENT_STATUS.PUBLISHED,
  CONTENT_STATUS.ARCHIVED,
]);

/** Which website section a Page belongs to. */
const PAGE_SECTIONS = Object.freeze([
  'home',
  'overview',
  'about',
  'health',
  'education',
  'advocacy',
  'our-work',
  'resources',
  'get-involved',
  'contact',
]);

/** A category is scoped to the content type it classifies. */
const CATEGORY_SCOPES = Object.freeze([
  'articles',
  'projects',
  'programs',
  'publications',
  'resources',
  'general',
]);

/** Where a file or image currently lives. 'google-drive' is reserved for Phase 3. */
const MEDIA_PROVIDERS = Object.freeze(['local', 'google-drive']);
const DEFAULT_MEDIA_PROVIDER = 'local';

/** Publication types surfaced on the Resources / Publications pages. */
const PUBLICATION_TYPES = Object.freeze([
  'report',
  'research-paper',
  'policy-brief',
  'technical-report',
  'other',
]);

/** Downloadable resource types. */
const RESOURCE_TYPES = Object.freeze([
  'learning-material',
  'guideline',
  'toolkit',
  'dataset',
  'other',
]);

/** Inbox states used by the three public submission models. */
const CONTACT_MESSAGE_STATUS = Object.freeze(['new', 'read', 'replied', 'archived']);
const VOLUNTEER_STATUS = Object.freeze(['new', 'reviewing', 'accepted', 'declined', 'archived']);
const PARTNERSHIP_STATUS = Object.freeze(['new', 'reviewing', 'responded', 'closed']);

/** Values the frontend uses for the "area of interest" and similar select fields. */
const AREAS_OF_INTEREST = Object.freeze([
  'health',
  'education',
  'advocacy',
  'research',
  'communications',
  'fundraising',
  'operations',
  'other',
]);

module.exports = {
  CONTENT_STATUS,
  CONTENT_STATUS_VALUES,
  PAGE_SECTIONS,
  CATEGORY_SCOPES,
  MEDIA_PROVIDERS,
  DEFAULT_MEDIA_PROVIDER,
  PUBLICATION_TYPES,
  RESOURCE_TYPES,
  CONTACT_MESSAGE_STATUS,
  VOLUNTEER_STATUS,
  PARTNERSHIP_STATUS,
  AREAS_OF_INTEREST,
};
```

### Backend — Mongoose models

#### `backend/models/sharedFields.js`

```js
'use strict';

/**
 * Reusable schema fragments.
 *
 * Every model shares slug, status, media and SEO definitions so the editorial
 * rules (and the future Super Admin UI) behave identically across content types.
 */

const mongoose = require('mongoose');
const {
  CONTENT_STATUS,
  CONTENT_STATUS_VALUES,
  MEDIA_PROVIDERS,
  DEFAULT_MEDIA_PROVIDER,
} = require('../config/constants');
const { slugify } = require('../utils/slugify');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Unique, lowercase, hyphenated public identifier used in URLs. */
const slugField = {
  type: String,
  required: [true, 'Slug is required'],
  unique: true,
  trim: true,
  lowercase: true,
  match: [SLUG_PATTERN, 'Slug may only contain lowercase letters, numbers and single hyphens'],
};

/** Editorial lifecycle: draft -> published -> archived. */
const statusField = {
  type: String,
  enum: {
    values: CONTENT_STATUS_VALUES,
    message: `Status must be one of: ${CONTENT_STATUS_VALUES.join(', ')}`,
  },
  default: CONTENT_STATUS.DRAFT,
  index: true,
};

/**
 * Image or file reference.
 * fileId/provider are placeholders for the future Google Drive integration:
 * Phase 1 stores a local or remote URL, Phase 3 can store a Drive file id.
 */
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: [true, 'Media URL is required'], trim: true },
    alt: { type: String, trim: true, maxlength: 200, default: '' },
    fileId: { type: String, trim: true, default: '' },
    provider: {
      type: String,
      enum: { values: MEDIA_PROVIDERS, message: `Provider must be one of: ${MEDIA_PROVIDERS.join(', ')}` },
      default: DEFAULT_MEDIA_PROVIDER,
    },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  { _id: false }
);

/** Search engine metadata, editable per document by the future Super Admin. */
const seoFields = {
  seoTitle: { type: String, trim: true, maxlength: 70 },
  seoDescription: { type: String, trim: true, maxlength: 160 },
};

/** Standard schema options: timestamps, no __v in the public JSON, virtual `id`. */
const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

/** Submission-only models need a creation date but are never edited, so no updatedAt. */
const submissionSchemaOptions = {
  ...baseSchemaOptions,
  timestamps: { createdAt: true, updatedAt: false },
};

/** Derive a slug from the title when the caller did not supply one. */
function slugPlugin(schema) {
  schema.pre('validate', function generateSlug(next) {
    if (!this.slug && this.title) {
      this.slug = slugify(this.title);
    }
    next();
  });
}

module.exports = {
  SLUG_PATTERN,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  baseSchemaOptions,
  submissionSchemaOptions,
  slugPlugin,
};
```

#### `backend/models/Organization.js`

```js
'use strict';

/**
 * Organization
 * Single-document collection holding ARAMIOT's institutional information.
 * The public site reads it through GET /api/organization; Phase 2 lets the
 * Super Admin edit the same document.
 */

const mongoose = require('mongoose');
const { baseSchemaOptions, mediaSchema } = require('./sharedFields');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const socialLinksSchema = new mongoose.Schema(
  {
    facebook: { type: String, trim: true, default: '' },
    x: { type: String, trim: true, default: '' },
    instagram: { type: String, trim: true, default: '' },
    linkedin: { type: String, trim: true, default: '' },
    youtube: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Organization name is required'], trim: true, maxlength: 160 },
    tagline: { type: String, trim: true, maxlength: 220, default: '' },
    description: { type: String, trim: true, default: '' },
    story: { type: String, trim: true, default: '' },
    mission: { type: String, trim: true, default: '' },
    vision: { type: String, trim: true, default: '' },
    values: { type: [String], default: [] },
    logo: { type: mediaSchema, default: undefined },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Contact email must be a valid email address'],
      default: '',
    },
    contactPhone: { type: String, trim: true, maxlength: 40, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    socialLinks: { type: socialLinksSchema, default: () => ({}) },
  },
  baseSchemaOptions
);

module.exports = mongoose.model('Organization', organizationSchema);
```

#### `backend/models/Page.js`

```js
'use strict';

/**
 * Page
 * Editable content for the general website pages (Overview, About, Health,
 * Education, Advocacy, Get Involved, Contact ...). The frontend renders the
 * `content` supplied by the API instead of hardcoding copy in HTML.
 */

const mongoose = require('mongoose');
const { PAGE_SECTIONS } = require('../config/constants');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 160, index: true },
    slug: slugField,
    section: {
      type: String,
      required: [true, 'Section is required'],
      enum: { values: PAGE_SECTIONS, message: `Section must be one of: ${PAGE_SECTIONS.join(', ')}` },
      index: true,
    },
    content: { type: String, default: '' },
    excerpt: { type: String, trim: true, maxlength: 320, default: '' },
    featuredImage: { type: mediaSchema, default: undefined },
    ...seoFields,
    status: statusField,
    publishedAt: { type: Date, default: null, index: true },
  },
  baseSchemaOptions
);

pageSchema.plugin(slugPlugin);

// Fast lookup of the published pages that belong to one section of the site.
pageSchema.index({ section: 1, status: 1 });
pageSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Page', pageSchema);
```

#### `backend/models/Article.js`

```js
'use strict';

/**
 * Article
 * News posts and articles shown on the home page, the Health / Education /
 * Advocacy pages and the resources listing.
 */

const mongoose = require('mongoose');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200, index: true },
    slug: slugField,
    excerpt: { type: String, trim: true, maxlength: 400, default: '' },
    content: { type: String, default: '' },
    featuredImage: { type: mediaSchema, default: undefined },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    tags: { type: [String], default: [], index: true },
    author: { type: String, trim: true, maxlength: 120, default: 'ARAMIOT' },
    ...seoFields,
    status: statusField,
    publishedAt: { type: Date, default: null, index: true },
  },
  baseSchemaOptions
);

articleSchema.plugin(slugPlugin);

// Listing queries: published articles, optionally filtered by category, newest first.
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ category: 1, status: 1, publishedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
```

#### `backend/models/Category.js`

```js
'use strict';

/**
 * Category
 * One taxonomy collection shared by articles, projects, programs, publications
 * and resources. `scopes` records which content types a category classifies
 * (a "Health" category can serve articles *and* projects), and `parentCategory`
 * allows a light two-level hierarchy such as Health > Mental Health.
 */

const mongoose = require('mongoose');
const { CATEGORY_SCOPES } = require('../config/constants');
const { baseSchemaOptions, slugField, slugPlugin } = require('./sharedFields');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true, maxlength: 120, index: true },
    slug: slugField,
    description: { type: String, trim: true, maxlength: 320, default: '' },
    scopes: {
      type: [{ type: String, enum: { values: CATEGORY_SCOPES, message: `Invalid category scope: {VALUE}` } }],
      default: ['general'],
      index: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
  },
  baseSchemaOptions
);

categorySchema.plugin(slugPlugin);

categorySchema.path('scopes').validate(function atLeastOneScope(value) {
  return Array.isArray(value) && value.length > 0;
}, 'A category needs at least one scope');

module.exports = mongoose.model('Category', categorySchema);
```

#### `backend/models/Project.js`

```js
'use strict';

/**
 * Project
 * Time-bound work with objectives, activities, a location and a date range.
 * Rendered on the Our Work page and featured on the home page.
 */

const mongoose = require('mongoose');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  slugPlugin,
} = require('./sharedFields');

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200, index: true },
    slug: slugField,
    summary: { type: String, trim: true, maxlength: 400, default: '' },
    description: { type: String, default: '' },
    objectives: { type: [String], default: [] },
    activities: { type: [String], default: [] },
    location: { type: String, trim: true, maxlength: 160, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    status: statusField,
    featuredImage: { type: mediaSchema, default: undefined },
    gallery: { type: [mediaSchema], default: [] },
  },
  baseSchemaOptions
);

projectSchema.plugin(slugPlugin);

projectSchema.index({ status: 1, startDate: -1 });
projectSchema.index({ category: 1, status: 1 });

projectSchema.path('endDate').validate(function endAfterStart(value) {
  if (!value || !this.startDate) return true;
  return value >= this.startDate;
}, 'End date cannot be earlier than the start date');

module.exports = mongoose.model('Project', projectSchema);
```

#### `backend/models/Program.js`

```js
'use strict';

/**
 * Program
 * An ongoing service or programme (as opposed to a time-bound project).
 */

const mongoose = require('mongoose');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  slugPlugin,
} = require('./sharedFields');

const programSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200, index: true },
    slug: slugField,
    description: { type: String, default: '' },
    objectives: { type: [String], default: [] },
    activities: { type: [String], default: [] },
    targetAudience: { type: String, trim: true, maxlength: 220, default: '' },
    location: { type: String, trim: true, maxlength: 160, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    status: statusField,
    featuredImage: { type: mediaSchema, default: undefined },
  },
  baseSchemaOptions
);

programSchema.plugin(slugPlugin);

programSchema.index({ status: 1, title: 1 });
programSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Program', programSchema);
```

#### `backend/models/TeamMember.js`

```js
'use strict';

/**
 * TeamMember
 * Public team profiles, ordered on the About page by displayOrder.
 */

const mongoose = require('mongoose');
const { baseSchemaOptions, statusField, mediaSchema } = require('./sharedFields');

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 140, index: true },
    position: { type: String, required: [true, 'Position is required'], trim: true, maxlength: 140 },
    biography: { type: String, trim: true, default: '' },
    profileImage: { type: mediaSchema, default: undefined },
    department: { type: String, trim: true, maxlength: 120, default: '' },
    displayOrder: { type: Number, default: 0, min: 0 },
    status: statusField,
  },
  baseSchemaOptions
);

teamMemberSchema.index({ status: 1, displayOrder: 1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
```

#### `backend/models/Publication.js`

```js
'use strict';

/**
 * Publication
 * Research reports and papers. The PDF/document itself lives outside MongoDB:
 * Phase 1 stores a `fileUrl` (plus an optional Drive `fileId`), the future admin
 * dashboard uploads to Google Drive through the Drive API.
 */

const mongoose = require('mongoose');
const { PUBLICATION_TYPES, MEDIA_PROVIDERS, DEFAULT_MEDIA_PROVIDER } = require('../config/constants');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const publicationSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 240, index: true },
    slug: slugField,
    abstract: { type: String, trim: true, maxlength: 1200, default: '' },
    authors: { type: [String], default: [] },
    publicationType: {
      type: String,
      enum: { values: PUBLICATION_TYPES, message: `Publication type must be one of: ${PUBLICATION_TYPES.join(', ')}` },
      default: 'report',
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    coverImage: { type: mediaSchema, default: undefined },
    // Google Drive file id (Phase 3) and a resolvable/preview URL.
    fileId: { type: String, trim: true, default: '' },
    fileUrl: { type: String, trim: true, default: '' },
    fileProvider: {
      type: String,
      enum: { values: MEDIA_PROVIDERS, message: `File provider must be one of: ${MEDIA_PROVIDERS.join(', ')}` },
      default: DEFAULT_MEDIA_PROVIDER,
    },
    publicationDate: { type: Date, default: null, index: true },
    ...seoFields,
    status: statusField,
  },
  baseSchemaOptions
);

publicationSchema.plugin(slugPlugin);

publicationSchema.index({ status: 1, publicationDate: -1 });
publicationSchema.index({ category: 1, status: 1, publicationDate: -1 });

module.exports = mongoose.model('Publication', publicationSchema);
```

#### `backend/models/Resource.js`

```js
'use strict';

/**
 * Resource
 * Learning materials, guidelines and toolkits. A resource points at either an
 * uploaded document (fileUrl / Drive fileId) or an external link.
 */

const mongoose = require('mongoose');
const { RESOURCE_TYPES, MEDIA_PROVIDERS, DEFAULT_MEDIA_PROVIDER } = require('../config/constants');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 240, index: true },
    slug: slugField,
    description: { type: String, trim: true, default: '' },
    resourceType: {
      type: String,
      enum: { values: RESOURCE_TYPES, message: `Resource type must be one of: ${RESOURCE_TYPES.join(', ')}` },
      default: 'learning-material',
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    coverImage: { type: mediaSchema, default: undefined },
    fileId: { type: String, trim: true, default: '' },
    fileUrl: { type: String, trim: true, default: '' },
    fileProvider: {
      type: String,
      enum: { values: MEDIA_PROVIDERS, message: `File provider must be one of: ${MEDIA_PROVIDERS.join(', ')}` },
      default: DEFAULT_MEDIA_PROVIDER,
    },
    externalUrl: { type: String, trim: true, default: '' },
    ...seoFields,
    status: statusField,
  },
  baseSchemaOptions
);

resourceSchema.plugin(slugPlugin);

resourceSchema.index({ status: 1, title: 1 });
resourceSchema.index({ category: 1, status: 1 });
resourceSchema.index({ resourceType: 1, status: 1 });

module.exports = mongoose.model('Resource', resourceSchema);
```

#### `backend/models/ImpactStatistic.js`

```js
'use strict';

/**
 * ImpactStatistic
 * The counters shown in the "Our Impact" section.
 *
 * IMPORTANT: values are entered by the organization only. Sample seed entries use
 * value 0 and a description that says the figure is not yet verified. Never invent
 * impact numbers for this collection.
 */

const mongoose = require('mongoose');
const { baseSchemaOptions } = require('./sharedFields');

const impactStatisticSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    value: {
      type: Number,
      required: [true, 'Value is required'],
      min: [0, 'Impact values cannot be negative'],
    },
    unit: { type: String, trim: true, maxlength: 40, default: '' },
    description: { type: String, trim: true, maxlength: 240, default: '' },
    displayOrder: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: false, index: true },
  },
  baseSchemaOptions
);

impactStatisticSchema.index({ isPublished: 1, displayOrder: 1 });

module.exports = mongoose.model('ImpactStatistic', impactStatisticSchema);
```

#### `backend/models/ContactMessage.js`

```js
'use strict';

/**
 * ContactMessage
 * Every general enquiry submitted through the public contact form.
 * Created by POST /api/contact. Never readable through a public route.
 */

const mongoose = require('mongoose');
const { CONTACT_MESSAGE_STATUS } = require('../config/constants');
const { submissionSchemaOptions } = require('./sharedFields');

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 140 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 200,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address'],
    },
    subject: { type: String, required: [true, 'Subject is required'], trim: true, maxlength: 160 },
    message: { type: String, required: [true, 'Message is required'], trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: { values: CONTACT_MESSAGE_STATUS, message: `Status must be one of: ${CONTACT_MESSAGE_STATUS.join(', ')}` },
      default: 'new',
      index: true,
    },
  },
  submissionSchemaOptions
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
```

#### `backend/models/VolunteerApplication.js`

```js
'use strict';

/**
 * VolunteerApplication
 * Created by POST /api/volunteers from the Get Involved page.
 * Confidential: no public read route exists for this collection.
 */

const mongoose = require('mongoose');
const { VOLUNTEER_STATUS, AREAS_OF_INTEREST } = require('../config/constants');
const { submissionSchemaOptions } = require('./sharedFields');

const volunteerApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 140 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 200,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address'],
    },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    areaOfInterest: {
      type: String,
      required: [true, 'Area of interest is required'],
      enum: { values: AREAS_OF_INTEREST, message: `Area of interest must be one of: ${AREAS_OF_INTEREST.join(', ')}` },
    },
    experience: { type: String, trim: true, maxlength: 2000, default: '' },
    motivation: { type: String, required: [true, 'Motivation is required'], trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: { values: VOLUNTEER_STATUS, message: `Status must be one of: ${VOLUNTEER_STATUS.join(', ')}` },
      default: 'new',
      index: true,
    },
  },
  submissionSchemaOptions
);

volunteerApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VolunteerApplication', volunteerApplicationSchema);
```

#### `backend/models/PartnershipInquiry.js`

```js
'use strict';

/**
 * PartnershipInquiry
 * Created by POST /api/partnerships for organizations that want to collaborate.
 * Confidential: no public read route exists for this collection.
 */

const mongoose = require('mongoose');
const { PARTNERSHIP_STATUS } = require('../config/constants');
const { submissionSchemaOptions } = require('./sharedFields');

const partnershipInquirySchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: 200,
    },
    contactPerson: { type: String, required: [true, 'Contact person is required'], trim: true, maxlength: 140 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 200,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address'],
    },
    subject: { type: String, required: [true, 'Subject is required'], trim: true, maxlength: 160 },
    message: { type: String, required: [true, 'Message is required'], trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: { values: PARTNERSHIP_STATUS, message: `Status must be one of: ${PARTNERSHIP_STATUS.join(', ')}` },
      default: 'new',
      index: true,
    },
  },
  submissionSchemaOptions
);

partnershipInquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model('PartnershipInquiry', partnershipInquirySchema);
```

### Backend — utilities and services

#### `backend/utils/ApiError.js`

```js
'use strict';

/**
 * Operational error with an HTTP status code.
 * The error handler translates these into the API's consistent JSON error shape,
 * so controllers can `throw` instead of building responses by hand.
 */

const STATUS_CODES = {
  400: 'BAD_REQUEST',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || STATUS_CODES[statusCode] || 'ERROR';
    this.details = options.details;
    this.isOperational = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }

  /** Field-level validation failure. `details` is [{ field, message }]. */
  static validation(details, message = 'The submitted data is invalid') {
    return new ApiError(400, message, { code: 'VALIDATION_ERROR', details });
  }

  static forbidden(message = 'This request is not allowed') {
    return new ApiError(403, message);
  }

  static notFound(message = 'The requested resource was not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'The request conflicts with existing data') {
    return new ApiError(409, message);
  }
}

module.exports = ApiError;
```

#### `backend/utils/asyncHandler.js`

```js
'use strict';

/**
 * Wrap an async route handler so rejected promises reach Express' error handler.
 * Without this, an await that throws inside a handler hangs the request.
 */

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
```

#### `backend/utils/validate.js`

```js
'use strict';

/**
 * A very small, dependency-free validation engine for public POST payloads.
 *
 * Design goals:
 *  - whitelist: only declared fields are ever copied into the model;
 *  - sanitise: strip control characters and HTML tags from plain-text input;
 *  - report: return every problem at once as [{ field, message }].
 */

// Printable control characters and tag-like sequences are removed from plain text.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAG_LIKE = /<\/?[a-zA-Z][^>]*>/g;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{5,24}$/;

/**
 * Trim, drop control characters and strip tag-like sequences while keeping
 * ordinary text such as "5 < 10" intact.
 */
function sanitizeText(value) {
  return String(value)
    .replace(CONTROL_CHARACTERS, '')
    .replace(TAG_LIKE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function validateString(raw, rule, label, field, errors, value) {
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${label} must be text` });
    return;
  }

  const text = sanitizeText(raw);
  const min = rule.min ?? 0;
  const max = rule.max ?? 5000;

  if (text.length < min) {
    errors.push({ field, message: `${label} must be at least ${min} characters` });
    return;
  }
  if (text.length > max) {
    errors.push({ field, message: `${label} must be ${max} characters or fewer` });
    return;
  }
  value[field] = text;
}

/**
 * Validate a payload against a rule map.
 *
 * @param {object} input Raw request body.
 * @param {object} rules Field name -> rule ({ type, required, min, max, label, values, default }).
 * @returns {{ value: object, errors: Array<{ field: string, message: string }> }}
 */
function validatePayload(input, rules) {
  const value = {};
  const errors = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { value, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    const raw = input[field];

    if (isBlank(raw)) {
      if (rule.required) errors.push({ field, message: `${label} is required` });
      else if (rule.default !== undefined) value[field] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'email': {
        if (typeof raw !== 'string') {
          errors.push({ field, message: `${label} must be a valid email address` });
          break;
        }
        const email = sanitizeText(raw).toLowerCase();
        if (!EMAIL_PATTERN.test(email) || email.length > (rule.max ?? 200)) {
          errors.push({ field, message: `${label} must be a valid email address` });
        } else {
          value[field] = email;
        }
        break;
      }

      case 'phone': {
        if (typeof raw !== 'string') {
          errors.push({ field, message: `${label} must be a phone number` });
          break;
        }
        const phone = sanitizeText(raw);
        if (!PHONE_PATTERN.test(phone)) {
          errors.push({ field, message: `${label} must be a valid phone number` });
        } else {
          value[field] = phone;
        }
        break;
      }

      case 'url': {
        if (typeof raw !== 'string' || !URL_PATTERN.test(raw.trim())) {
          errors.push({ field, message: `${label} must be a valid http(s) URL` });
          break;
        }
        value[field] = raw.trim();
        break;
      }

      case 'enum': {
        const candidate = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
        if (!Array.isArray(rule.values) || !rule.values.includes(candidate)) {
          errors.push({ field, message: `${label} must be one of: ${(rule.values || []).join(', ')}` });
        } else {
          value[field] = candidate;
        }
        break;
      }

      case 'string':
      default:
        validateString(raw, rule, label, field, errors, value);
        break;
    }
  }

  return { value, errors };
}

module.exports = { validatePayload, sanitizeText, isBlank };
```

#### `backend/utils/query.js`

```js
'use strict';

/**
 * Query-string helpers shared by every public listing endpoint.
 * Invalid paging/sort input is rejected (400) instead of being silently ignored,
 * and every list is bounded so a client cannot request the whole collection.
 */

const ApiError = require('./ApiError');

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 120;

function parseInteger(raw, { field, fallback, min, max }) {
  if (raw === undefined || raw === '') return fallback;

  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw ApiError.badRequest(`${field} must be a positive integer`);
  }

  const value = Number(text);
  if (value < min || value > max) {
    throw ApiError.badRequest(`${field} must be between ${min} and ${max}`);
  }
  return value;
}

/** @returns {{ page: number, limit: number, skip: number }} */
function parsePagination(query = {}) {
  const page = parseInteger(query.page, { field: 'page', fallback: 1, min: 1, max: 100000 });
  const limit = parseInteger(query.limit, { field: 'limit', fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT });
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Validate a sort expression such as "-publishedAt" against an allow-list.
 * Only allow-listed fields can reach MongoDB, which prevents sort injection.
 */
function parseSort(raw, allowed, fallback) {
  if (raw === undefined || raw === '') return fallback;

  const sort = String(raw).trim();
  if (!allowed.includes(sort)) {
    throw ApiError.badRequest(`sort must be one of: ${allowed.join(', ')}`);
  }
  return sort;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" search across whitelisted fields. */
function buildSearchFilter(search, fields) {
  const term = String(search ?? '').trim();
  if (!term) return null;

  if (term.length > MAX_SEARCH_LENGTH) {
    throw ApiError.badRequest(`search must be ${MAX_SEARCH_LENGTH} characters or fewer`);
  }

  const pattern = new RegExp(escapeRegExp(term), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

/** Read a single string query parameter, trimmed, or undefined. */
function readString(raw, maxLength = 200) {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.length > maxLength) {
    throw ApiError.badRequest(`Query value must be ${maxLength} characters or fewer`);
  }
  return value;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  parseSort,
  buildSearchFilter,
  escapeRegExp,
  readString,
};
```

#### `backend/utils/slugify.js`

```js
'use strict';

/**
 * Convert arbitrary text into a URL-safe slug.
 * "Our Approach & Values" -> "our-approach-values"
 */
function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

module.exports = { slugify };
```

#### `backend/services/contentService.js`

```js
'use strict';

/**
 * Generic public read handlers.
 *
 * Every content collection exposes the same contract (list + detail), so the
 * filtering, pagination, search and "published only" rules live here once and
 * each controller simply declares its options.
 */

const Category = require('../models/Category');
const { CONTENT_STATUS } = require('../config/constants');
const { parsePagination, parseSort, buildSearchFilter, readString } = require('../utils/query');
const { SLUG_PATTERN } = require('../models/sharedFields');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const DEFAULT_SORTABLE = ['-publishedAt', 'publishedAt', 'title', '-createdAt', '-updatedAt'];

/**
 * Filter that makes a document publicly visible:
 * it is published and (when the model has a date) already released.
 * Scheduled posts with a future date stay hidden.
 */
function visibilityFilter(dateField) {
  const filter = { status: CONTENT_STATUS.PUBLISHED };
  if (dateField) filter[dateField] = { $lte: new Date() };
  return filter;
}

/** Resolve ?category=<slug> to an ObjectId. Unknown slugs match nothing. */
async function resolveCategoryId(slug) {
  const category = await Category.findOne({ slug }).select('_id').lean();
  return category ? category._id : null;
}

function buildMeta({ page, limit, total, sort, search }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    pages,
    hasNextPage: page < pages,
    hasPrevPage: page > 1,
    sort,
    search: search || null,
  };
}

/**
 * @param {import('mongoose').Model} Model
 * @param {object} options
 * @param {string} [options.label] Used in 404 messages.
 * @param {string|null} [options.dateField] Date used for "already published" checks and default sorting.
 * @param {string[]} [options.searchFields]
 * @param {Record<string, string>} [options.filterFields] query param -> document field (exact match).
 * @param {string[]} [options.sortable]
 * @param {string} [options.defaultSort]
 * @param {object|null} [options.populate]
 * @param {boolean} [options.categoryFilter] Enable ?category=<slug>.
 * @param {object} [options.baseFilter] Always-applied filter (e.g. isPublished: true).
 */
function buildListHandler(Model, options = {}) {
  const {
    label = 'items',
    dateField = 'publishedAt',
    searchFields = ['title'],
    filterFields = {},
    sortable = DEFAULT_SORTABLE,
    defaultSort = '-publishedAt',
    populate = { path: 'category', select: 'name slug' },
    categoryFilter = false,
    baseFilter = {},
  } = options;

  return asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const sort = parseSort(req.query.sort, sortable, defaultSort);
    const search = readString(req.query.search);

    const filter = { ...visibilityFilter(dateField), ...baseFilter };

    for (const [param, field] of Object.entries(filterFields)) {
      const raw = readString(req.query[param]);
      if (raw) filter[field] = raw.toLowerCase();
    }

    if (categoryFilter) {
      const categorySlug = readString(req.query.category, 120);
      if (categorySlug) filter.category = await resolveCategoryId(categorySlug.toLowerCase());
    }

    if (search) {
      Object.assign(filter, buildSearchFilter(search, searchFields));
    }

    const query = Model.find(filter).sort(sort).skip(skip).limit(limit);
    if (populate) query.populate(populate);

    const [items, total] = await Promise.all([query.exec(), Model.countDocuments(filter)]);

    res.json({
      success: true,
      data: items,
      meta: buildMeta({ page, limit, total, sort, search }),
      message: items.length === 0 ? `No published ${label} matched this request` : undefined,
    });
  });
}

/**
 * Detail handler: GET .../:slug
 * Only published documents are reachable, so draft content cannot be guessed.
 */
function buildDetailHandler(Model, options = {}) {
  const {
    label = 'item',
    dateField = 'publishedAt',
    populate = { path: 'category', select: 'name slug' },
  } = options;

  return asyncHandler(async (req, res) => {
    const { slug } = req.params;

    if (!SLUG_PATTERN.test(slug)) {
      throw ApiError.badRequest(`Invalid ${label} slug "${slug}"`);
    }

    const query = Model.findOne({ slug, ...visibilityFilter(dateField) });
    if (populate) query.populate(populate);

    const doc = await query.exec();
    if (!doc) throw ApiError.notFound(`No published ${label} exists with slug "${slug}"`);

    res.json({ success: true, data: doc });
  });
}

module.exports = { buildListHandler, buildDetailHandler, visibilityFilter, resolveCategoryId };
```

### Backend — middleware and validators

#### `backend/middleware/errorHandler.js`

```js
'use strict';

/**
 * Terminal error handler.
 * Converts every error (ours, Mongoose', Express') into one JSON shape:
 *   { success: false, error: { code, message, details? } }
 */

const ApiError = require('../utils/ApiError');
const config = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred. Please try again later.';
  let details;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError' && error.errors) {
    // Mongoose schema validation (e.g. a bad enum reaching the database layer).
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'The submitted data is invalid';
    details = Object.entries(error.errors).map(([field, issue]) => ({
      field,
      message: issue.message,
    }));
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid value for "${error.path}"`;
  } else if (error.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists`;
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body must be valid JSON';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    code = error.code || 'ERROR';
    message = error.message || message;
  }

  if (statusCode >= 500) {
    console.error(`[api] ${req.method} ${req.originalUrl} -> ${statusCode}`, error);
  } else if (!config.isProduction) {
    console.warn(`[api] ${req.method} ${req.originalUrl} -> ${statusCode} (${code}): ${message}`);
  }

  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
```

#### `backend/middleware/notFound.js`

```js
'use strict';

/**
 * 404 handling.
 * API paths always receive JSON; website paths receive the static 404 page so a
 * mistyped URL still looks like part of the site.
 */

const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

/** Any unmatched /api/* request. */
function apiNotFound(req, res, next) {
  next(new ApiError(404, `Unknown API endpoint: ${req.method} ${req.originalUrl}`));
}

/** Any other unmatched request. */
function notFound(req, res, next) {
  const acceptsHtml = req.accepts(['html', 'json']) === 'html';
  const notFoundPage = path.join(__dirname, '..', '..', 'frontend', '404.html');

  if (config.serveFrontend && acceptsHtml && fs.existsSync(notFoundPage)) {
    return res.status(404).sendFile(notFoundPage);
  }

  return apiNotFound(req, res, next);
}

module.exports = { notFound, apiNotFound };
```

#### `backend/middleware/securityHeaders.js`

```js
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
```

#### `backend/middleware/validateBody.js`

```js
'use strict';

/**
 * Body validation middleware.
 * On success the sanitised, whitelisted payload is attached as req.validatedBody,
 * so controllers never read req.body directly.
 */

const ApiError = require('../utils/ApiError');

function validateBody(validator, message) {
  return function validate(req, res, next) {
    const { value, errors } = validator(req.body);

    if (errors.length > 0) {
      return next(ApiError.validation(errors, message));
    }

    req.validatedBody = value;
    return next();
  };
}

module.exports = validateBody;
```

#### `backend/validators/contact.js`

```js
'use strict';

const { validatePayload } = require('../utils/validate');

/** POST /api/contact payload rules. */
const rules = {
  name: { type: 'string', required: true, min: 2, max: 140, label: 'Name' },
  email: { type: 'email', required: true, label: 'Email' },
  subject: { type: 'string', required: true, min: 3, max: 160, label: 'Subject' },
  message: { type: 'string', required: true, min: 10, max: 5000, label: 'Message' },
};

function validateContact(input) {
  return validatePayload(input, rules);
}

module.exports = { validateContact, rules };
```

#### `backend/validators/volunteer.js`

```js
'use strict';

const { validatePayload } = require('../utils/validate');
const { AREAS_OF_INTEREST } = require('../config/constants');

/** POST /api/volunteers payload rules. */
const rules = {
  fullName: { type: 'string', required: true, min: 2, max: 140, label: 'Full name' },
  email: { type: 'email', required: true, label: 'Email' },
  phone: { type: 'phone', required: false, label: 'Phone' },
  areaOfInterest: { type: 'enum', required: true, values: AREAS_OF_INTEREST, label: 'Area of interest' },
  experience: { type: 'string', required: false, max: 2000, label: 'Experience' },
  motivation: { type: 'string', required: true, min: 10, max: 2000, label: 'Motivation' },
};

function validateVolunteer(input) {
  return validatePayload(input, rules);
}

module.exports = { validateVolunteer, rules };
```

#### `backend/validators/partnership.js`

```js
'use strict';

const { validatePayload } = require('../utils/validate');

/** POST /api/partnerships payload rules. */
const rules = {
  organizationName: { type: 'string', required: true, min: 2, max: 200, label: 'Organization name' },
  contactPerson: { type: 'string', required: true, min: 2, max: 140, label: 'Contact person' },
  email: { type: 'email', required: true, label: 'Email' },
  subject: { type: 'string', required: true, min: 3, max: 160, label: 'Subject' },
  message: { type: 'string', required: true, min: 10, max: 5000, label: 'Message' },
};

function validatePartnership(input) {
  return validatePayload(input, rules);
}

module.exports = { validatePartnership, rules };
```

### Backend — controllers

#### `backend/controllers/organizationController.js`

```js
'use strict';

/**
 * GET /api/organization
 * Public institutional profile. A single document, edited later by the Super Admin.
 */

const Organization = require('../models/Organization');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const getOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findOne().sort({ updatedAt: -1 }).exec();

  if (!organization) {
    throw ApiError.notFound('The organization profile has not been published yet');
  }

  res.json({ success: true, data: organization });
});

module.exports = { getOrganization };
```

#### `backend/controllers/pageController.js`

```js
'use strict';

/**
 * Pages: editable website copy.
 * GET /api/pages?section=health
 * GET /api/pages/:slug
 */

const Page = require('../models/Page');
const { buildListHandler, buildDetailHandler } = require('../services/contentService');

const list = buildListHandler(Page, {
  label: 'pages',
  dateField: 'publishedAt',
  searchFields: ['title', 'excerpt'],
  filterFields: { section: 'section' },
  sortable: ['-publishedAt', 'publishedAt', 'title', 'section', '-updatedAt'],
  defaultSort: '-publishedAt',
  populate: null,
});

const getBySlug = buildDetailHandler(Page, {
  label: 'page',
  dateField: 'publishedAt',
  populate: null,
});

module.exports = { list, getBySlug };
```

#### `backend/controllers/articleController.js`

```js
'use strict';

/**
 * Articles (news and updates).
 * GET /api/articles?search=&category=&tag=&page=&limit=&sort=
 * GET /api/articles/:slug
 */

const Article = require('../models/Article');
const { buildListHandler, buildDetailHandler } = require('../services/contentService');

const list = buildListHandler(Article, {
  label: 'articles',
  dateField: 'publishedAt',
  searchFields: ['title', 'excerpt', 'tags'],
  filterFields: { tag: 'tags' },
  categoryFilter: true,
  sortable: ['-publishedAt', 'publishedAt', 'title', '-createdAt'],
  defaultSort: '-publishedAt',
  populate: { path: 'category', select: 'name slug' },
});

const getBySlug = buildDetailHandler(Article, {
  label: 'article',
  dateField: 'publishedAt',
  populate: { path: 'category', select: 'name slug' },
});

module.exports = { list, getBySlug };
```

#### `backend/controllers/projectController.js`

```js
'use strict';

/**
 * Projects (time-bound work shown on Our Work and the home page).
 * GET /api/projects?search=&category=&page=&limit=&sort=
 * GET /api/projects/:slug
 */

const Project = require('../models/Project');
const { buildListHandler, buildDetailHandler } = require('../services/contentService');

const list = buildListHandler(Project, {
  label: 'projects',
  dateField: null, // projects are visible as soon as they are published
  searchFields: ['title', 'summary', 'location'],
  categoryFilter: true,
  sortable: ['-startDate', 'startDate', '-publishedAt', 'title', '-createdAt'],
  defaultSort: '-startDate',
  populate: { path: 'category', select: 'name slug' },
});

const getBySlug = buildDetailHandler(Project, {
  label: 'project',
  dateField: null,
  populate: { path: 'category', select: 'name slug' },
});

module.exports = { list, getBySlug };
```

#### `backend/controllers/programController.js`

```js
'use strict';

/**
 * Programs (ongoing services).
 * GET /api/programs?search=&category=&page=&limit=&sort=
 * GET /api/programs/:slug
 */

const Program = require('../models/Program');
const { buildListHandler, buildDetailHandler } = require('../services/contentService');

const list = buildListHandler(Program, {
  label: 'programs',
  dateField: null,
  searchFields: ['title', 'description', 'targetAudience'],
  categoryFilter: true,
  sortable: ['title', '-createdAt', '-updatedAt'],
  defaultSort: 'title',
  populate: { path: 'category', select: 'name slug' },
});

const getBySlug = buildDetailHandler(Program, {
  label: 'program',
  dateField: null,
  populate: { path: 'category', select: 'name slug' },
});

module.exports = { list, getBySlug };
```

#### `backend/controllers/publicationController.js`

```js
'use strict';

/**
 * Publications (reports and papers).
 * GET /api/publications?search=&category=&publicationType=&page=&limit=&sort=
 * GET /api/publications/:slug
 */

const Publication = require('../models/Publication');
const { buildListHandler, buildDetailHandler } = require('../services/contentService');

const list = buildListHandler(Publication, {
  label: 'publications',
  dateField: 'publicationDate',
  searchFields: ['title', 'abstract', 'authors'],
  filterFields: { publicationType: 'publicationType' },
  categoryFilter: true,
  sortable: ['-publicationDate', 'publicationDate', 'title', '-createdAt'],
  defaultSort: '-publicationDate',
  populate: { path: 'category', select: 'name slug' },
});

const getBySlug = buildDetailHandler(Publication, {
  label: 'publication',
  dateField: 'publicationDate',
  populate: { path: 'category', select: 'name slug' },
});

module.exports = { list, getBySlug };
```

#### `backend/controllers/resourceController.js`

```js
'use strict';

/**
 * Resources (learning materials, guidelines, toolkits).
 * GET /api/resources?search=&category=&resourceType=&page=&limit=&sort=
 * GET /api/resources/:slug
 */

const Resource = require('../models/Resource');
const { buildListHandler, buildDetailHandler } = require('../services/contentService');

const list = buildListHandler(Resource, {
  label: 'resources',
  dateField: null,
  searchFields: ['title', 'description'],
  filterFields: { resourceType: 'resourceType' },
  categoryFilter: true,
  sortable: ['title', '-createdAt', '-updatedAt'],
  defaultSort: 'title',
  populate: { path: 'category', select: 'name slug' },
});

const getBySlug = buildDetailHandler(Resource, {
  label: 'resource',
  dateField: null,
  populate: { path: 'category', select: 'name slug' },
});

module.exports = { list, getBySlug };
```

#### `backend/controllers/teamController.js`

```js
'use strict';

/**
 * Team profiles: GET /api/team (list only, ordered for display).
 */

const TeamMember = require('../models/TeamMember');
const { buildListHandler } = require('../services/contentService');

const list = buildListHandler(TeamMember, {
  label: 'team members',
  dateField: null,
  searchFields: ['name', 'position', 'department'],
  sortable: ['displayOrder', 'name', '-createdAt'],
  defaultSort: 'displayOrder',
  populate: null,
});

module.exports = { list };
```

#### `backend/controllers/categoryController.js`

```js
'use strict';

/**
 * Categories: GET /api/categories?scope=articles
 * Categories have no editorial status; `scope` filters by content type.
 */

const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const { readString } = require('../utils/query');

const MAX_CATEGORIES = 500;

const list = asyncHandler(async (req, res) => {
  const scope = readString(req.query.scope, 40);
  const parentSlug = readString(req.query.parent, 120);

  const filter = {};
  if (scope) filter.scopes = scope.toLowerCase();

  if (parentSlug) {
    const parent = await Category.findOne({ slug: parentSlug.toLowerCase() }).select('_id').lean();
    filter.parentCategory = parent ? parent._id : null;
  }

  const categories = await Category.find(filter)
    .sort({ name: 1 })
    .limit(MAX_CATEGORIES)
    .populate({ path: 'parentCategory', select: 'name slug' })
    .exec();

  res.json({
    success: true,
    data: categories,
    meta: { total: categories.length, scope: scope || null, limit: MAX_CATEGORIES },
  });
});

module.exports = { list };
```

#### `backend/controllers/impactController.js`

```js
'use strict';

/**
 * GET /api/impact
 * Only statistics the organization has explicitly published are returned.
 * Figures are never generated, estimated or inferred by the application.
 */

const ImpactStatistic = require('../models/ImpactStatistic');
const { buildListHandler } = require('../services/contentService');

const list = buildListHandler(ImpactStatistic, {
  label: 'impact statistics',
  dateField: null,
  baseFilter: { isPublished: true },
  searchFields: ['title', 'description'],
  sortable: ['displayOrder', 'title', '-updatedAt'],
  defaultSort: 'displayOrder',
  populate: null,
});

module.exports = { list };
```

#### `backend/controllers/formController.js`

```js
'use strict';

/**
 * Public submission handlers: contact, volunteer, partnership.
 *
 * Each handler receives a validated + sanitised payload (req.validatedBody),
 * stores it, and returns only an identifier. Nothing submitted here is readable
 * through a public route; Phase 2 exposes these collections to the Super Admin.
 */

const ContactMessage = require('../models/ContactMessage');
const VolunteerApplication = require('../models/VolunteerApplication');
const PartnershipInquiry = require('../models/PartnershipInquiry');
const asyncHandler = require('../utils/asyncHandler');

function submissionReceipt(document) {
  return {
    id: document.id,
    status: document.status,
    createdAt: document.createdAt,
  };
}

async function storeContactMessage(req, res) {
  const message = await ContactMessage.create(req.validatedBody);
  res.status(201).json({
    success: true,
    message: 'Thank you for contacting ARAMIOT. Your message has been received.',
    data: submissionReceipt(message),
  });
}

async function storeVolunteerApplication(req, res) {
  const application = await VolunteerApplication.create(req.validatedBody);
  res.status(201).json({
    success: true,
    message: 'Thank you for volunteering. The ARAMIOT team will review your application.',
    data: submissionReceipt(application),
  });
}

async function storePartnershipInquiry(req, res) {
  const inquiry = await PartnershipInquiry.create(req.validatedBody);
  res.status(201).json({
    success: true,
    message: 'Thank you for your interest in partnering with ARAMIOT. We will be in touch.',
    data: submissionReceipt(inquiry),
  });
}

module.exports = {
  submitContact: asyncHandler(storeContactMessage),
  submitVolunteer: asyncHandler(storeVolunteerApplication),
  submitPartnership: asyncHandler(storePartnershipInquiry),
};
```

### Backend — routes

#### `backend/routes/index.js`

```js
'use strict';

/**
 * API router, mounted at /api by app.js.
 */

const express = require('express');
const contentRoutes = require('./content.routes');
const categoriesRoutes = require('./categories.routes');
const organizationRoutes = require('./organization.routes');
const teamRoutes = require('./team.routes');
const impactRoutes = require('./impact.routes');
const formsRoutes = require('./forms.routes');

const router = express.Router();

/** Self-describing index so the API is explorable without documentation. */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'ARAMIOT public API',
      phase: 1,
      version: '1.0.0',
      endpoints: {
        read: [
          'GET /api/health',
          'GET /api/organization',
          'GET /api/pages',
          'GET /api/pages/:slug',
          'GET /api/articles',
          'GET /api/articles/:slug',
          'GET /api/categories',
          'GET /api/projects',
          'GET /api/projects/:slug',
          'GET /api/programs',
          'GET /api/programs/:slug',
          'GET /api/team',
          'GET /api/publications',
          'GET /api/publications/:slug',
          'GET /api/resources',
          'GET /api/resources/:slug',
          'GET /api/impact',
        ],
        write: ['POST /api/contact', 'POST /api/volunteers', 'POST /api/partnerships'],
      },
    },
  });
});

router.use('/organization', organizationRoutes);
router.use('/categories', categoriesRoutes);
router.use('/team', teamRoutes);
router.use('/impact', impactRoutes);
router.use('/', contentRoutes);
router.use('/', formsRoutes);

module.exports = router;
```

#### `backend/routes/content.routes.js`

```js
'use strict';

/**
 * Content routes: pages, articles, projects, programs, publications, resources.
 * All six share the same list + detail contract.
 */

const express = require('express');
const pageController = require('../controllers/pageController');
const articleController = require('../controllers/articleController');
const projectController = require('../controllers/projectController');
const programController = require('../controllers/programController');
const publicationController = require('../controllers/publicationController');
const resourceController = require('../controllers/resourceController');

const router = express.Router();

const resources = [
  { path: '/pages', controller: pageController },
  { path: '/articles', controller: articleController },
  { path: '/projects', controller: projectController },
  { path: '/programs', controller: programController },
  { path: '/publications', controller: publicationController },
  { path: '/resources', controller: resourceController },
];

for (const { path: routePath, controller } of resources) {
  router.get(routePath, controller.list);
  router.get(`${routePath}/:slug`, controller.getBySlug);
}

module.exports = router;
```

#### `backend/routes/categories.routes.js`

```js
'use strict';

/** Taxonomy route: GET /api/categories */

const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.get('/', categoryController.list);

module.exports = router;
```

#### `backend/routes/organization.routes.js`

```js
'use strict';

/** Organization route: GET /api/organization */

const express = require('express');
const organizationController = require('../controllers/organizationController');

const router = express.Router();

router.get('/', organizationController.getOrganization);

module.exports = router;
```

#### `backend/routes/team.routes.js`

```js
'use strict';

/** Team route: GET /api/team */

const express = require('express');
const teamController = require('../controllers/teamController');

const router = express.Router();

router.get('/', teamController.list);

module.exports = router;
```

#### `backend/routes/impact.routes.js`

```js
'use strict';

/** Impact route: GET /api/impact */

const express = require('express');
const impactController = require('../controllers/impactController');

const router = express.Router();

router.get('/', impactController.list);

module.exports = router;
```

#### `backend/routes/forms.routes.js`

```js
'use strict';

/**
 * Public write routes.
 * Each POST is validated and sanitised before it reaches the controller, and the
 * payload is capped by the 100kb JSON body limit set in app.js.
 */

const express = require('express');
const formController = require('../controllers/formController');
const validateBody = require('../middleware/validateBody');
const { validateContact } = require('../validators/contact');
const { validateVolunteer } = require('../validators/volunteer');
const { validatePartnership } = require('../validators/partnership');

const router = express.Router();

router.post('/contact', validateBody(validateContact), formController.submitContact);
router.post('/volunteers', validateBody(validateVolunteer), formController.submitVolunteer);
router.post('/partnerships', validateBody(validatePartnership), formController.submitPartnership);

module.exports = router;
```

### Backend — application and entry point

#### `backend/app.js`

```js
'use strict';

/**
 * Express application.
 * Separated from server.js so tests can import the app without binding a port
 * to a fixed value.
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const { isDatabaseConnected } = require('./config/database');
const apiRoutes = require('./routes');
const securityHeaders = require('./middleware/securityHeaders');
const errorHandler = require('./middleware/errorHandler');
const { apiNotFound, notFound } = require('./middleware/notFound');
const ApiError = require('./utils/ApiError');
const { version } = require('../package.json');

const app = express();

app.disable('x-powered-by');
// Escape <, > and & inside JSON responses (safe for consumers, blocks XSSI).
app.set('json escape', true);

app.use(securityHeaders);

/**
 * CORS is only needed when the frontend is served from another origin.
 * Requests without an Origin header (same-origin, curl, tests) are always allowed.
 * An empty CORS_ORIGINS list means "allow any origin" (development default).
 */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(ApiError.forbidden(`Origin ${origin} is not allowed to call this API`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    maxAge: 600,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

/** Liveness/readiness probe used by tests, deployments and monitoring. */
app.get('/api/health', (req, res) => {
  const database = isDatabaseConnected() ? 'connected' : 'disconnected';
  const healthy = database === 'connected';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      database,
      environment: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      version,
    },
  });
});

app.use('/api', apiRoutes);
app.use('/api', apiNotFound);

// The public website is static; Express can serve it in development so the
// frontend and API share one origin. In production it may be served by a CDN.
if (config.serveFrontend) {
  app.use(
    express.static(path.join(__dirname, '..', 'frontend'), {
      extensions: ['html'],
      maxAge: config.isProduction ? '1h' : 0,
    })
  );
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
```

#### `backend/server.js`

```js
'use strict';

/**
 * Application entry point: connect to MongoDB, then listen.
 *
 * In development USE_IN_MEMORY_DB=true starts a throw-away in-memory MongoDB and
 * seeds sample content, so the site can be reviewed without installing MongoDB.
 */

const config = require('./config/env');
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

async function startInMemoryDatabase() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri('aramiot');
  console.log('[dev] in-memory MongoDB started (data is discarded on exit)');
  return memoryServer;
}

async function start() {
  let memoryServer = null;

  if (config.useInMemoryDb && !config.isProduction) {
    memoryServer = await startInMemoryDatabase();
  }

  await connectDatabase(process.env.MONGODB_URI || config.mongoUri);

  if (memoryServer) {
    const { seedDatabase } = require('./seed/sampleData');
    const summary = await seedDatabase({ clear: true });
    console.log('[dev] sample content seeded:', summary);
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[app] ARAMIOT API listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
    console.log(`[app] public website: http://localhost:${config.port}/`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[app] port ${config.port} is already in use. Set PORT in .env to a free port.`);
    } else {
      console.error('[app] failed to start HTTP server:', error.message);
    }
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[app] ${signal} received, shutting down`);

    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      if (memoryServer) await memoryServer.stop().catch(() => {});
      process.exit(0);
    });

    // Do not hang forever on lingering keep-alive sockets.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('[app] startup failed:', error.message);
  if (error.name === 'MongooseServerSelectionError') {
    console.error(
      '[app] MongoDB is not reachable. Start MongoDB, set MONGODB_URI in .env, or run "npm run dev:memory".'
    );
  }
  process.exit(1);
});
```

### Backend — sample content

#### `backend/seed/sampleData.js`

```js
'use strict';

/**
 * SAMPLE DATA — DEVELOPMENT ONLY
 * ==============================
 * Every document created here is placeholder content for building and reviewing
 * the site. It is NOT verified organizational information and must be replaced
 * through the Phase 2 admin dashboard before the site is published.
 *
 * Impact statistics are seeded with value 0 and an explicit "not verified"
 * description. Real figures must only be entered by the organization.
 */

const Organization = require('../models/Organization');
const Page = require('../models/Page');
const Category = require('../models/Category');
const Article = require('../models/Article');
const Project = require('../models/Project');
const Program = require('../models/Program');
const TeamMember = require('../models/TeamMember');
const Publication = require('../models/Publication');
const Resource = require('../models/Resource');
const ImpactStatistic = require('../models/ImpactStatistic');

const SAMPLE_NOTICE =
  'Sample content for development. Replace it with verified ARAMIOT information before launch.';

/** Build editable page HTML. Kept intentionally simple for a future rich-text editor. */
function pageContent(intro, blocks = []) {
  const parts = [`<p class="lead">${intro}</p>`, `<p class="content-notice"><em>${SAMPLE_NOTICE}</em></p>`];

  for (const block of blocks) {
    if (block.heading) parts.push(`<h2>${block.heading}</h2>`);
    if (block.text) parts.push(`<p>${block.text}</p>`);
    if (block.list) parts.push(`<ul>${block.list.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }

  return parts.join('\n');
}

const organization = {
  name: 'ARAMIOT',
  tagline: 'Health, education and advocacy for healthier, educated and empowered communities.',
  description:
    'ARAMIOT is a community-oriented initiative working across three interconnected areas: health, education and advocacy. We believe that access to health information, quality education and the protection of fundamental rights are essential to inclusive, resilient communities.',
  story:
    'This is sample organizational text. The verified history of ARAMIOT — founding, milestones and the communities it works with — should be written and approved by the organization, then entered through the admin dashboard.',
  mission:
    'To promote healthier, educated and empowered communities through accessible health information, inclusive education, research and human rights advocacy.',
  vision:
    'A society where every individual can access essential health knowledge, meaningful educational opportunities and fundamental rights without discrimination.',
  values: ['Community participation', 'Evidence and research', 'Inclusion and equity', 'Accountability'],
  contactEmail: 'contact@example.org',
  contactPhone: '+000 000 0000',
  address: {
    street: 'Sample address',
    city: 'Sample city',
    region: '',
    postalCode: '',
    country: 'Sample country',
  },
  socialLinks: {},
};

const pages = [
  {
    title: 'Organizational Overview',
    slug: 'overview',
    section: 'overview',
    excerpt: 'Who ARAMIOT is, what we do, how we work and the change we contribute to.',
    content: pageContent('ARAMIOT works across health, education and advocacy.', [
      {
        heading: 'What We Do',
        list: [
          'Share accessible, evidence-based health information with communities.',
          'Support learning through training, workshops and educational materials.',
          'Advocate for human rights, policy engagement and youth participation.',
        ],
      },
      {
        heading: 'Our Approach',
        text: 'We work with communities rather than for them: listening first, co-designing activities, documenting what happens, and sharing what we learn openly.',
      },
      {
        heading: 'Our Impact',
        text: 'Impact figures are published only once they are verified. The Our Impact section shows the statistics ARAMIOT has confirmed and released.',
      },
    ]),
  },
  {
    title: 'About ARAMIOT',
    slug: 'about',
    section: 'about',
    excerpt: 'Our story, mission, vision, values and the people behind the work.',
    content: pageContent('ARAMIOT is a community-based organization working at the intersection of health, education and advocacy.', [
      {
        heading: 'Our Story',
        text: 'The verified organizational story will replace this sample text. It should explain why ARAMIOT was founded, the communities it serves and the milestones reached so far.',
      },
      {
        heading: 'Our Values',
        list: [
          'Community participation — decisions are shaped with the people affected.',
          'Evidence and research — programmes are informed by data and documented honestly.',
          'Inclusion and equity — no one is excluded because of who they are.',
          'Accountability — resources and results are reported transparently.',
        ],
      },
    ]),
  },
  {
    title: 'Health',
    slug: 'health',
    section: 'health',
    excerpt: 'Public health, mental health, health awareness and disease prevention.',
    content: pageContent('Health information should be understandable, accessible and useful in everyday life.', [
      {
        heading: 'Public Health',
        text: 'Community-based health promotion, preventive services and practical information about healthy living.',
      },
      {
        heading: 'Mental Health',
        text: 'Awareness activities and learning materials that reduce stigma and encourage people to seek support.',
      },
      {
        heading: 'Health Awareness',
        text: 'Dialogues, campaigns and printed materials developed with community health volunteers.',
      },
      {
        heading: 'Disease Prevention',
        text: 'Prevention-focused sessions on hygiene, immunisation, non-communicable disease and early screening.',
      },
    ]),
  },
  {
    title: 'Education',
    slug: 'education',
    section: 'education',
    excerpt: 'Health education, training and workshops, research and knowledge sharing.',
    content: pageContent('Learning is the thread that connects every ARAMIOT programme.', [
      {
        heading: 'Health Education',
        text: 'Practical health literacy sessions designed with and for local communities.',
      },
      {
        heading: 'Training and Workshops',
        text: 'Short, participatory training for volunteers, teachers and community facilitators.',
      },
      {
        heading: 'Research',
        text: 'Community-level research that documents what works and what does not.',
      },
      {
        heading: 'Knowledge Sharing',
        text: 'Openly shared reports, guides and learning materials, listed in the Resources section.',
      },
    ]),
  },
  {
    title: 'Advocacy',
    slug: 'advocacy',
    section: 'advocacy',
    excerpt: 'Human rights, policy advocacy, youth advocacy and campaigns.',
    content: pageContent('Advocacy at ARAMIOT is evidence-based and community-led.', [
      {
        heading: 'Human Rights',
        text: 'Awareness of fundamental rights, with a focus on the right to health and to education.',
      },
      {
        heading: 'Policy Advocacy',
        text: 'Bringing documented community experience to local and national policy discussions.',
      },
      {
        heading: 'Youth Advocacy',
        text: 'Supporting young people to participate in decisions that affect their future.',
      },
      {
        heading: 'Campaigns',
        text: 'Time-bound public campaigns built around a single, clear ask.',
      },
    ]),
  },
  {
    title: 'Our Work',
    slug: 'our-work',
    section: 'our-work',
    excerpt: 'Projects, programmes, community initiatives and verified impact.',
    content: pageContent('Programmes and projects across the three core areas, documented as they happen.', []),
  },
  {
    title: 'Resources',
    slug: 'resources',
    section: 'resources',
    excerpt: 'Publications, reports, articles and learning materials.',
    content: pageContent('Research publications, reports and practical learning materials.', []),
  },
  {
    title: 'Get Involved',
    slug: 'get-involved',
    section: 'get-involved',
    excerpt: 'Volunteer, partner with us or support ARAMIOT initiatives.',
    content: pageContent('Sustainable community development requires collective action.', [
      {
        heading: 'Volunteer',
        text: 'Contribute time and skills across health, education, advocacy, research or communications. Applications are reviewed by the ARAMIOT team.',
      },
      {
        heading: 'Partner With Us',
        text: 'Institutions, civil society organizations and community groups can propose a partnership or joint initiative.',
      },
      {
        heading: 'Donate',
        text: 'A donations workflow is planned for a later phase. Please contact us in the meantime to discuss supporting ARAMIOT initiatives.',
      },
    ]),
  },
  {
    title: 'Contact',
    slug: 'contact',
    section: 'contact',
    excerpt: 'Contact information, partnership enquiries and the contact form.',
    content: pageContent('Send ARAMIOT a message and the team will respond as soon as possible.', []),
  },
];

const categories = [
  { name: 'Health', slug: 'health', description: 'Public health, mental health and prevention.', scopes: ['articles', 'projects', 'programs', 'publications', 'resources'] },
  { name: 'Education', slug: 'education', description: 'Health education, training and knowledge sharing.', scopes: ['articles', 'projects', 'programs', 'publications', 'resources'] },
  { name: 'Advocacy', slug: 'advocacy', description: 'Human rights, policy and youth advocacy.', scopes: ['articles', 'projects', 'programs', 'publications'] },
  { name: 'News', slug: 'news', description: 'Organizational news and announcements.', scopes: ['articles'] },
  { name: 'Public Health', slug: 'public-health', description: 'Community and preventive health topics.', parentSlug: 'health', scopes: ['articles', 'projects'] },
  { name: 'Mental Health', slug: 'mental-health', description: 'Mental health awareness and support.', parentSlug: 'health', scopes: ['articles', 'resources'] },
  { name: 'Reports', slug: 'reports', description: 'Organizational and field reports.', scopes: ['publications'] },
  { name: 'Research', slug: 'research', description: 'Research papers and policy briefs.', scopes: ['publications', 'articles'] },
  { name: 'Learning Materials', slug: 'learning-materials', description: 'Modules, guides and workshop materials.', scopes: ['resources'] },
  { name: 'Guidelines', slug: 'guidelines', description: 'Practical guidance documents.', scopes: ['resources'] },
];

function articleContent(intro, paragraphs = []) {
  return [`<p class="lead">${intro}</p>`, `<p class="content-notice"><em>${SAMPLE_NOTICE}</em></p>`]
    .concat(paragraphs.map((text) => `<p>${text}</p>`))
    .join('\n');
}

const articles = [
  {
    title: 'Community health awareness: why local conversations matter',
    slug: 'community-health-awareness-local-conversations',
    excerpt: 'Awareness begins with a conversation held in a language people already use.',
    categorySlug: 'public-health',
    tags: ['health', 'awareness'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-09-18T09:00:00Z'),
    content: articleContent(
      'Health awareness works best when it starts from the questions a community is already asking.',
      [
        'Sample article text. This placeholder describes how community dialogues are organised, who takes part and what participants say they find useful.',
        'Replace this text with a verified ARAMIOT article before publishing the site.',
      ]
    ),
  },
  {
    title: 'Mental health literacy in community settings',
    slug: 'mental-health-literacy-community-settings',
    excerpt: 'Reducing stigma starts with accurate, accessible language about mental health.',
    categorySlug: 'mental-health',
    tags: ['health', 'mental-health'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-08-04T09:00:00Z'),
    content: articleContent('Mental health is part of health, and community settings are where stigma is either reinforced or reduced.', [
      'Sample article text describing an awareness session, the materials used and the questions raised by participants.',
    ]),
  },
  {
    title: 'Building learning spaces that include everyone',
    slug: 'building-learning-spaces-that-include-everyone',
    excerpt: 'Practical adjustments that make workshops usable for more participants.',
    categorySlug: 'education',
    tags: ['education', 'inclusion'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-06-22T09:00:00Z'),
    content: articleContent('Inclusion is a design decision, not an afterthought.', [
      'Sample article text listing the practical adjustments ARAMIOT uses when preparing training sessions.',
    ]),
  },
  {
    title: 'Youth voices in policy dialogue',
    slug: 'youth-voices-in-policy-dialogue',
    excerpt: 'What changes when young people are in the room where decisions are made.',
    categorySlug: 'advocacy',
    tags: ['advocacy', 'youth'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-05-09T09:00:00Z'),
    content: articleContent('Participation is only meaningful when it happens before decisions are final.', [
      'Sample article text summarising a youth advocacy session and the issues participants raised.',
    ]),
  },
  {
    title: 'How we document community initiatives',
    slug: 'how-we-document-community-initiatives',
    excerpt: 'The documentation routine behind ARAMIOT reporting.',
    categorySlug: 'news',
    tags: ['research', 'transparency'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-03-14T09:00:00Z'),
    content: articleContent('Documentation is how a one-off activity becomes something others can learn from.', [
      'Sample article text describing the notes, photographs and feedback collected during an activity.',
    ]),
  },
  {
    // Draft: must never appear through the public API.
    title: 'Draft article kept for internal review',
    slug: 'draft-article-internal-review',
    excerpt: 'This article is a draft and must not be visible on the public website.',
    categorySlug: 'news',
    tags: ['internal'],
    author: 'ARAMIOT',
    status: 'draft',
    publishedAt: null,
    content: articleContent('Draft sample article used to verify that unpublished content stays hidden.', []),
  },
  {
    // Published but scheduled in the future: hidden until its date arrives.
    title: 'Scheduled announcement for the next season',
    slug: 'scheduled-announcement-next-season',
    excerpt: 'Scheduled content used to verify that future-dated articles stay hidden.',
    categorySlug: 'news',
    tags: ['internal'],
    author: 'ARAMIOT',
    status: 'published',
    publishedAt: new Date('2099-01-01T09:00:00Z'),
    content: articleContent('Scheduled sample article used to verify date-based visibility.', []),
  },
];

const projects = [
  {
    title: 'Community Health Awareness Initiative',
    slug: 'community-health-awareness-initiative',
    summary: 'Awareness sessions and materials developed with community health volunteers.',
    description:
      'Sample project description. Replace it with the verified purpose, scope and results of this initiative.',
    objectives: [
      'Increase understanding of preventive health practices.',
      'Strengthen the confidence of community health volunteers.',
    ],
    activities: ['Community dialogues', 'Printed awareness materials', 'Volunteer briefings'],
    location: 'Sample district',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-06-30'),
    categorySlug: 'health',
  },
  {
    title: 'Learning Support Programme',
    slug: 'learning-support-programme',
    summary: 'Training and learning materials for community facilitators.',
    description:
      'Sample project description covering the training cycle, the participants and the materials produced.',
    objectives: ['Deliver practical training to community facilitators.', 'Publish the materials openly.'],
    activities: ['Workshops', 'Facilitator handbook', 'Follow-up sessions'],
    location: 'Sample district',
    startDate: new Date('2026-02-01'),
    endDate: null,
    categorySlug: 'education',
  },
  {
    title: 'Youth Advocacy Sessions',
    slug: 'youth-advocacy-sessions',
    summary: 'Structured sessions supporting young people to engage in policy discussions.',
    description:
      'Sample project description explaining how the sessions were organised and what participants produced.',
    objectives: ['Build advocacy skills among young participants.', 'Document the issues raised.'],
    activities: ['Facilitated sessions', 'Policy dialogue', 'Documentation'],
    location: 'Sample district',
    startDate: new Date('2025-09-01'),
    endDate: new Date('2026-03-31'),
    categorySlug: 'advocacy',
  },
];

const programs = [
  {
    title: 'Community Health Dialogues',
    slug: 'community-health-dialogues',
    description:
      'Sample programme description for an ongoing series of community health conversations.',
    objectives: ['Create a recurring space for health questions.', 'Connect communities with local services.'],
    activities: ['Monthly dialogues', 'Referral information'],
    targetAudience: 'Community members and local health volunteers',
    location: 'Sample district',
    categorySlug: 'health',
  },
  {
    title: 'Training and Workshops',
    slug: 'training-and-workshops',
    description:
      'Sample programme description for short, participatory training delivered to partners and volunteers.',
    objectives: ['Strengthen practical skills.', 'Share ARAMIOT learning materials.'],
    activities: ['One-day workshops', 'Facilitator training'],
    targetAudience: 'Volunteers, teachers and partner organizations',
    location: 'Sample district',
    categorySlug: 'education',
  },
];

const teamMembers = [
  {
    name: 'Sample Team Member',
    position: 'Executive Director',
    biography: 'Sample profile. Replace with the verified biography of the Executive Director.',
    department: 'Leadership',
    displayOrder: 1,
  },
  {
    name: 'Sample Team Member',
    position: 'Programme Lead',
    biography: 'Sample profile. Replace with the verified biography of the Programme Lead.',
    department: 'Programmes',
    displayOrder: 2,
  },
  {
    name: 'Sample Team Member',
    position: 'Advocacy Lead',
    biography: 'Sample profile. Replace with the verified biography of the Advocacy Lead.',
    department: 'Advocacy',
    displayOrder: 3,
  },
];

const publications = [
  {
    title: 'Community Health Awareness: A Field Report',
    slug: 'community-health-awareness-field-report',
    abstract:
      'Sample abstract for a field report describing community health awareness activities, methods and observations.',
    authors: ['ARAMIOT (sample)'],
    publicationType: 'report',
    categorySlug: 'reports',
    publicationDate: new Date('2026-03-20'),
  },
  {
    title: 'Barriers to Health Information Access',
    slug: 'barriers-to-health-information-access',
    abstract:
      'Sample abstract for a research paper on the practical barriers people face when looking for health information.',
    authors: ['ARAMIOT (sample)'],
    publicationType: 'research-paper',
    categorySlug: 'research',
    publicationDate: new Date('2026-05-11'),
  },
  {
    title: 'Policy Brief: Youth Participation',
    slug: 'policy-brief-youth-participation',
    abstract:
      'Sample abstract for a policy brief on youth participation in local decision-making.',
    authors: ['ARAMIOT (sample)'],
    publicationType: 'policy-brief',
    categorySlug: 'research',
    publicationDate: new Date('2026-07-02'),
  },
];

const resources = [
  {
    title: 'Health Awareness Facilitation Guide',
    slug: 'health-awareness-facilitation-guide',
    description: 'Sample description of a facilitation guide for community health awareness sessions.',
    resourceType: 'guideline',
    categorySlug: 'guidelines',
  },
  {
    title: 'Community Workshop Toolkit',
    slug: 'community-workshop-toolkit',
    description: 'Sample description of a toolkit covering planning, facilitation and follow-up.',
    resourceType: 'toolkit',
    categorySlug: 'learning-materials',
  },
  {
    title: 'Introduction to Public Health: Learning Module',
    slug: 'introduction-to-public-health-learning-module',
    description: 'Sample description of a short introductory learning module on public health concepts.',
    resourceType: 'learning-material',
    categorySlug: 'learning-materials',
  },
];

/**
 * Impact statistics are deliberately published with value 0 and an explicit note.
 * Real figures must come from the organization, never from seed data.
 */
const impactStatistics = [
  { title: 'People reached', value: 0, unit: '', displayOrder: 1 },
  { title: 'Programmes', value: 0, unit: '', displayOrder: 2 },
  { title: 'Community initiatives', value: 0, unit: '', displayOrder: 3 },
  { title: 'Volunteers', value: 0, unit: '', displayOrder: 4 },
].map((statistic) => ({
  ...statistic,
  description: 'Sample placeholder. Replace with a verified figure provided by ARAMIOT.',
  isPublished: true,
}));

/**
 * Insert the sample content set.
 * @param {{ clear?: boolean }} options clear:true empties the content collections first.
 */
async function seedDatabase({ clear = true } = {}) {
  if (clear) {
    await Promise.all([
      Organization.deleteMany({}),
      Page.deleteMany({}),
      Category.deleteMany({}),
      Article.deleteMany({}),
      Project.deleteMany({}),
      Program.deleteMany({}),
      TeamMember.deleteMany({}),
      Publication.deleteMany({}),
      Resource.deleteMany({}),
      ImpactStatistic.deleteMany({}),
    ]);
  }

  await Organization.create(organization);

  const categoriesBySlug = {};
  for (const category of categories) {
    const { parentSlug, ...fields } = category;
    const document = await Category.create(fields);
    categoriesBySlug[category.slug] = document;
    if (parentSlug) document.parentCategory = categoriesBySlug[parentSlug]._id;
    if (parentSlug) await document.save();
  }

  for (const page of pages) {
    await Page.create({ ...page, status: 'published', publishedAt: new Date('2026-01-10T09:00:00Z') });
  }

  for (const article of articles) {
    const { categorySlug, ...fields } = article;
    await Article.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const project of projects) {
    const { categorySlug, ...fields } = project;
    await Project.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const program of programs) {
    const { categorySlug, ...fields } = program;
    await Program.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const member of teamMembers) {
    await TeamMember.create({ ...member, status: 'published' });
  }

  for (const publication of publications) {
    const { categorySlug, ...fields } = publication;
    await Publication.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const resource of resources) {
    const { categorySlug, ...fields } = resource;
    await Resource.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  await ImpactStatistic.insertMany(impactStatistics);

  return {
    organization: 1,
    pages: pages.length,
    categories: categories.length,
    articles: articles.length,
    projects: projects.length,
    programs: programs.length,
    teamMembers: teamMembers.length,
    publications: publications.length,
    resources: resources.length,
    impactStatistics: impactStatistics.length,
    note: 'Sample data only — replace with verified ARAMIOT content.',
  };
}

module.exports = { seedDatabase, SAMPLE_NOTICE };
```

#### `backend/seed/seed.js`

```js
'use strict';

/**
 * Seed the configured database with the sample content set.
 *
 *   npm run seed            # wipes the content collections, then inserts samples
 *   npm run seed -- --keep  # inserts without deleting existing documents
 */

require('../config/env');

const { connectDatabase, disconnectDatabase } = require('../config/database');
const { seedDatabase } = require('./sampleData');

async function main() {
  const clear = !process.argv.includes('--keep');

  console.log('[seed] connecting...');
  await connectDatabase();

  if (clear) {
    console.log('[seed] clearing content collections (sample data only)');
  }

  const summary = await seedDatabase({ clear });
  console.log('[seed] done:', summary);

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('[seed] failed:', error.message);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
```

### Backend — tests

#### `backend/tests/api.test.js`

```js
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
```

### Frontend — HTML pages

#### `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ARAMIOT | Health, Education & Advocacy</title>
  <meta name="description" content="ARAMIOT works across health, education and advocacy to support healthier, educated and empowered communities.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="ARAMIOT | Health, Education & Advocacy">
  <meta property="og:description" content="ARAMIOT works across health, education and advocacy to support healthier, educated and empowered communities.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/css/styles.css">
</head>
<body data-base="">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="home">
    <section class="hero">
      <div class="container">
        <div class="hero-inner">
          <p class="eyebrow">Health &middot; Education &middot; Advocacy</p>
          <h1>Building healthier, educated and empowered communities</h1>
          <p class="hero-lead" data-home="tagline">ARAMIOT is committed to advancing health, expanding educational opportunities and promoting advocacy through community-driven initiatives, knowledge and collective action.</p>
          <div class="hero-actions">
            <a class="button button--accent" href="pages/our-work.html">Explore our work</a>
            <a class="button button--ghost-light" href="pages/get-involved.html">Get involved</a>
          </div>
          <div class="hero-meta">
            <span><i data-lucide="heart-pulse" class="icon icon--xs" aria-hidden="true"></i> Community health</span>
            <span><i data-lucide="graduation-cap" class="icon icon--xs" aria-hidden="true"></i> Health education</span>
            <span><i data-lucide="scale" class="icon icon--xs" aria-hidden="true"></i> Human rights advocacy</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container split">
        <div class="split-media" aria-hidden="true">
          <i data-lucide="hand-heart"></i>
        </div>
        <div class="split-body">
          <p class="eyebrow">Who we are</p>
          <h2>Community-led work across three connected areas</h2>
          <div data-home="intro"></div>
          <a class="text-link" href="pages/about.html">More about ARAMIOT <i data-lucide="arrow-right" class="icon icon--xs" aria-hidden="true"></i></a>
        </div>
      </div>
    </section>

    <section class="section section--tint">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Our core areas</p>
            <h2>Health, education and advocacy</h2>
            <p>Three interconnected areas that contribute to sustainable community development.</p>
          </div>
        </div>
        <div data-home="areas"></div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Our purpose</p>
            <h2>Mission and vision</h2>
          </div>
        </div>
        <div data-home="mission"></div>
      </div>
    </section>

    <section class="section section--tint">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Our work</p>
            <h2>Featured projects</h2>
          </div>
          <a class="text-link" href="pages/our-work.html">All projects <i data-lucide="arrow-right" class="icon icon--xs" aria-hidden="true"></i></a>
        </div>
        <div data-home="projects"></div>
      </div>
    </section>

    <section class="section section--dark">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Our impact</p>
            <h2>Verified figures only</h2>
            <p>ARAMIOT publishes statistics once they have been confirmed. Figures are not estimated.</p>
          </div>
        </div>
        <div data-home="impact"></div>
        <p class="stat-note">Statistics are entered and published by the organization.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Latest updates</p>
            <h2>News and articles</h2>
          </div>
          <a class="text-link" href="pages/resources.html">All resources <i data-lucide="arrow-right" class="icon icon--xs" aria-hidden="true"></i></a>
        </div>
        <div data-home="articles"></div>
      </div>
    </section>

    <section class="section section--tint">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Knowledge</p>
            <h2>Recent publications</h2>
          </div>
          <a class="text-link" href="pages/publications.html">All publications <i data-lucide="arrow-right" class="icon icon--xs" aria-hidden="true"></i></a>
        </div>
        <div data-home="publications"></div>
      </div>
    </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="config/config.js" defer></script>
  <script src="assets/js/api.js" defer></script>
  <script src="components/layout.js" defer></script>
  <script src="components/cards.js" defer></script>
  <script src="assets/js/main.js" defer></script>
  <script src="assets/js/home.js" defer></script>
</body>
</html>
```

#### `frontend/404.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found | ARAMIOT</title>
  <meta name="description" content="The page you were looking for could not be found.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Page not found | ARAMIOT">
  <meta property="og:description" content="The page you were looking for could not be found.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/css/styles.css">
</head>
<body data-base="">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="not-found">
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow">404</p>
        <h1>Page not found</h1>
        <p class="page-lead">The page you were looking for does not exist or has been moved.</p>
        <p style="margin-top:28px">
          <a class="button button--primary" href="index.html">Return to the home page</a>
        </p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">Explore</p>
            <h2>Popular pages</h2>
          </div>
        </div>
        <ul class="value-list">
          <li><a href="pages/overview.html">Overview</a></li>
          <li><a href="pages/health.html">Health</a></li>
          <li><a href="pages/education.html">Education</a></li>
          <li><a href="pages/advocacy.html">Advocacy</a></li>
          <li><a href="pages/resources.html">Resources</a></li>
          <li><a href="pages/contact.html">Contact</a></li>
        </ul>
      </div>
    </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="config/config.js" defer></script>
  <script src="assets/js/api.js" defer></script>
  <script src="components/layout.js" defer></script>
  <script src="components/cards.js" defer></script>
  <script src="assets/js/main.js" defer></script>

</body>
</html>
```

#### `frontend/pages/overview.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Organizational Overview | ARAMIOT</title>
  <meta name="description" content="Who ARAMIOT is, what we do, how we work and the change we contribute to.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Organizational Overview | ARAMIOT">
  <meta property="og:description" content="Who ARAMIOT is, what we do, how we work and the change we contribute to.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="overview" data-page-slug="overview">
  <div data-page-hero data-fallback-title="Organizational Overview" data-fallback-lead="Who ARAMIOT is, what we do and how we work."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>

  <section class="section section--dark">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Our impact</p>
          <h2>Impact</h2>
          
        </div>
        
      </div>
      <div data-list="impact"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/about.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>About ARAMIOT | Our story, mission and team</title>
  <meta name="description" content="The ARAMIOT story, vision and mission, values and team.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="About ARAMIOT | Our story, mission and team">
  <meta property="og:description" content="The ARAMIOT story, vision and mission, values and team.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="about" data-page-slug="about">
  <div data-page-hero data-fallback-title="About ARAMIOT" data-fallback-lead="Our story, mission, vision, values and team."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">People</p>
          <h2>Our team</h2>
          <p>Profiles are published by the organization.</p>
        </div>
        
      </div>
      <div data-list="team" data-limit="9"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/health.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Health | ARAMIOT</title>
  <meta name="description" content="Public health, mental health, health awareness and disease prevention programmes from ARAMIOT.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Health | ARAMIOT">
  <meta property="og:description" content="Public health, mental health, health awareness and disease prevention programmes from ARAMIOT.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="health" data-page-slug="health">
  <div data-page-hero data-fallback-title="Health" data-fallback-lead="Public health, mental health, health awareness and disease prevention."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Read</p>
          <h2>Health articles and updates</h2>
          
        </div>
        
      </div>
      <div data-list="articles" data-category="health" data-limit="3"></div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Our work</p>
          <h2>Health projects</h2>
          
        </div>
        
      </div>
      <div data-list="projects" data-category="health" data-limit="3"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/education.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Education | ARAMIOT</title>
  <meta name="description" content="Health education, training and workshops, research and knowledge sharing.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Education | ARAMIOT">
  <meta property="og:description" content="Health education, training and workshops, research and knowledge sharing.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="education" data-page-slug="education">
  <div data-page-hero data-fallback-title="Education" data-fallback-lead="Health education, training and workshops, research and knowledge sharing."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Read</p>
          <h2>Education articles and updates</h2>
          
        </div>
        
      </div>
      <div data-list="articles" data-category="education" data-limit="3"></div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Our work</p>
          <h2>Education projects</h2>
          
        </div>
        
      </div>
      <div data-list="projects" data-category="education" data-limit="3"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/advocacy.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Advocacy | ARAMIOT</title>
  <meta name="description" content="Human rights, policy advocacy, youth advocacy and campaigns.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Advocacy | ARAMIOT">
  <meta property="og:description" content="Human rights, policy advocacy, youth advocacy and campaigns.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="advocacy" data-page-slug="advocacy">
  <div data-page-hero data-fallback-title="Advocacy" data-fallback-lead="Human rights, policy advocacy, youth advocacy and campaigns."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Read</p>
          <h2>Advocacy articles and updates</h2>
          
        </div>
        
      </div>
      <div data-list="articles" data-category="advocacy" data-limit="3"></div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Our work</p>
          <h2>Advocacy projects</h2>
          
        </div>
        
      </div>
      <div data-list="projects" data-category="advocacy" data-limit="3"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/our-work.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Our Work | ARAMIOT projects and programmes</title>
  <meta name="description" content="Projects, programmes, community initiatives and verified impact.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Our Work | ARAMIOT projects and programmes">
  <meta property="og:description" content="Projects, programmes, community initiatives and verified impact.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="our-work" data-page-slug="our-work">
  <div data-page-hero data-fallback-title="Our Work" data-fallback-lead="Projects, programmes, community initiatives and verified impact."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Projects</p>
          <h2>Projects</h2>
          <p>Search by title, location or summary.</p>
        </div>
        
      </div>
      <div data-list="projects" data-limit="6" data-search="true"></div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Programmes</p>
          <h2>Programmes</h2>
          
        </div>
        
      </div>
      <div data-list="programs" data-limit="6"></div>
    </div>
  </section>

  <section class="section section--dark">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Impact</p>
          <h2>Verified impact</h2>
          
        </div>
        
      </div>
      <div data-list="impact"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/resources.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Resources | ARAMIOT learning materials</title>
  <meta name="description" content="Publications, reports, articles and learning materials from ARAMIOT.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Resources | ARAMIOT learning materials">
  <meta property="og:description" content="Publications, reports, articles and learning materials from ARAMIOT.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="resources" data-page-slug="resources">
  <div data-page-hero data-fallback-title="Resources" data-fallback-lead="Publications, reports, articles and learning materials."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Downloadable resources</p>
          <h2>Learning materials and guidelines</h2>
          <p>Search by title or description.</p>
        </div>
        
      </div>
      <div data-list="resources" data-limit="6" data-search="true"></div>
    </div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Publications</p>
          <h2>Recent publications</h2>
          
        </div>
        <a class="text-link" href="publications.html">All publications <i data-lucide="arrow-right" class="icon icon--xs" aria-hidden="true"></i></a>
      </div>
      <div data-list="publications" data-limit="3"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/publications.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Publications | ARAMIOT reports and research</title>
  <meta name="description" content="Reports, research papers and policy briefs published by ARAMIOT.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Publications | ARAMIOT reports and research">
  <meta property="og:description" content="Reports, research papers and policy briefs published by ARAMIOT.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="publications">
  <section class="page-hero">
    <div class="container">
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
          <li><a href="../index.html">Home</a></li>
          <li aria-current="page">Publications</li>
        </ol>
      </nav>
      <p class="eyebrow">Resources</p>
      <h1>Publications</h1>
      <p class="page-lead">Reports, research papers and policy briefs published by ARAMIOT.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Library</p>
          <h2>All publications</h2>
          <p>Search by title, abstract or author.</p>
        </div>
        
      </div>
      <div data-list="publications" data-limit="6" data-search="true"></div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
</body>
</html>
```

#### `frontend/pages/get-involved.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Get Involved | Volunteer or partner with ARAMIOT</title>
  <meta name="description" content="Volunteer with ARAMIOT, partner with us or support our community initiatives.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Get Involved | Volunteer or partner with ARAMIOT">
  <meta property="og:description" content="Volunteer with ARAMIOT, partner with us or support our community initiatives.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="get-involved" data-page-slug="get-involved">
  <div data-page-hero data-fallback-title="Get Involved" data-fallback-lead="Volunteer, partner with us or support ARAMIOT initiatives."></div>
  <section class="section">
    <div class="container container--narrow" data-page-content></div>
  </section>
  <section class="section section--tint">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Volunteer</p>
          <h2>Join the volunteer network</h2>
          <p>Tell us how you would like to contribute. Applications are reviewed by the ARAMIOT team.</p>
        </div>
      </div>
      <div class="container--narrow" style="padding:0">
        
  <form class="form-card" data-form="volunteer" id="volunteer" novalidate>
    <div class="form-grid">
      <div class="field">
        <label for="volunteer-name">Full name</label>
        <input id="volunteer-name" name="fullName" type="text" required minlength="2" maxlength="140" autocomplete="name">
      </div>
      <div class="field">
        <label for="volunteer-email">Email</label>
        <input id="volunteer-email" name="email" type="email" required maxlength="200" autocomplete="email">
      </div>
      <div class="field">
        <label for="volunteer-phone">Phone <span class="hint">(optional)</span></label>
        <input id="volunteer-phone" name="phone" type="tel" maxlength="40" autocomplete="tel">
      </div>
      <div class="field">
        <label for="volunteer-area">Area of interest</label>
        <select id="volunteer-area" name="areaOfInterest" required>
          <option value="">Select an area</option>
          <option value="health">Health</option>
          <option value="education">Education</option>
          <option value="advocacy">Advocacy</option>
          <option value="research">Research</option>
          <option value="communications">Communications</option>
          <option value="fundraising">Fundraising</option>
          <option value="operations">Operations</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="field field--full">
        <label for="volunteer-experience">Relevant experience <span class="hint">(optional)</span></label>
        <textarea id="volunteer-experience" name="experience" maxlength="2000"></textarea>
      </div>
      <div class="field field--full">
        <label for="volunteer-motivation">Why would you like to volunteer?</label>
        <textarea id="volunteer-motivation" name="motivation" required minlength="10" maxlength="2000"></textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="button button--primary" type="submit">Submit application</button>
    </div>
    <div class="form-alert" data-form-alert role="status" tabindex="-1"></div>
  </form>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Partnership</p>
          <h2>Partner with ARAMIOT</h2>
          <p>Institutions, civil society organizations and community groups can propose a partnership.</p>
        </div>
      </div>
      <div class="container--narrow" style="padding:0">
        
  <form class="form-card" data-form="partnership" id="partner" novalidate>
    <div class="form-grid">
      <div class="field">
        <label for="partner-organisation">Organization name</label>
        <input id="partner-organisation" name="organizationName" type="text" required minlength="2" maxlength="200" autocomplete="organization">
      </div>
      <div class="field">
        <label for="partner-contact">Contact person</label>
        <input id="partner-contact" name="contactPerson" type="text" required minlength="2" maxlength="140" autocomplete="name">
      </div>
      <div class="field">
        <label for="partner-email">Email</label>
        <input id="partner-email" name="email" type="email" required maxlength="200" autocomplete="email">
      </div>
      <div class="field">
        <label for="partner-subject">Subject</label>
        <input id="partner-subject" name="subject" type="text" required minlength="3" maxlength="160">
      </div>
      <div class="field field--full">
        <label for="partner-message">How would you like to work with ARAMIOT?</label>
        <textarea id="partner-message" name="message" required minlength="10" maxlength="5000"></textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="button button--primary" type="submit">Send partnership inquiry</button>
    </div>
    <div class="form-alert" data-form-alert role="status" tabindex="-1"></div>
  </form>
      </div>
    </div>
  </section>

  <section class="section section--dark">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Support</p>
        <h2>Support our initiatives</h2>
        <p>A structured donations workflow is planned for a later phase. In the meantime, contact the team to discuss supporting ARAMIOT work.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="contact.html">Contact the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
  <script src="../assets/js/forms.js" defer></script>
</body>
</html>
```

#### `frontend/pages/contact.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contact ARAMIOT</title>
  <meta name="description" content="Contact information, partnership enquiries and the ARAMIOT contact form.">
  <meta name="theme-color" content="#123B50">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ARAMIOT">
  <meta property="og:title" content="Contact ARAMIOT">
  <meta property="og:description" content="Contact information, partnership enquiries and the ARAMIOT contact form.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-base="../">
  <a class="skip-link" href="#main">Skip to main content</a>
  <div id="site-header"></div>

  <main id="main" data-page="contact" data-page-slug="contact">
  <div data-page-hero data-fallback-title="Contact" data-fallback-lead="Contact information, partnership enquiries and the contact form."></div>
  <section class="section">
    <div class="container">
      <div class="row g-5">
        <div class="col-lg-5">
          <p class="eyebrow">Get in touch</p>
          <h2>Contact information</h2>
          <div class="contact-details" data-contact-details>
            <p class="hint">Loading contact details&hellip;</p>
          </div>
        </div>
        <div class="col-lg-7">
          
  <form class="form-card" data-form="contact" novalidate>
    <div class="form-grid">
      <div class="field">
        <label for="contact-name">Name</label>
        <input id="contact-name" name="name" type="text" required minlength="2" maxlength="140" autocomplete="name">
      </div>
      <div class="field">
        <label for="contact-email">Email</label>
        <input id="contact-email" name="email" type="email" required maxlength="200" autocomplete="email">
      </div>
      <div class="field field--full">
        <label for="contact-subject">Subject</label>
        <input id="contact-subject" name="subject" type="text" required minlength="3" maxlength="160">
      </div>
      <div class="field field--full">
        <label for="contact-message">Message</label>
        <textarea id="contact-message" name="message" required minlength="10" maxlength="5000"></textarea>
        <span class="hint">At least 10 characters.</span>
      </div>
    </div>
    <div class="form-actions">
      <button class="button button--primary" type="submit">Send message</button>
      <span class="hint">We aim to respond within a few working days.</span>
    </div>
    <div class="form-alert" data-form-alert role="status" tabindex="-1"></div>
  </form>
        </div>
      </div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-inner">
      <div>
        <p class="eyebrow">Get involved</p>
        <h2>Be part of the change</h2>
        <p>Sustainable community development requires collective action. Volunteer, partner with us or support an ARAMIOT initiative.</p>
      </div>
      <div class="cta-actions">
        <a class="button button--accent" href="../pages/get-involved.html">Volunteer with us</a>
        <a class="button button--ghost-light" href="../pages/contact.html">Talk to the team</a>
      </div>
    </div>
  </section>
  </main>
  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/lucide@0.446.0/dist/umd/lucide.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
  <script src="../config/config.js" defer></script>
  <script src="../assets/js/api.js" defer></script>
  <script src="../components/layout.js" defer></script>
  <script src="../components/cards.js" defer></script>
  <script src="../assets/js/main.js" defer></script>
  <script src="../assets/js/page.js" defer></script>
  <script src="../assets/js/forms.js" defer></script>
</body>
</html>
```

### Frontend — styles and configuration

#### `frontend/assets/css/styles.css`

```css
/* ============================================================
   ARAMIOT public website - Phase 1
   Custom design layer on top of Bootstrap 5 (grid + utilities).
   Palette and typography follow the ARAMIOT brand blueprint.
   ============================================================ */

:root {
  --primary: #123b50;
  --primary-deep: #0b2a3a;
  --secondary: #176b68;
  --secondary-soft: #e7f0ef;
  --accent: #d9a441;
  --accent-soft: #f8ecd6;
  --ink: #172b36;
  --muted: #687781;
  --border: #e1e8ec;
  --surface: #ffffff;
  --surface-tint: #f4f7f8;
  --radius-sm: 8px;
  --radius: 14px;
  --radius-lg: 24px;
  --shadow-sm: 0 1px 2px rgba(18, 59, 80, 0.06);
  --shadow-md: 0 28px 56px -36px rgba(18, 59, 80, 0.5);
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Newsreader', Georgia, 'Times New Roman', serif;
  --max-width: 1180px;
  --header-height: 84px;
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: calc(var(--header-height) + 16px);
}

body {
  margin: 0;
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.65;
  color: var(--ink);
  background: var(--surface);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  color: var(--primary);
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin: 0 0 0.6em;
  font-weight: 600;
}

p { margin: 0 0 1em; }

a { color: var(--secondary); text-decoration: none; }
a:hover { color: var(--primary); }

img { max-width: 100%; height: auto; display: block; }

.container {
  width: 100%;
  max-width: var(--max-width);
  padding-inline: 24px;
}

.container--narrow { max-width: 860px; }

:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* ---------- Skip link ---------- */

.skip-link {
  position: absolute;
  left: 16px;
  top: -100px;
  z-index: 1100;
  padding: 12px 20px;
  background: var(--primary);
  color: #fff;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  font-weight: 600;
  transition: top var(--transition, 180ms) ease;
}

.skip-link:focus {
  top: 0;
  color: #fff;
}

/* ---------- Header ---------- */

.site-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: var(--header-height);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--primary);
}

.brand:hover { color: var(--primary); text-decoration: none; }

.brand-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(150deg, var(--primary), var(--secondary));
  color: #fff;
  font-family: var(--font-display);
  font-size: 1.4rem;
  line-height: 1;
  padding-bottom: 4px;
}

.brand-text { display: flex; flex-direction: column; }

.brand-name {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  line-height: 1.1;
}

.brand-kicker {
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
}

.primary-nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 28px;
  flex: 1;
}

.nav-list {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--ink);
  font-family: inherit;
  font-size: 0.92rem;
  font-weight: 500;
  cursor: pointer;
}

.nav-link:hover,
.nav-link.is-active { color: var(--secondary); background: var(--secondary-soft); }

.nav-item--has-menu { position: relative; }

.nav-submenu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  margin: 0;
  padding: 8px;
  list-style: none;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 18px 40px -20px rgba(18, 59, 80, 0.4);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
  transition: opacity 160ms ease, transform 160ms ease, visibility 160ms;
  z-index: 20;
}

.nav-item--has-menu:hover .nav-submenu,
.nav-item--has-menu:focus-within .nav-submenu,
.nav-item--has-menu.is-open .nav-submenu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.nav-sublink {
  display: block;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--ink);
  font-size: 0.9rem;
}

.nav-sublink:hover { background: var(--surface-tint); color: var(--secondary); text-decoration: none; }

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: #fff;
  color: var(--primary);
  cursor: pointer;
}

.icon-button:hover { border-color: var(--secondary); color: var(--secondary); }

.nav-toggle {
  display: none;
  margin-left: auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--primary);
  cursor: pointer;
}

/* ---------- Buttons ---------- */

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 22px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
}

.button:hover { transform: translateY(-1px); text-decoration: none; }
.button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.button--accent { background: var(--accent); color: #2b1f04; }
.button--accent:hover { background: #e3b255; color: #2b1f04; }

.button--primary { background: var(--secondary); color: #fff; }
.button--primary:hover { background: #125855; color: #fff; }

.button--outline { border-color: var(--border); background: #fff; color: var(--primary); }
.button--outline:hover { border-color: var(--secondary); color: var(--secondary); }

.button--ghost-light { border-color: rgba(255, 255, 255, 0.55); color: #fff; background: transparent; }
.button--ghost-light:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }

.button--sm { padding: 9px 16px; font-size: 0.86rem; }
.button--block { width: 100%; }

.text-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--secondary);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.text-link:hover { color: var(--primary); text-decoration: none; }

.icon { width: 18px; height: 18px; }
.icon--xs { width: 14px; height: 14px; }

/* ---------- Typographic helpers ---------- */

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--secondary);
}

.eyebrow::before {
  content: '';
  width: 26px;
  height: 2px;
  background: var(--accent);
}

.section { padding: 88px 0; }
.section--tint { background: var(--surface-tint); }
.section--dark { background: linear-gradient(160deg, var(--primary-deep), var(--primary) 60%, #16485f); color: #eaf1f4; }
.section--dark h2, .section--dark h3 { color: #fff; }
.section--dark .eyebrow { color: var(--accent); }
.section--dark .eyebrow::before { background: var(--accent); }

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 36px;
}

.section-head h2 { font-size: clamp(1.7rem, 2.6vw, 2.3rem); margin-bottom: 0; }
.section-head p { max-width: 620px; color: var(--muted); margin: 8px 0 0; }
.section--dark .section-head p { color: #c8d8de; }

/* ---------- Hero ---------- */

.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(80px, 12vw, 150px) 0 clamp(80px, 10vw, 130px);
  background: radial-gradient(1200px 500px at 15% 0%, #1d5468 0%, transparent 60%),
              linear-gradient(115deg, var(--primary-deep) 12%, var(--primary) 52%, #17596b 100%);
  color: #f2f6f8;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 84px 84px;
  mask-image: radial-gradient(80% 60% at 70% 30%, #000 0%, transparent 75%);
  pointer-events: none;
}

.hero .container { position: relative; z-index: 1; }

.hero-inner { max-width: 820px; }

.hero .eyebrow { color: var(--accent); }
.hero .eyebrow::before { background: var(--accent); }

.hero h1 {
  color: #fff;
  font-size: clamp(2.4rem, 5.2vw, 4rem);
  margin-bottom: 22px;
  letter-spacing: -0.02em;
}

.hero-lead {
  max-width: 620px;
  font-size: clamp(1rem, 1.4vw, 1.15rem);
  color: #d7e4e9;
  margin-bottom: 32px;
}

.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin-top: 48px;
  padding-top: 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 0.86rem;
  letter-spacing: 0.04em;
  color: #b9cfd7;
  text-transform: uppercase;
}

.hero-meta span { display: inline-flex; align-items: center; gap: 8px; }

/* ---------- Split section ---------- */

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(32px, 5vw, 64px);
  align-items: center;
}

.split-media {
  position: relative;
  min-height: 340px;
  border-radius: var(--radius-lg);
  background: linear-gradient(150deg, var(--secondary) 0%, var(--primary) 65%, #0e3546 100%);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.85);
}

.split-media::before {
  content: '';
  position: absolute;
  inset: -30% -10% auto auto;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(217, 164, 65, 0.5), transparent 65%);
}

.split-media svg { width: 160px; height: 160px; opacity: 0.9; }

.split-body h2 { font-size: clamp(1.7rem, 2.6vw, 2.3rem); }

.split-lead {
  font-family: var(--font-display);
  font-size: 1.22rem;
  color: var(--primary);
  margin-bottom: 14px;
}

.value-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.value-list li {
  padding: 6px 13px;
  border-radius: 999px;
  background: var(--secondary-soft);
  color: var(--secondary);
  font-size: 0.82rem;
  font-weight: 600;
}

/* ---------- Tiles (cards) ---------- */

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 26px;
}

.tile {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}

.tile:hover {
  transform: translateY(-4px);
  border-color: #cbdade;
  box-shadow: var(--shadow-md);
}

.tile-media {
  position: relative;
  aspect-ratio: 16 / 9;
  display: grid;
  place-items: center;
  background: linear-gradient(140deg, #1a5568, #176b68);
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
}

.tile-media img { width: 100%; height: 100%; object-fit: cover; }

.tile-media .icon { width: 42px; height: 42px; stroke-width: 1.4; }

.tile-media--article { background: linear-gradient(140deg, #1c5a70, #123b50); }
.tile-media--project { background: linear-gradient(140deg, #176b68, #0f4f4d); }
.tile-media--publication { background: linear-gradient(140deg, #2a4a5e, #172b36); }
.tile-media--resource { background: linear-gradient(140deg, #8a6a22, #d9a441); }
.tile-media--program { background: linear-gradient(140deg, #17596b, #176b68); }
.tile-media--person { background: linear-gradient(140deg, #244a5e, #123b50); }

.tile-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  flex: 1;
}

.tile-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.chip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--secondary-soft);
  color: var(--secondary);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chip--accent { background: var(--accent-soft); color: #7d5a12; }

.tile-title { font-size: 1.28rem; margin: 0; }
.tile-title a { color: inherit; }
.tile-text { color: var(--muted); font-size: 0.94rem; margin: 0; }
.tile-foot { margin-top: auto; padding-top: 6px; }

.tile--person { text-align: left; }
.tile--person .tile-body { gap: 6px; }
.tile-role { color: var(--secondary); font-size: 0.86rem; font-weight: 600; }

/* ---------- Statistics ---------- */

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 24px;
}

.stat {
  padding: 28px 24px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.04);
}

.stat-value {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4vw, 3rem);
  line-height: 1;
  color: var(--accent);
  margin-bottom: 10px;
}

.stat-label { font-size: 0.95rem; color: #dce8ec; margin: 0; }
.stat-note { margin-top: 26px; font-size: 0.84rem; color: #a9c2cb; }

/* ---------- Page hero ---------- */

.page-hero {
  padding: 52px 0 56px;
  background:
    radial-gradient(900px 380px at 85% -10%, rgba(217, 164, 65, 0.16), transparent 60%),
    linear-gradient(120deg, var(--surface-tint), #eaf1f2 70%);
  border-bottom: 1px solid var(--border);
}

.page-hero h1 { font-size: clamp(2rem, 4vw, 3rem); margin-bottom: 14px; }
.page-lead { max-width: 680px; color: var(--muted); font-size: 1.06rem; margin: 0; }

.breadcrumb-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 22px;
  padding: 0;
  list-style: none;
  font-size: 0.82rem;
  color: var(--muted);
}

.breadcrumb-list li + li::before { content: '/'; margin-right: 8px; color: #b4c3c9; }
.breadcrumb-list a { color: var(--muted); }
.breadcrumb-list a:hover { color: var(--secondary); }
.breadcrumb-list [aria-current='page'] { color: var(--primary); font-weight: 600; }

/* ---------- Prose (editable page content) ---------- */

.prose { max-width: 760px; font-size: 1.02rem; color: #2b3f49; }
.prose h2 { margin-top: 2em; font-size: 1.6rem; }
.prose h3 { margin-top: 1.6em; font-size: 1.25rem; }
.prose p { margin-bottom: 1.1em; }
.prose ul, .prose ol { margin: 0 0 1.4em; padding-left: 1.3em; }
.prose li { margin-bottom: 0.5em; }
.prose a { text-decoration: underline; text-underline-offset: 3px; }

.prose .lead {
  font-family: var(--font-display);
  font-size: 1.32rem;
  line-height: 1.5;
  color: var(--primary);
}

.prose .content-notice {
  padding: 14px 18px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  color: #6f5317;
  font-size: 0.88rem;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* ---------- CTA band ---------- */

.cta-band { background: linear-gradient(120deg, var(--primary), #17596b); color: #eef5f7; }
.cta-band h2 { color: #fff; font-size: clamp(1.7rem, 2.8vw, 2.4rem); }
.cta-band p { color: #cfe0e5; max-width: 620px; margin-bottom: 0; }
.cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 36px; flex-wrap: wrap; }
.cta-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.cta-band .eyebrow { color: var(--accent); }

/* ---------- Lists, pagination, states ---------- */

.list-body { min-height: 120px; }

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 32px;
  flex-wrap: wrap;
}

.list-count { color: var(--muted); font-size: 0.88rem; margin: 0; }

.pager { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.pager-status { font-size: 0.85rem; color: var(--muted); }

.list-search {
  display: flex;
  gap: 10px;
  margin-bottom: 28px;
  max-width: 520px;
}

.list-search input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 0.95rem;
}

.state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 48px 24px;
  border: 1px dashed #cfdade;
  border-radius: var(--radius);
  background: #fbfdfd;
  text-align: center;
  color: var(--muted);
}

.state .icon { width: 30px; height: 30px; color: var(--secondary); }
.state h3 { font-size: 1.15rem; margin: 0; }
.state p { margin: 0; max-width: 460px; font-size: 0.92rem; }
.state--error { border-color: #e7c9c2; background: #fdf7f5; }
.state--error .icon { color: #b4553c; }

/* ---------- Skeletons ---------- */

.tile--skeleton { pointer-events: none; }
.tile--skeleton:hover { transform: none; box-shadow: none; }

.skeleton {
  position: relative;
  overflow: hidden;
  background: #e9eff1;
  border-radius: 6px;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
  animation: shimmer 1.4s infinite;
}

.skeleton-media { aspect-ratio: 16 / 9; border-radius: 0; }
.skeleton-line { height: 12px; margin-bottom: 8px; }
.skeleton-line--short { width: 55%; }

@keyframes shimmer { 100% { transform: translateX(100%); } }

/* ---------- Forms ---------- */

.form-card {
  padding: clamp(24px, 3vw, 40px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.form-grid .field--full { grid-column: 1 / -1; }

.field { display: flex; flex-direction: column; gap: 7px; }
.field label { font-size: 0.86rem; font-weight: 600; color: var(--primary); }
.field .hint { font-size: 0.78rem; color: var(--muted); }

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #fff;
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--ink);
}

.field textarea { resize: vertical; min-height: 140px; }

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: var(--secondary);
  outline: 2px solid var(--secondary-soft);
  outline-offset: 1px;
}

.form-actions { display: flex; align-items: center; gap: 16px; margin-top: 22px; flex-wrap: wrap; }

.form-alert {
  display: none;
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
}

.form-alert.is-visible { display: block; }
.form-alert--success { background: #e8f4ee; color: #1d6046; border: 1px solid #c2e2d0; }
.form-alert--error { background: #fdf1ee; color: #8f3c26; border: 1px solid #f0cfc5; }
.form-alert ul { margin: 8px 0 0; padding-left: 20px; }

.contact-details { display: grid; gap: 18px; }
.contact-item { display: flex; gap: 14px; align-items: flex-start; }
.contact-item .icon { flex: none; margin-top: 3px; color: var(--secondary); }
.contact-item dt { font-size: 0.76rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.contact-item dd { margin: 2px 0 0; font-size: 1rem; color: var(--ink); }

/* ---------- Footer ---------- */

.site-footer {
  padding: 64px 0 24px;
  background: var(--primary-deep);
  color: #c8d8de;
}

.footer-grid {
  display: grid;
  grid-template-columns: 1.8fr 1fr 1fr 1.2fr;
  gap: 36px;
  padding-bottom: 42px;
}

.site-footer h3 {
  margin: 0 0 16px;
  color: #fff;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.site-footer p { font-size: 0.9rem; color: #b3c7cf; }

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  color: #fff;
  font-family: var(--font-display);
  font-size: 1.3rem;
  letter-spacing: 0.14em;
}

.site-footer ul { margin: 0; padding: 0; list-style: none; }
.site-footer li { margin-bottom: 9px; }
.site-footer a { color: #c8d8de; font-size: 0.9rem; }
.site-footer a:hover { color: #fff; text-decoration: none; }

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 0.8rem;
  color: #93a9b3;
  flex-wrap: wrap;
}

/* ---------- Dialogs ---------- */

dialog {
  width: min(760px, 92vw);
  max-height: 86vh;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: #fff;
  color: var(--ink);
  box-shadow: 0 40px 90px -40px rgba(11, 42, 58, 0.6);
}

dialog::backdrop { background: rgba(11, 42, 58, 0.55); backdrop-filter: blur(2px); }

.dialog-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.dialog-head input {
  flex: 1;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 1rem;
}

.dialog-body { padding: 22px; overflow-y: auto; max-height: 64vh; }

.dialog-close {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 50%;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--primary);
  flex: none;
}

.search-results { display: grid; gap: 6px; }

.search-result {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  color: var(--ink);
}

.search-result:hover { background: var(--surface-tint); border-color: var(--border); }
.search-result strong { display: block; font-size: 0.98rem; color: var(--primary); font-weight: 600; }
.search-result span { font-size: 0.82rem; color: var(--muted); }
.search-hint { color: var(--muted); font-size: 0.9rem; margin: 0; }

.detail-title { font-size: clamp(1.5rem, 3vw, 2rem); margin-bottom: 10px; }
.detail-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }

/* ---------- Responsive ---------- */

@media (max-width: 980px) {
  .nav-toggle { display: inline-flex; }

  .primary-nav {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 18px 24px 26px;
    background: #fff;
    border-bottom: 1px solid var(--border);
    box-shadow: 0 24px 40px -30px rgba(11, 42, 58, 0.55);
  }

  .primary-nav.is-open { display: flex; }

  .nav-list { flex-direction: column; align-items: stretch; gap: 2px; }
  .nav-link { width: 100%; justify-content: space-between; padding: 12px 10px; }

  .nav-submenu {
    position: static;
    display: none;
    opacity: 1;
    visibility: visible;
    transform: none;
    box-shadow: none;
    border: 0;
    border-left: 2px solid var(--border);
    border-radius: 0;
    margin-left: 10px;
    padding: 2px 0 6px 8px;
  }

  .nav-item--has-menu.is-open .nav-submenu { display: block; }

  .nav-actions { justify-content: space-between; padding-top: 8px; }

  .split { grid-template-columns: 1fr; }
  .split-media { min-height: 240px; order: -1; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .cta-inner { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 640px) {
  .section { padding: 60px 0; }
  .header-inner { min-height: 74px; }
  .brand-kicker { display: none; }
  .brand-name { font-size: 1.25rem; }
  .form-grid { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
  .tile-grid { grid-template-columns: 1fr; }
  .hero-meta { gap: 16px; font-size: 0.74rem; }
  .list-footer { flex-direction: column; align-items: flex-start; }
  .pager { margin-left: 0; }
  .dialog-body { max-height: 70vh; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

@media print {
  .site-header, .site-footer, .nav-actions, .cta-band { display: none; }
  body { color: #000; }
}
```

#### `frontend/config/config.js`

```js
/* global window */
/**
 * Frontend configuration.
 *
 * By default the API is assumed to live on the same origin under /api, which is
 * how `npm start` serves the site. If the frontend is hosted separately (for
 * example a static server on port 3000 while the API runs on 5000), set
 * API_BASE_URL to the absolute API URL and add that origin to CORS_ORIGINS in
 * the backend .env file.
 */

window.ARAMIOT_CONFIG = {
  API_BASE_URL:
    window.location.protocol === 'file:'
      ? 'http://localhost:5000/api'
      : window.location.origin + '/api',
  SITE_NAME: 'ARAMIOT',
  REQUEST_TIMEOUT_MS: 15000,
};
```

### Frontend — components

#### `frontend/components/layout.js`

```js
/* global window, document, Intl */
/**
 * Layout components: header, footer, dialogs, page banners and the shared
 * loading / empty / error states used by every page.
 *
 * Components render into markup rather than living inside each HTML file, so the
 * navigation and footer exist in exactly one place.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var NAV_ITEMS = [
    {
      label: 'About',
      href: 'pages/about.html',
      children: [
        { label: 'Overview', href: 'pages/overview.html' },
        { label: 'About us', href: 'pages/about.html' },
        { label: 'Our team', href: 'pages/about.html#team' },
        { label: 'Contact', href: 'pages/contact.html' },
      ],
    },
    {
      label: 'Programmes',
      href: 'pages/health.html',
      children: [
        { label: 'Health', href: 'pages/health.html' },
        { label: 'Education', href: 'pages/education.html' },
        { label: 'Advocacy', href: 'pages/advocacy.html' },
      ],
    },
    { label: 'Our work', href: 'pages/our-work.html' },
    {
      label: 'Resources',
      href: 'pages/resources.html',
      children: [
        { label: 'All resources', href: 'pages/resources.html' },
        { label: 'Publications', href: 'pages/publications.html' },
      ],
    },
  ];

  var FOOTER_LINKS = {
    explore: [
      { label: 'Overview', href: 'pages/overview.html' },
      { label: 'About us', href: 'pages/about.html' },
      { label: 'Our work', href: 'pages/our-work.html' },
      { label: 'Get involved', href: 'pages/get-involved.html' },
      { label: 'Contact', href: 'pages/contact.html' },
    ],
    programmes: [
      { label: 'Health', href: 'pages/health.html' },
      { label: 'Education', href: 'pages/education.html' },
      { label: 'Advocacy', href: 'pages/advocacy.html' },
      { label: 'Publications', href: 'pages/publications.html' },
      { label: 'Resources', href: 'pages/resources.html' },
    ],
  };

  /* ---------------- helpers ---------------- */

  function base() {
    var value = document.body && document.body.getAttribute('data-base');
    return value || '';
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  function truncate(text, max) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= max) return value;
    return value.slice(0, max - 1).replace(/[\s,.;:]$/, '') + '\u2026';
  }

  function icon(name, className) {
    return '<i data-lucide="' + name + '" class="' + (className || 'icon') + '" aria-hidden="true"></i>';
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function currentFile() {
    var parts = window.location.pathname.split('/');
    var file = parts[parts.length - 1];
    return file || 'index.html';
  }

  function fileOf(href) {
    return href.split('#')[0].split('/').pop();
  }

  function isActive(item) {
    var current = currentFile();
    if (fileOf(item.href) === current) return true;
    return (item.children || []).some(function (child) {
      return fileOf(child.href) === current;
    });
  }

  /* ---------------- header ---------------- */

  function navItemMarkup(item) {
    var prefix = base();
    var href = prefix + item.href;
    var active = isActive(item);
    var activeClass = active ? ' is-active' : '';
    var activeAttr = active ? ' aria-current="page"' : '';

    if (!item.children || item.children.length === 0) {
      return (
        '<li><a class="nav-link' + activeClass + '" href="' + href + '"' + activeAttr + '>' +
        escapeHtml(item.label) +
        '</a></li>'
      );
    }

    var submenuId = 'submenu-' + item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var children = item.children
      .map(function (child) {
        return (
          '<li><a class="nav-sublink" href="' + prefix + child.href + '">' +
          escapeHtml(child.label) +
          '</a></li>'
        );
      })
      .join('');

    return (
      '<li class="nav-item--has-menu">' +
      '<button class="nav-link nav-link--button' + activeClass + '" type="button" ' +
      'aria-expanded="false" aria-controls="' + submenuId + '" data-submenu-toggle>' +
      escapeHtml(item.label) + icon('chevron-down', 'icon icon--xs') +
      '</button>' +
      '<ul class="nav-submenu" id="' + submenuId + '">' + children + '</ul>' +
      '</li>'
    );
  }

  function renderHeader(organization) {
    var target = document.getElementById('site-header');
    if (!target) return;

    var prefix = base();
    var name = (organization && organization.name) || 'ARAMIOT';
    var navMarkup = NAV_ITEMS.map(navItemMarkup).join('');

    target.innerHTML =
      '<header class="site-header">' +
        '<div class="container header-inner">' +
          '<a class="brand" href="' + prefix + 'index.html" aria-label="' + escapeHtml(name) + ' home">' +
            '<span class="brand-mark" aria-hidden="true">A</span>' +
            '<span class="brand-text">' +
              '<span class="brand-name">' + escapeHtml(name) + '</span>' +
              '<span class="brand-kicker">Health &middot; Education &middot; Advocacy</span>' +
            '</span>' +
          '</a>' +
          '<button class="nav-toggle" type="button" aria-expanded="false" ' +
            'aria-controls="primary-navigation" data-nav-toggle>' +
            icon('menu') + '<span class="visually-hidden">Menu</span>' +
          '</button>' +
          '<nav class="primary-nav" id="primary-navigation" aria-label="Primary">' +
            '<ul class="nav-list">' + navMarkup + '</ul>' +
            '<div class="nav-actions">' +
              '<button class="icon-button" type="button" data-open-search aria-label="Search the website">' +
                icon('search') +
              '</button>' +
              '<a class="button button--accent button--sm" href="' + prefix + 'pages/get-involved.html">Get involved</a>' +
            '</div>' +
          '</nav>' +
        '</div>' +
      '</header>';
  }

  /* ---------------- footer ---------------- */

  function footerList(title, links) {
    var prefix = base();
    return (
      '<div><h3>' + escapeHtml(title) + '</h3><ul>' +
      links
        .map(function (link) {
          return '<li><a href="' + prefix + link.href + '">' + escapeHtml(link.label) + '</a></li>';
        })
        .join('') +
      '</ul></div>'
    );
  }

  function renderFooter(organization) {
    var target = document.getElementById('site-footer');
    if (!target) return;

    var prefix = base();
    var year = new Date().getFullYear();
    var name = (organization && organization.name) || 'ARAMIOT';
    var description =
      (organization && organization.tagline) ||
      'A community-based organization working across health, education and advocacy.';
    var email = organization && organization.contactEmail;
    var phone = organization && organization.contactPhone;
    var address = organization && organization.address;

    var addressLines = address
      ? [address.street, address.city, address.region, address.country].filter(Boolean)
      : [];

    var social = organization && organization.socialLinks ? organization.socialLinks : {};
    var socialMarkup = Object.keys(social)
      .filter(function (key) { return Boolean(social[key]); })
      .map(function (key) {
        return (
          '<li><a href="' + escapeHtml(social[key]) + '" rel="noopener noreferrer" target="_blank">' +
          escapeHtml(key.charAt(0).toUpperCase() + key.slice(1)) + '</a></li>'
        );
      })
      .join('');

    target.innerHTML =
      '<footer class="site-footer">' +
        '<div class="container">' +
          '<div class="footer-grid">' +
            '<div>' +
              '<span class="footer-brand"><span class="brand-mark" aria-hidden="true">A</span>' +
              escapeHtml(name) + '</span>' +
              '<p>' + escapeHtml(description) + '</p>' +
              (socialMarkup ? '<h3>Follow</h3><ul>' + socialMarkup + '</ul>' : '') +
            '</div>' +
            footerList('Explore', FOOTER_LINKS.explore) +
            footerList('Programmes', FOOTER_LINKS.programmes) +
            '<div>' +
              '<h3>Contact</h3>' +
              '<ul>' +
                (email
                  ? '<li><a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></li>'
                  : '') +
                (phone ? '<li>' + escapeHtml(phone) + '</li>' : '') +
                (addressLines.length
                  ? '<li>' + addressLines.map(escapeHtml).join(', ') + '</li>'
                  : '') +
                '<li><a href="' + prefix + 'pages/contact.html">Contact form</a></li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
          '<div class="footer-bottom">' +
            '<span>&copy; ' + year + ' ' + escapeHtml(name) + '. All rights reserved.</span>' +
            '<span>Content managed through the ARAMIOT content system.</span>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  /* ---------------- dialogs ---------------- */

  function renderDialogs() {
    var wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<dialog class="search-dialog" id="search-dialog" aria-labelledby="search-dialog-title">' +
        '<div class="dialog-head">' +
          '<h2 id="search-dialog-title" class="visually-hidden">Search the website</h2>' +
          icon('search') +
          '<input id="search-input" type="search" placeholder="Search articles, publications and resources" ' +
            'autocomplete="off" aria-label="Search articles, publications and resources">' +
          '<button class="dialog-close" type="button" data-close-dialog aria-label="Close search">' +
            icon('x') +
          '</button>' +
        '</div>' +
        '<div class="dialog-body" id="search-results">' +
          '<p class="search-hint">Type at least two characters to search.</p>' +
        '</div>' +
      '</dialog>' +
      '<dialog class="detail-dialog" id="detail-dialog" aria-labelledby="detail-dialog-title">' +
        '<div class="dialog-head">' +
          '<h2 id="detail-dialog-title" class="visually-hidden">Content preview</h2>' +
          '<button class="dialog-close" type="button" data-close-dialog aria-label="Close preview" style="margin-left:auto">' +
            icon('x') +
          '</button>' +
        '</div>' +
        '<div class="dialog-body" id="detail-body"></div>' +
      '</dialog>';

    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
  }

  /* ---------------- page banner ---------------- */

  function renderPageHero(target, options) {
    if (!target) return;
    var prefix = base();
    var title = options.title || '';
    var lead = options.lead || '';
    var section = options.section || '';
    var crumbs = options.breadcrumb || [];

    var crumbMarkup = crumbs
      .map(function (crumb, index) {
        if (index === crumbs.length - 1) {
          return '<li aria-current="page">' + escapeHtml(crumb.label) + '</li>';
        }
        return '<li><a href="' + prefix + crumb.href + '">' + escapeHtml(crumb.label) + '</a></li>';
      })
      .join('');

    target.innerHTML =
      '<section class="page-hero">' +
        '<div class="container">' +
          (crumbMarkup ? '<nav aria-label="Breadcrumb"><ol class="breadcrumb-list">' + crumbMarkup + '</ol></nav>' : '') +
          (section ? '<p class="eyebrow">' + escapeHtml(section) + '</p>' : '') +
          '<h1>' + escapeHtml(title) + '</h1>' +
          (lead ? '<p class="page-lead">' + escapeHtml(lead) + '</p>' : '') +
        '</div>' +
      '</section>';
  }

  /* ---------------- shared states ---------------- */

  function tilesSkeleton(count) {
    var items = '';
    for (var i = 0; i < (count || 3); i += 1) {
      items +=
        '<div class="tile tile--skeleton" aria-hidden="true">' +
          '<div class="skeleton skeleton-media"></div>' +
          '<div class="tile-body">' +
            '<div class="skeleton skeleton-line skeleton-line--short"></div>' +
            '<div class="skeleton skeleton-line"></div>' +
            '<div class="skeleton skeleton-line skeleton-line--short"></div>' +
          '</div>' +
        '</div>';
    }
    return '<div class="tile-grid">' + items + '</div>' +
      '<p class="visually-hidden" role="status">Loading content&hellip;</p>';
  }

  function emptyState(options) {
    var settings = options || {};
    return (
      '<div class="state">' +
        icon(settings.icon || 'inbox') +
        '<h3>' + escapeHtml(settings.title || 'Nothing here yet') + '</h3>' +
        '<p>' + escapeHtml(settings.message || 'Published content will appear here.') + '</p>' +
      '</div>'
    );
  }

  function errorState(options) {
    var settings = options || {};
    return (
      '<div class="state state--error" role="alert">' +
        icon('alert-triangle') +
        '<h3>We could not load this content</h3>' +
        '<p>' + escapeHtml(settings.message || 'Please try again in a moment.') + '</p>' +
        (settings.retry === false
          ? ''
          : '<button class="button button--outline button--sm" type="button" data-retry>Try again</button>') +
      '</div>'
    );
  }

  ARAMIOT.layout = {
    base: base,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    truncate: truncate,
    icon: icon,
    refreshIcons: refreshIcons,
    renderHeader: renderHeader,
    renderFooter: renderFooter,
    renderDialogs: renderDialogs,
    renderPageHero: renderPageHero,
    tilesSkeleton: tilesSkeleton,
    emptyState: emptyState,
    errorState: errorState,
    NAV_ITEMS: NAV_ITEMS,
  };
})(window.ARAMIOT);
```

#### `frontend/components/cards.js`

```js
/* global window, document */
/**
 * Content preview cards.
 * Each function receives one API document and returns accessible card markup.
 * Cards open the full record in the shared preview dialog (no separate detail
 * pages in Phase 1), so no link ever points at a page that does not exist.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var layout = ARAMIOT.layout;
  var escapeHtml = layout.escapeHtml;
  var formatDate = layout.formatDate;
  var truncate = layout.truncate;
  var icon = layout.icon;

  function media(item, iconName, variant, fallbackAlt) {
    var image = item.featuredImage || item.coverImage || item.profileImage;
    if (image && image.url) {
      return (
        '<div class="tile-media tile-media--' + variant + '">' +
          '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(image.alt || fallbackAlt || '') + '" loading="lazy">' +
        '</div>'
      );
    }
    return '<div class="tile-media tile-media--' + variant + '" aria-hidden="true">' + icon(iconName) + '</div>';
  }

  function chip(label, variant) {
    if (!label) return '';
    return '<span class="chip' + (variant ? ' chip--' + variant : '') + '">' + escapeHtml(label) + '</span>';
  }

  function detailButton(type, slug, label) {
    return (
      '<button class="text-link" type="button" data-detail="' + type + ':' + escapeHtml(slug) + '">' +
      escapeHtml(label || 'Read more') + icon('arrow-right', 'icon icon--xs') +
      '</button>'
    );
  }

  function article(item) {
    return (
      '<article class="tile">' +
        media(item, 'newspaper', 'article', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.category ? item.category.name : 'News') +
            (item.publishedAt ? '<time datetime="' + escapeHtml(item.publishedAt) + '">' + formatDate(item.publishedAt) + '</time>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.excerpt, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('articles', item.slug, 'Read article') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function project(item) {
    var period = [formatDate(item.startDate), item.endDate ? formatDate(item.endDate) : 'Ongoing']
      .filter(Boolean)
      .join(' \u2013 ');

    return (
      '<article class="tile">' +
        media(item, 'folder-open', 'project', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.category ? item.category.name : 'Project') +
            (period ? '<span>' + escapeHtml(period) + '</span>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.summary || item.description, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('projects', item.slug, 'View project') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function program(item) {
    return (
      '<article class="tile">' +
        media(item, 'hand-heart', 'program', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.category ? item.category.name : 'Programme') +
            (item.location ? '<span>' + escapeHtml(item.location) + '</span>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.description, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('programs', item.slug, 'View programme') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function publication(item) {
    return (
      '<article class="tile">' +
        media(item, 'file-text', 'publication', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.publicationType ? item.publicationType.replace(/-/g, ' ') : 'Publication', 'accent') +
            (item.publicationDate ? '<time datetime="' + escapeHtml(item.publicationDate) + '">' + formatDate(item.publicationDate) + '</time>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.abstract, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('publications', item.slug, 'View publication') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function resource(item) {
    return (
      '<article class="tile">' +
        media(item, 'book-open', 'resource', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.resourceType ? item.resourceType.replace(/-/g, ' ') : 'Resource', 'accent') +
            (item.category ? '<span>' + escapeHtml(item.category.name) + '</span>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.description, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('resources', item.slug, 'View resource') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function teamMember(item) {
    return (
      '<article class="tile tile--person">' +
        media(item, 'user-round', 'person', item.name) +
        '<div class="tile-body">' +
          '<h3 class="tile-title">' + escapeHtml(item.name) + '</h3>' +
          '<p class="tile-role">' + escapeHtml(item.position) + '</p>' +
          (item.department ? '<p class="tile-text">' + escapeHtml(item.department) + '</p>' : '') +
          (item.biography ? '<p class="tile-text">' + escapeHtml(truncate(item.biography, 140)) + '</p>' : '') +
        '</div>' +
      '</article>'
    );
  }

  function statistic(item) {
    var value = Number(item.value || 0);
    var formatted = value >= 1000 ? new Intl.NumberFormat('en-GB').format(value) : String(value);

    return (
      '<div class="stat">' +
        '<span class="stat-value">' + escapeHtml(formatted) + (item.unit ? escapeHtml(item.unit) : '') + '</span>' +
        '<p class="stat-label">' + escapeHtml(item.title) + '</p>' +
      '</div>'
    );
  }

  function pageSummary(page, href) {
    return (
      '<article class="tile">' +
        '<div class="tile-body">' +
          '<h3 class="tile-title"><a href="' + escapeHtml(href) + '">' + escapeHtml(page.title) + '</a></h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(page.excerpt, 140)) + '</p>' +
          '<div class="tile-foot">' +
            '<a class="text-link" href="' + escapeHtml(href) + '">Learn more' + icon('arrow-right', 'icon icon--xs') + '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  ARAMIOT.cards = {
    article: article,
    project: project,
    program: program,
    publication: publication,
    resource: resource,
    teamMember: teamMember,
    statistic: statistic,
    pageSummary: pageSummary,
    chip: chip,
    media: media,
  };
})(window.ARAMIOT);
```

### Frontend — page scripts

#### `frontend/assets/js/api.js`

```js
/* global window, fetch */
/**
 * REST API client.
 * Every page talks to the backend only through this module: no HTML file
 * contains database credentials or hardcoded content.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var config = window.ARAMIOT_CONFIG || {};
  var BASE_URL = String(config.API_BASE_URL || '/api').replace(/\/+$/, '');
  var TIMEOUT = Number(config.REQUEST_TIMEOUT_MS || 15000);

  /** Serialise a query object, skipping empty values. */
  function buildQuery(params) {
    if (!params) return '';
    var search = new URLSearchParams();
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      search.append(key, value);
    });
    var text = search.toString();
    return text ? '?' + text : '';
  }

  function toApiError(response, payload) {
    var error = new Error(
      (payload && payload.error && payload.error.message) ||
        'The request failed with status ' + response.status + '.'
    );
    error.status = response.status;
    error.code = (payload && payload.error && payload.error.code) || 'HTTP_ERROR';
    error.details = (payload && payload.error && payload.error.details) || null;
    return error;
  }

  /** Low-level request with timeout, JSON parsing and consistent errors. */
  function request(path, options) {
    var settings = options || {};
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeoutId = controller ? window.setTimeout(function () { controller.abort(); }, TIMEOUT) : null;

    var headers = Object.assign({ Accept: 'application/json' }, settings.headers || {});
    if (settings.body) headers['Content-Type'] = 'application/json';

    var init = {
      method: settings.method || 'GET',
      headers: headers,
      signal: controller ? controller.signal : undefined,
    };
    if (settings.body) init.body = settings.body;

    return fetch(BASE_URL + path, init)
      .then(function (response) {
        return response
          .json()
          .catch(function () { return null; })
          .then(function (payload) {
            if (!response.ok || !payload || payload.success === false) {
              throw toApiError(response, payload);
            }
            return payload;
          });
      })
      .catch(function (error) {
        if (!error.status) {
          error.code = error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
          error.message =
            error.code === 'TIMEOUT'
              ? 'The ARAMIOT API took too long to respond. Please try again.'
              : 'Could not reach the ARAMIOT API. Check your connection and try again.';
        }
        throw error;
      })
      .finally(function () {
        if (timeoutId) window.clearTimeout(timeoutId);
      });
  }

  function list(path, params) {
    return request(path + buildQuery(params));
  }

  function post(path, payload) {
    return request(path, { method: 'POST', body: JSON.stringify(payload) });
  }

  ARAMIOT.api = {
    baseUrl: BASE_URL,

    /* Reads */
    getOrganization: function () { return request('/organization'); },
    getPages: function (params) { return list('/pages', params); },
    getPage: function (slug) { return request('/pages/' + encodeURIComponent(slug)); },
    getArticles: function (params) { return list('/articles', params); },
    getArticle: function (slug) { return request('/articles/' + encodeURIComponent(slug)); },
    getCategories: function (params) { return list('/categories', params); },
    getProjects: function (params) { return list('/projects', params); },
    getProject: function (slug) { return request('/projects/' + encodeURIComponent(slug)); },
    getPrograms: function (params) { return list('/programs', params); },
    getProgram: function (slug) { return request('/programs/' + encodeURIComponent(slug)); },
    getTeam: function (params) { return list('/team', params); },
    getPublications: function (params) { return list('/publications', params); },
    getPublication: function (slug) { return request('/publications/' + encodeURIComponent(slug)); },
    getResources: function (params) { return list('/resources', params); },
    getResource: function (slug) { return request('/resources/' + encodeURIComponent(slug)); },
    getImpact: function (params) { return list('/impact', params); },

    /* Writes */
    submitContact: function (payload) { return post('/contact', payload); },
    submitVolunteer: function (payload) { return post('/volunteers', payload); },
    submitPartnership: function (payload) { return post('/partnerships', payload); },
  };
})(window.ARAMIOT);
```

#### `frontend/assets/js/main.js`

```js
/* global window, document, gsap, ScrollTrigger */
/**
 * Global behaviour, loaded on every page:
 *  - renders the shared header and footer
 *  - mobile navigation and accessible dropdown menus
 *  - site-wide search dialog (articles, publications, resources)
 *  - content preview dialog
 *  - restrained GSAP transitions (hero + static section headings)
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var esc = layout.escapeHtml;

  /* ---------------- navigation ---------------- */

  function closeAllSubmenus() {
    document.querySelectorAll('.nav-item--has-menu.is-open').forEach(function (item) {
      item.classList.remove('is-open');
      var toggle = item.querySelector('[data-submenu-toggle]');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function initNavigation() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('primary-navigation');
    var header = document.querySelector('.site-header');

    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var isOpen = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    document.querySelectorAll('[data-submenu-toggle]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var item = button.closest('.nav-item--has-menu');
        if (!item) return;
        var willOpen = !item.classList.contains('is-open');
        closeAllSubmenus();
        if (willOpen) {
          item.classList.add('is-open');
          button.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!header || header.contains(event.target)) return;
      closeAllSubmenus();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      closeAllSubmenus();
      if (nav && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
        }
      }
    });
  }

  /* ---------------- dialogs ---------------- */

  function closeDialog(dialog) {
    if (dialog && typeof dialog.close === 'function' && dialog.open) dialog.close();
  }

  function initDialogBasics() {
    document.querySelectorAll('dialog').forEach(function (dialog) {
      var closeButton = dialog.querySelector('[data-close-dialog]');
      if (closeButton) {
        closeButton.addEventListener('click', function () { closeDialog(dialog); });
      }
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
  }

  /* ---------------- search ---------------- */

  function initSearch() {
    var dialog = document.getElementById('search-dialog');
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    if (!dialog || !input || !results) return;

    var timer = null;

    function open() {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', 'open');
      input.focus();
      input.select();
    }

    document.querySelectorAll('[data-open-search]').forEach(function (button) {
      button.addEventListener('click', open);
    });

    document.addEventListener('keydown', function (event) {
      var isShortcut = (event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K');
      if (isShortcut) {
        event.preventDefault();
        open();
      }
    });

    function runSearch(term) {
      results.innerHTML = layout.tilesSkeleton(2);

      Promise.all([
        api.getArticles({ search: term, limit: 4 }).catch(function () { return { data: [] }; }),
        api.getPublications({ search: term, limit: 3 }).catch(function () { return { data: [] }; }),
        api.getResources({ search: term, limit: 3 }).catch(function () { return { data: [] }; }),
      ])
        .then(function (responses) {
          var groups = [
            { label: 'Article', type: 'articles', items: responses[0].data },
            { label: 'Publication', type: 'publications', items: responses[1].data },
            { label: 'Resource', type: 'resources', items: responses[2].data },
          ];

          var markup = '';
          var total = 0;

          groups.forEach(function (group) {
            group.items.forEach(function (item) {
              total += 1;
              markup +=
                '<button class="search-result" type="button" data-detail="' + group.type + ':' + esc(item.slug) + '" data-close-search>' +
                  layout.icon('file-text') +
                  '<span><strong>' + esc(item.title) + '</strong>' +
                  '<span>' + esc(group.label) + (item.category ? ' &middot; ' + esc(item.category.name) : '') + '</span></span>' +
                '</button>';
            });
          });

          results.innerHTML = total
            ? markup
            : layout.emptyState({
                icon: 'search-x',
                title: 'No matches found',
                message: 'Try a different word, or browse the resources and publications pages.',
              });
          layout.refreshIcons();
        })
        .catch(function (error) {
          results.innerHTML = layout.errorState({ message: error.message, retry: false });
          layout.refreshIcons();
        });
    }

    input.addEventListener('input', function () {
      var term = input.value.trim();
      window.clearTimeout(timer);
      if (term.length < 2) {
        results.innerHTML = '<p class="search-hint">Type at least two characters to search.</p>';
        return;
      }
      timer = window.setTimeout(function () { runSearch(term); }, 280);
    });
  }

  /* ---------------- content preview ---------------- */

  var DETAIL_SOURCES = {
    articles: { load: api.getArticle, kind: 'Article' },
    projects: { load: api.getProject, kind: 'Project' },
    programs: { load: api.getProgram, kind: 'Programme' },
    publications: { load: api.getPublication, kind: 'Publication' },
    resources: { load: api.getResource, kind: 'Resource' },
  };

  function detailList(heading, items) {
    if (!items || items.length === 0) return '';
    return (
      '<h3>' + esc(heading) + '</h3><ul>' +
      items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') +
      '</ul>'
    );
  }

  function fileButton(url, label) {
    if (!url) return '';
    return (
      '<p><a class="button button--outline button--sm" href="' + esc(url) + '" target="_blank" ' +
      'rel="noopener noreferrer">' + esc(label) + layout.icon('external-link', 'icon icon--xs') + '</a></p>'
    );
  }

  function renderDetail(type, doc) {
    var meta = [];
    if (doc.category && doc.category.name) meta.push(doc.category.name);
    if (doc.publicationType) meta.push(doc.publicationType.replace(/-/g, ' '));
    if (doc.resourceType) meta.push(doc.resourceType.replace(/-/g, ' '));
    var date = doc.publishedAt || doc.publicationDate || doc.startDate;
    if (date) meta.push(layout.formatDate(date));
    if (doc.location) meta.push(doc.location);
    if (doc.author) meta.push(doc.author);

    var body = '';

    if (type === 'articles') {
      body = '<div class="prose">' + (doc.content || '<p>' + esc(doc.excerpt || '') + '</p>') + '</div>';
    } else if (type === 'projects') {
      body =
        (doc.summary ? '<p>' + esc(doc.summary) + '</p>' : '') +
        (doc.description ? '<p>' + esc(doc.description) + '</p>' : '') +
        detailList('Objectives', doc.objectives) +
        detailList('Activities', doc.activities);
    } else if (type === 'programs') {
      body =
        (doc.description ? '<p>' + esc(doc.description) + '</p>' : '') +
        detailList('Objectives', doc.objectives) +
        detailList('Activities', doc.activities) +
        (doc.targetAudience ? '<p><strong>Who it is for:</strong> ' + esc(doc.targetAudience) + '</p>' : '');
    } else if (type === 'publications') {
      body =
        (doc.abstract ? '<p>' + esc(doc.abstract) + '</p>' : '') +
        (doc.authors && doc.authors.length
          ? '<p><strong>Authors:</strong> ' + esc(doc.authors.join(', ')) + '</p>'
          : '') +
        fileButton(doc.fileUrl, 'Open document');
    } else {
      body =
        (doc.description ? '<p>' + esc(doc.description) + '</p>' : '') +
        fileButton(doc.fileUrl, 'Open file') +
        fileButton(doc.externalUrl, 'Open external link');
    }

    return (
      '<h2 class="detail-title" id="detail-dialog-title">' + esc(doc.title) + '</h2>' +
      (meta.length
        ? '<p class="detail-meta">' + meta.map(esc).join(' <span aria-hidden="true">&middot;</span> ') + '</p>'
        : '') +
      body
    );
  }

  function openDetail(type, slug) {
    var dialog = document.getElementById('detail-dialog');
    var body = document.getElementById('detail-body');
    var source = DETAIL_SOURCES[type];
    if (!dialog || !body || !source) return;

    body.innerHTML = layout.tilesSkeleton(1);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    body.scrollTop = 0;

    source
      .load(slug)
      .then(function (response) {
        body.innerHTML = renderDetail(type, response.data);
        layout.refreshIcons();
      })
      .catch(function (error) {
        body.innerHTML = layout.errorState({ message: error.message, retry: false });
        layout.refreshIcons();
      });
  }

  function initDetailLinks() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-detail]');
      if (!trigger) return;

      if (trigger.hasAttribute('data-close-search')) {
        closeDialog(document.getElementById('search-dialog'));
      }

      var parts = trigger.getAttribute('data-detail').split(':');
      openDetail(parts[0], parts[1]);
    });
  }

  /* ---------------- animation ---------------- */

  function initAnimations() {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !window.gsap) return;

    if (document.querySelector('.hero h1')) {
      gsap.from('.hero .eyebrow, .hero h1, .hero-lead, .hero-actions, .hero-meta', {
        y: 22,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power2.out',
      });
    }

    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      gsap.utils.toArray('.section-head, .split-media, .split-body, .form-card').forEach(function (element) {
        gsap.from(element, {
          y: 20,
          opacity: 0,
          duration: 0.55,
          ease: 'power1.out',
          scrollTrigger: { trigger: element, start: 'top 90%', once: true },
        });
      });
    }
  }

  /* ---------------- boot ---------------- */

  function boot() {
    layout.renderHeader(null);
    layout.renderDialogs();
    initNavigation();
    layout.refreshIcons();
    initDialogBasics();
    initSearch();
    initDetailLinks();

    ARAMIOT.organizationReady = api
      .getOrganization()
      .then(function (response) {
        ARAMIOT.organization = response.data;
        layout.renderFooter(response.data);
        return response.data;
      })
      .catch(function () {
        ARAMIOT.organization = null;
        layout.renderFooter(null);
        return null;
      })
      .then(function (organization) {
        layout.refreshIcons();
        initAnimations();
        return organization;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.ARAMIOT);
```

#### `frontend/assets/js/page.js`

```js
/* global window, document */
/**
 * Generic page renderer.
 *
 * Every inner page is a static shell. This module fills:
 *   [data-page-hero]     with the Page document from the API (title, excerpt)
 *   [data-page-content]  with the Page document's editable HTML
 *   [data-list="..."]    with a paginated, optionally searchable listing
 *
 * Page structure lives in HTML; page copy and listings come from MongoDB.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var cards = ARAMIOT.cards;

  var LISTS = {
    articles: { load: api.getArticles, render: cards.article, label: 'articles', wrap: 'tile-grid' },
    projects: { load: api.getProjects, render: cards.project, label: 'projects', wrap: 'tile-grid' },
    programs: { load: api.getPrograms, render: cards.program, label: 'programmes', wrap: 'tile-grid' },
    publications: { load: api.getPublications, render: cards.publication, label: 'publications', wrap: 'tile-grid' },
    resources: { load: api.getResources, render: cards.resource, label: 'resources', wrap: 'tile-grid' },
    team: { load: api.getTeam, render: cards.teamMember, label: 'team members', wrap: 'tile-grid' },
    impact: { load: api.getImpact, render: cards.statistic, label: 'impact statistics', wrap: 'stat-grid' },
  };

  var SECTION_LABELS = {
    home: 'Home',
    overview: 'Overview',
    about: 'About',
    health: 'Health',
    education: 'Education',
    advocacy: 'Advocacy',
    'our-work': 'Our work',
    resources: 'Resources',
    'get-involved': 'Get involved',
    contact: 'Contact',
  };

  function crumbsFor(title) {
    return [
      { label: 'Home', href: 'index.html' },
      { label: title },
    ];
  }

  /* ---------------- page hero + content ---------------- */

  function renderHeroSkeleton(hero) {
    hero.innerHTML =
      '<section class="page-hero"><div class="container">' +
        '<div class="skeleton skeleton-line skeleton-line--short" style="max-width:220px"></div>' +
        '<div class="skeleton skeleton-line" style="height:34px;max-width:520px"></div>' +
        '<div class="skeleton skeleton-line skeleton-line--short" style="max-width:360px;margin-top:14px"></div>' +
      '</div></section>';
  }

  function mountPage(main) {
    var hero = main.querySelector('[data-page-hero]');
    var content = main.querySelector('[data-page-content]');
    var slug = main.getAttribute('data-page-slug');
    var fallbackTitle = (hero && hero.getAttribute('data-fallback-title')) || 'ARAMIOT';
    var fallbackLead = (hero && hero.getAttribute('data-fallback-lead')) || '';

    function renderFallback(message) {
      if (hero) {
        layout.renderPageHero(hero, {
          title: fallbackTitle,
          lead: fallbackLead,
          breadcrumb: crumbsFor(fallbackTitle),
        });
      }
      if (content && message) {
        content.innerHTML = layout.errorState({ message: message });
        var retry = content.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', function () { mountPage(main); });
        layout.refreshIcons();
      }
    }

    if (!slug) return;
    if (hero) renderHeroSkeleton(hero);

    api
      .getPage(slug)
      .then(function (response) {
        var page = response.data;

        layout.renderPageHero(hero, {
          title: page.title || fallbackTitle,
          lead: page.excerpt || fallbackLead,
          section: SECTION_LABELS[page.section] || '',
          breadcrumb: crumbsFor(page.title || fallbackTitle),
        });

        if (content) {
          content.innerHTML = page.content
            ? '<div class="prose">' + page.content + '</div>'
            : layout.emptyState({
                title: 'Content coming soon',
                message: 'This page has not been published yet.',
              });
        }
        layout.refreshIcons();
      })
      .catch(function (error) {
        renderFallback(error.message);
      });
  }

  /* ---------------- listings ---------------- */

  function pagerMarkup(state) {
    return (
      '<div class="pager">' +
        '<button class="button button--outline button--sm" type="button" data-page-prev' +
        (state.page <= 1 ? ' disabled' : '') + '>Previous</button>' +
        '<span class="pager-status">Page ' + state.page + ' of ' + state.pages + '</span>' +
        '<button class="button button--outline button--sm" type="button" data-page-next' +
        (state.page >= state.pages ? ' disabled' : '') + '>Next</button>' +
      '</div>'
    );
  }

  function mountList(container) {
    var type = container.getAttribute('data-list');
    var config = LISTS[type];
    if (!config) return;

    var limit = parseInt(container.getAttribute('data-limit'), 10) || 6;
    var category = container.getAttribute('data-category') || '';
    var searchable = container.getAttribute('data-search') === 'true';
    var state = { page: 1, search: '', pages: 1, total: 0 };

    container.innerHTML =
      (searchable
        ? '<form class="list-search" role="search" data-list-search>' +
            '<label class="visually-hidden" for="search-' + type + '">Search ' + config.label + '</label>' +
            '<input id="search-' + type + '" type="search" name="search" placeholder="Search ' + config.label + '&hellip;" autocomplete="off">' +
            '<button class="button button--primary button--sm" type="submit">Search</button>' +
          '</form>'
        : '') +
      '<div class="list-body" aria-live="polite"></div>' +
      '<div class="list-footer"></div>';

    var body = container.querySelector('.list-body');
    var footer = container.querySelector('.list-footer');
    var searchForm = container.querySelector('[data-list-search]');

    function renderFooter() {
      if (state.total === 0) {
        footer.innerHTML = '';
        return;
      }
      footer.innerHTML =
        (state.pages > 1 ? pagerMarkup(state) : '') +
        '<p class="list-count">' + state.total + ' ' + config.label + ' published</p>';

      var prev = footer.querySelector('[data-page-prev]');
      var next = footer.querySelector('[data-page-next]');

      if (prev) {
        prev.addEventListener('click', function () {
          if (state.page > 1) {
            state.page -= 1;
            load();
          }
        });
      }
      if (next) {
        next.addEventListener('click', function () {
          if (state.page < state.pages) {
            state.page += 1;
            load();
          }
        });
      }
    }

    function load() {
      body.innerHTML = layout.tilesSkeleton(Math.min(limit, 3));
      footer.innerHTML = '';

      var params = { page: state.page, limit: limit };
      if (state.search) params.search = state.search;
      if (category) params.category = category;

      config
        .load(params)
        .then(function (response) {
          var items = response.data || [];
          state.pages = (response.meta && response.meta.pages) || 1;
          state.total = (response.meta && response.meta.total) || items.length;

          if (items.length === 0) {
            body.innerHTML = layout.emptyState({
              title: state.search ? 'No results found' : 'Nothing published yet',
              message: state.search
                ? 'No ' + config.label + ' matched "' + state.search + '". Try a different word.'
                : 'Published ' + config.label + ' will appear here.',
            });
            renderFooter();
            layout.refreshIcons();
            return;
          }

          body.innerHTML =
            '<div class="' + config.wrap + '">' + items.map(config.render).join('') + '</div>';
          renderFooter();
          layout.refreshIcons();
        })
        .catch(function (error) {
          body.innerHTML = layout.errorState({ message: error.message });
          var retry = body.querySelector('[data-retry]');
          if (retry) retry.addEventListener('click', load);
          layout.refreshIcons();
        });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', function (event) {
        event.preventDefault();
        state.search = searchForm.querySelector('input').value.trim();
        state.page = 1;
        load();
      });
    }

    load();
  }

  /* ---------------- init ---------------- */

  function init() {
    var main = document.getElementById('main');
    if (!main) return;

    mountPage(main);
    main.querySelectorAll('[data-list]').forEach(mountList);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.ARAMIOT);
```

#### `frontend/assets/js/home.js`

```js
/* global window, document */
/**
 * Home page composition.
 * Each section loads independently, so a slow or failing request degrades one
 * section instead of blanking the whole page.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var cards = ARAMIOT.cards;
  var esc = layout.escapeHtml;

  var AREAS = [
    { section: 'health', icon: 'heart-pulse', label: 'Health' },
    { section: 'education', icon: 'graduation-cap', label: 'Education' },
    { section: 'advocacy', icon: 'scale', label: 'Advocacy' },
  ];

  function target(name) {
    return document.querySelector('[data-home="' + name + '"]');
  }

  function tileGrid(markup) {
    return '<div class="tile-grid">' + markup + '</div>';
  }

  function loadSection(name, request, render, options) {
    var element = target(name);
    if (!element) return;

    var settings = options || {};
    element.innerHTML = layout.tilesSkeleton(settings.count || 3);

    request()
      .then(function (response) {
        var items = response.data || [];
        if (!items || items.length === 0) {
          element.innerHTML = layout.emptyState({
            title: settings.emptyTitle || 'Nothing published yet',
            message: settings.emptyMessage || 'Published content will appear here.',
          });
          layout.refreshIcons();
          return;
        }
        element.innerHTML = render(items);
        layout.refreshIcons();
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      })
      .catch(function (error) {
        element.innerHTML = layout.errorState({ message: error.message });
        var retry = element.querySelector('[data-retry]');
        if (retry) {
          retry.addEventListener('click', function () {
            loadSection(name, request, render, options);
          });
        }
        layout.refreshIcons();
      });
  }

  /* ---------------- organisation-driven sections ---------------- */

  function renderIntroduction(organization) {
    var element = target('intro');
    if (!element) return;

    if (!organization) {
      element.innerHTML = layout.emptyState({
        title: 'Organizational profile unavailable',
        message: 'The ARAMIOT profile could not be loaded. Please try again shortly.',
      });
      return;
    }

    element.innerHTML =
      '<p class="split-lead">' + esc(organization.description || organization.tagline || '') + '</p>' +
      (organization.story ? '<p>' + esc(layout.truncate(organization.story, 240)) + '</p>' : '') +
      '<ul class="value-list">' +
      (organization.values || [])
        .slice(0, 4)
        .map(function (value) { return '<li>' + esc(value) + '</li>'; })
        .join('') +
      '</ul>';
    layout.refreshIcons();
  }

  function renderMission(organization) {
    var element = target('mission');
    if (!element) return;

    var mission = (organization && organization.mission) || '';
    var vision = (organization && organization.vision) || '';

    if (!mission && !vision) {
      element.innerHTML = layout.emptyState({
        title: 'Mission and vision coming soon',
        message: 'The organization has not published its mission and vision yet.',
      });
      return;
    }

    element.innerHTML = tileGrid(
      '<article class="tile"><div class="tile-body">' +
        '<h3 class="tile-title">Our mission</h3>' +
        '<p class="tile-text">' + esc(mission) + '</p>' +
      '</div></article>' +
      '<article class="tile"><div class="tile-body">' +
        '<h3 class="tile-title">Our vision</h3>' +
        '<p class="tile-text">' + esc(vision) + '</p>' +
      '</div></article>'
    );
  }

  function renderAreas(pages) {
    var bySection = {};
    pages.forEach(function (page) {
      if (AREAS.some(function (area) { return area.section === page.section; })) {
        if (!bySection[page.section]) bySection[page.section] = page;
      }
    });

    var markup = AREAS.map(function (area) {
      var page = bySection[area.section];
      if (!page) return '';
      return (
        '<article class="tile">' +
          cards.media({}, area.icon, 'project') +
          '<div class="tile-body">' +
            '<h3 class="tile-title">' + esc(page.title) + '</h3>' +
            '<p class="tile-text">' + esc(layout.truncate(page.excerpt, 150)) + '</p>' +
            '<div class="tile-foot">' +
              '<a class="text-link" href="pages/' + area.section + '.html">Explore ' + esc(page.title) +
              layout.icon('arrow-right', 'icon icon--xs') + '</a>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    return markup ? tileGrid(markup) : '';
  }

  function init() {
    var organizationPromise = ARAMIOT.organizationReady || Promise.resolve(null);

    organizationPromise.then(function (organization) {
      renderIntroduction(organization);
      renderMission(organization);
    });

    loadSection(
      'areas',
      function () { return api.getPages({ limit: 100 }); },
      renderAreas,
      {
        count: 3,
        emptyTitle: 'Programme pages coming soon',
        emptyMessage: 'The Health, Education and Advocacy pages have not been published yet.',
      }
    );

    loadSection(
      'projects',
      function () { return api.getProjects({ limit: 3 }); },
      function (items) { return tileGrid(items.map(cards.project).join('')); },
      { emptyTitle: 'No projects published yet', emptyMessage: 'Projects will appear here once published.' }
    );

    loadSection(
      'articles',
      function () { return api.getArticles({ limit: 3 }); },
      function (items) { return tileGrid(items.map(cards.article).join('')); },
      { emptyTitle: 'No articles published yet', emptyMessage: 'News and articles will appear here once published.' }
    );

    loadSection(
      'publications',
      function () { return api.getPublications({ limit: 3 }); },
      function (items) { return tileGrid(items.map(cards.publication).join('')); },
      { emptyTitle: 'No publications yet', emptyMessage: 'Reports and papers will appear here once published.' }
    );

    loadSection(
      'impact',
      function () { return api.getImpact(); },
      function (items) {
        return '<div class="stat-grid">' + items.map(cards.statistic).join('') + '</div>';
      },
      { count: 4, emptyTitle: 'Impact figures pending', emptyMessage: 'Verified impact statistics will appear here.' }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.ARAMIOT);
```

#### `frontend/assets/js/forms.js`

```js
/* global window, document, FormData */
/**
 * Public forms: contact, volunteer application, partnership inquiry.
 * Client-side validation is a convenience; the API validates and sanitises
 * everything again, and its field-level errors are shown to the user.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var esc = layout.escapeHtml;

  var SUBMITTERS = {
    contact: api.submitContact,
    volunteer: api.submitVolunteer,
    partnership: api.submitPartnership,
  };

  function readValues(form) {
    var values = {};
    new FormData(form).forEach(function (value, key) {
      values[key] = typeof value === 'string' ? value.trim() : value;
    });
    return values;
  }

  function clearAlert(form) {
    var alert = form.querySelector('[data-form-alert]');
    if (!alert) return;
    alert.className = 'form-alert';
    alert.innerHTML = '';
  }

  function showAlert(form, variant, message, details) {
    var alert = form.querySelector('[data-form-alert]');
    if (!alert) return;

    var detailList =
      details && details.length
        ? '<ul>' + details.map(function (detail) { return '<li>' + esc(detail.message) + '</li>'; }).join('') + '</ul>'
        : '';

    alert.className = 'form-alert form-alert--' + variant + ' is-visible';
    alert.innerHTML = '<strong>' + esc(message) + '</strong>' + detailList;
    alert.focus();
  }

  function bind(form) {
    var kind = form.getAttribute('data-form');
    var submit = form.querySelector('[type="submit"]');
    var submitter = SUBMITTERS[kind];

    if (!submitter || !submit) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearAlert(form);

      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var originalLabel = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'Sending\u2026';

      submitter(readValues(form))
        .then(function (response) {
          form.reset();
          showAlert(form, 'success', response.message || 'Thank you — your submission has been received.');
        })
        .catch(function (error) {
          showAlert(form, 'error', error.message || 'Your submission could not be sent. Please try again.', error.details);
        })
        .finally(function () {
          submit.disabled = false;
          submit.textContent = originalLabel;
        });
    });
  }

  /* ---------------- contact details (from the organization profile) ---------------- */

  function contactItem(iconName, label, value, href) {
    var valueMarkup = href
      ? '<a href="' + esc(href) + '">' + esc(value) + '</a>'
      : esc(value);
    return (
      '<div class="contact-item">' +
        layout.icon(iconName) +
        '<div><dt>' + esc(label) + '</dt><dd>' + valueMarkup + '</dd></div>' +
      '</div>'
    );
  }

  function renderContactDetails() {
    var target = document.querySelector('[data-contact-details]');
    if (!target) return;

    (ARAMIOT.organizationReady || Promise.resolve(null)).then(function (organization) {
      if (!organization) {
        target.innerHTML = '<p class="hint">Contact details are currently unavailable. Please use the form.</p>';
        return;
      }

      var address = organization.address || {};
      var addressText = [address.street, address.city, address.region, address.country]
        .filter(Boolean)
        .join(', ');

      target.innerHTML =
        '<dl>' +
        (organization.contactEmail
          ? contactItem('mail', 'Email', organization.contactEmail, 'mailto:' + organization.contactEmail)
          : '') +
        (organization.contactPhone ? contactItem('phone', 'Phone', organization.contactPhone) : '') +
        (addressText ? contactItem('map-pin', 'Address', addressText) : '') +
        '</dl>' +
        '<p class="hint">Partnership enquiries can be sent through the form, or use the partnership form on the Get involved page.</p>';
      layout.refreshIcons();
    });
  }

  function init() {
    document.querySelectorAll('form[data-form]').forEach(bind);
    renderContactDetails();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.ARAMIOT);
```

---

## Appendix B — File reference

| File | Lines |
| --- | --- |
| `package.json` | 26 |
| `README.md` | 264 |
| `.env.example` | 27 |
| `.gitignore` | 26 |
| `backend/config/env.js` | 45 |
| `backend/config/database.js` | 74 |
| `backend/config/constants.js` | 99 |
| `backend/models/sharedFields.js` | 108 |
| `backend/models/Organization.js` | 59 |
| `backend/models/Page.js` | 47 |
| `backend/models/Article.js` | 47 |
| `backend/models/Category.js` | 41 |
| `backend/models/Project.js` | 47 |
| `backend/models/Program.js` | 38 |
| `backend/models/TeamMember.js` | 26 |
| `backend/models/Publication.js` | 54 |
| `backend/models/Resource.js` | 52 |
| `backend/models/ImpactStatistic.js` | 33 |
| `backend/models/ContactMessage.js` | 38 |
| `backend/models/VolunteerApplication.js` | 44 |
| `backend/models/PartnershipInquiry.js` | 44 |
| `backend/utils/ApiError.js` | 52 |
| `backend/utils/asyncHandler.js` | 14 |
| `backend/utils/validate.js` | 141 |
| `backend/utils/query.js` | 87 |
| `backend/utils/slugify.js` | 19 |
| `backend/services/contentService.js` | 140 |
| `backend/middleware/errorHandler.js` | 72 |
| `backend/middleware/notFound.js` | 31 |
| `backend/middleware/securityHeaders.js` | 17 |
| `backend/middleware/validateBody.js` | 24 |
| `backend/validators/contact.js` | 17 |
| `backend/validators/volunteer.js` | 20 |
| `backend/validators/partnership.js` | 18 |
| `backend/controllers/organizationController.js` | 22 |
| `backend/controllers/pageController.js` | 28 |
| `backend/controllers/articleController.js` | 29 |
| `backend/controllers/projectController.js` | 28 |
| `backend/controllers/programController.js` | 28 |
| `backend/controllers/publicationController.js` | 29 |
| `backend/controllers/resourceController.js` | 29 |
| `backend/controllers/teamController.js` | 19 |
| `backend/controllers/categoryController.js` | 39 |
| `backend/controllers/impactController.js` | 22 |
| `backend/controllers/formController.js` | 55 |
| `backend/routes/index.js` | 58 |
| `backend/routes/content.routes.js` | 32 |
| `backend/routes/categories.routes.js` | 12 |
| `backend/routes/organization.routes.js` | 12 |
| `backend/routes/team.routes.js` | 12 |
| `backend/routes/impact.routes.js` | 12 |
| `backend/routes/forms.routes.js` | 22 |
| `backend/app.js` | 87 |
| `backend/server.js` | 79 |
| `backend/seed/sampleData.js` | 603 |
| `backend/seed/seed.js` | 36 |
| `backend/tests/api.test.js` | 291 |
| `frontend/index.html` | 161 |
| `frontend/404.html` | 65 |
| `frontend/pages/overview.html` | 69 |
| `frontend/pages/about.html` | 69 |
| `frontend/pages/health.html` | 83 |
| `frontend/pages/education.html` | 83 |
| `frontend/pages/advocacy.html` | 83 |
| `frontend/pages/our-work.html` | 97 |
| `frontend/pages/resources.html` | 83 |
| `frontend/pages/publications.html` | 78 |
| `frontend/pages/get-involved.html` | 154 |
| `frontend/pages/contact.html` | 95 |
| `frontend/assets/css/styles.css` | 1000 |
| `frontend/config/config.js` | 19 |
| `frontend/components/layout.js` | 398 |
| `frontend/components/cards.js` | 186 |
| `frontend/assets/js/api.js` | 118 |
| `frontend/assets/js/main.js` | 355 |
| `frontend/assets/js/page.js` | 252 |
| `frontend/assets/js/home.js` | 203 |
| `frontend/assets/js/forms.js` | 139 |

Total source files: 78.

---

*End of Phase 1 document. Sample content in the seed files is development data,
not verified organizational information.*
