/* global window, document */
/**
 * ARAMIOT admin content module.
 *
 * Shared rendering + CRUD for content sections (pages, articles, categories, projects,
 * programs, team, publications, resources, impact) and inbox sections (messages,
 * applications, inquiries). Each HTML page sets window.ARAMIOT_ADMIN_SECTION to a
 * known section key and calls ARAMIOT_ADMIN.content.init().
 *
 * Email field behavior (important, matches the backend):
 *  - The backend normalizes emails to lowercase and validates format.
 *    For create/update forms we render an email field and submit it as-is; the backend
 *    handles normalization. We do not double-normalize in the UI beyond trimming.
 *
 * Reference fields (type: 'reference') render a <select> populated from a referenced
 * admin collection (e.g. categories). The selected value is the referenced document's
 * id (an ObjectId string), which the backend casts to the correct type on save. This
 * avoids sending slugs where the schema expects an ObjectId.
 *
 * Media fields: content forms use flat featuredImageUrl / featuredImageAlt (and
 * coverImageUrl / coverImageAlt, profileImageUrl / profileImageAlt) text inputs; the
 * normalize step builds the embedded media object { url, alt } for the backend.
 * Gallery on projects is a textarea (one image URL per line) that becomes
 * gallery: [{ url }] — alt text per image is a Phase 3 enhancement.
 *
 * Email field behavior (important, matches the backend):
 *  - The backend normalizes emails to lowercase and validates format.
 *    For create/update forms we render an email field and submit it as-is; the backend
 *    handles normalization. We do not double-normalize in the UI beyond trimming.
 */

(function (global) {
  'use strict';

  var win = global.window;
  var doc = win.document;
  var ARAMIOT = global.ARAMIOT_ADMIN || {};
  var api = ARAMIOT.api;
  var SECTIONS = {};

  function register(config) {
    SECTIONS[config.slug] = config;
  }

  // ---------- section configs ----------

  register({
    slug: 'pages',
    label: 'Pages',
    listFields: [
      { key: 'title', label: 'Title' },
      { key: 'section', label: 'Section' },
      { key: 'status', label: 'Status', pill: true },
      { key: 'updatedAt', label: 'Updated', date: true },
    ],
    params: { filterFields: { section: 'section' }, searchFields: ['title', 'excerpt'] },
    enumMeta: { section: { list: ['home','overview','about','health','education','advocacy','our-work','resources','get-involved','contact'] } },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Our Approach' },
      { key: 'section', label: 'Section', type: 'select', required: true, options: ['home','overview','about','health','education','advocacy','our-work','resources','get-involved','contact'] },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title if blank', help: 'Lowercase, hyphenated. Leave blank to generate from the title.' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea', richtext: true, placeholder: 'Short summary (HTML)', help: 'Used on section listings.' },
      { key: 'content', label: 'Content', type: 'textarea', richtext: true, required: true, placeholder: 'Page content (HTML)' },
      { key: 'featuredImageUrl', label: 'Featured image URL', type: 'text', placeholder: 'https://…' },
      { key: 'featuredImageAlt', label: 'Featured image alt text', type: 'text' },
      { key: 'seoTitle', label: 'SEO title', type: 'text', placeholder: 'Overrides the title in search results' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea', placeholder: 'Up to 160 characters' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'draft' },
      { key: 'publishedAt', label: 'Published at', type: 'date' },
    ],
  });

  register({
    slug: 'articles',
    label: 'Articles',
    listFields: [
      { key: 'title', label: 'Title' },
      { key: 'author', label: 'Author' },
      { key: 'status', label: 'Status', pill: true },
      { key: 'publishedAt', label: 'Published', date: true },
      { key: 'updatedAt', label: 'Updated', date: true },
    ],
    params: { filterFields: { tag: 'tags' }, searchFields: ['title', 'excerpt', 'tags'] },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Article headline' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title if blank' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea', richtext: true, placeholder: 'Short summary (HTML) shown in listings' },
      { key: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Article body' },
      { key: 'author', label: 'Author', type: 'text', placeholder: 'Byline' },
      { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'health, community (one per line or comma-separated)' },
      { key: 'category', label: 'Category', type: 'reference', refModel: 'categories', refLabelField: 'name', refValueField: '_id', required: true, placeholder: 'Select a category' },
      { key: 'featuredImageUrl', label: 'Featured image URL', type: 'text', placeholder: 'https://…' },
      { key: 'featuredImageAlt', label: 'Featured image alt text', type: 'text' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'draft' },
      { key: 'publishedAt', label: 'Published at', type: 'date' },
    ],
  });

  register({
    slug: 'categories',
    label: 'Categories',
    listFields: [
      { key: 'name', label: 'Name' },
      { key: 'scopes', label: 'Scopes', list: true },
      { key: 'parentCategory', label: 'Parent', OBJECTID: true },
      { key: 'status', label: 'Status', pill: true },
    ],
    params: { filterFields: { scope: 'scopes' } },
    enumMeta: { scopes: { list: ['articles','projects','programs','publications','resources','general'] } },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Mental Health' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from name if blank' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Short description of the category' },
      {
        key: 'scopes',
        label: 'Scopes',
        type: 'select-multiple',
        required: true,
        options: ['articles','projects','programs','publications','resources','general'],
        help: 'Which content types this category classifies.',
      },
      { key: 'parentCategory', label: 'Parent category (optional)', type: 'reference', refModel: 'categories', refLabelField: 'name', refValueField: '_id', placeholder: 'Select a parent category' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'published' },
    ],
  });

  register({
    slug: 'projects',
    label: 'Projects',
    listFields: [
      { key: 'title', label: 'Title' },
      { key: 'location', label: 'Location' },
      { key: 'startDate', label: 'Start', date: true },
      { key: 'status', label: 'Status', pill: true },
      { key: 'updatedAt', label: 'Updated', date: true },
    ],
    params: { searchFields: ['title', 'summary', 'location'] },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Project title' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title if blank' },
      { key: 'summary', label: 'Summary', type: 'textarea', placeholder: 'Short summary for listings' },
      { key: 'description', label: 'Description', type: 'textarea', richtext: true, placeholder: 'Full project description (HTML)' },
      { key: 'objectives', label: 'Objectives', type: 'tags', placeholder: 'One objective per line' },
      { key: 'activities', label: 'Activities', type: 'tags', placeholder: 'One activity per line' },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Where the project takes place' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'category', label: 'Category', type: 'reference', refModel: 'categories', refLabelField: 'name', refValueField: '_id', required: true, placeholder: 'Select a category' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'draft' },
      { key: 'featuredImageUrl', label: 'Featured image URL', type: 'text', placeholder: 'https://…' },
      { key: 'featuredImageAlt', label: 'Featured image alt text', type: 'text' },
      { key: 'galleryUrls', label: 'Gallery images', type: 'textarea', rows: 4, placeholder: 'One image URL per line', help: 'Each line becomes one gallery image. Alt text is left blank in this phase.' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
    ],
  });

  register({
    slug: 'programs',
    label: 'Programs',
    listFields: [
      { key: 'title', label: 'Title' },
      { key: 'targetAudience', label: 'Audience' },
      { key: 'status', label: 'Status', pill: true },
      { key: 'updatedAt', label: 'Updated', date: true },
    ],
    params: { searchFields: ['title', 'description', 'targetAudience'] },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Program title' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title if blank' },
      { key: 'description', label: 'Description', type: 'textarea', richtext: true, required: true, placeholder: 'What the program does (HTML)' },
      { key: 'objectives', label: 'Objectives', type: 'tags', placeholder: 'One objective per line' },
      { key: 'activities', label: 'Activities', type: 'tags', placeholder: 'One activity per line' },
      { key: 'targetAudience', label: 'Target audience', type: 'textarea', richtext: true, placeholder: 'Who the program serves (HTML)' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'category', label: 'Category', type: 'reference', refModel: 'categories', refLabelField: 'name', refValueField: '_id', required: true, placeholder: 'Select a category' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'draft' },
      { key: 'featuredImageUrl', label: 'Featured image URL', type: 'text', placeholder: 'https://…' },
      { key: 'featuredImageAlt', label: 'Featured image alt text', type: 'text' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
    ],
  });

  register({
    slug: 'team',
    label: 'Team',
    listFields: [
      { key: 'name', label: 'Name' },
      { key: 'position', label: 'Position' },
      { key: 'department', label: 'Department' },
      { key: 'displayOrder', label: 'Order' },
      { key: 'status', label: 'Status', pill: true },
    ],
    params: { searchFields: ['name', 'position', 'department'] },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Full name' },
      { key: 'position', label: 'Position', type: 'text', required: true, placeholder: 'e.g. Executive Director' },
      { key: 'department', label: 'Department', type: 'text', placeholder: 'e.g. Operations' },
      { key: 'biography', label: 'Biography', type: 'textarea', richtext: true, placeholder: 'Short bio for the About page (HTML)' },
      { key: 'profileImageUrl', label: 'Profile image URL', type: 'text', placeholder: 'https://…' },
      { key: 'profileImageAlt', label: 'Profile image alt text', type: 'text' },
      { key: 'displayOrder', label: 'Display order', type: 'number', help: 'Lower numbers appear first on the About page.' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'published' },
    ],
  });

  register({
    slug: 'publications',
    label: 'Publications',
    listFields: [
      { key: 'title', label: 'Title' },
      { key: 'publicationType', label: 'Type' },
      { key: 'status', label: 'Status', pill: true },
      { key: 'publicationDate', label: 'Date', date: true },
      { key: 'updatedAt', label: 'Updated', date: true },
    ],
    params: { filterFields: { publicationType: 'publicationType' }, searchFields: ['title', 'abstract', 'authors'] },
    enumMeta: { publicationType: { list: ['report','research-paper','policy-brief','technical-report','other'] } },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Publication title' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title if blank' },
      { key: 'abstract', label: 'Abstract', type: 'textarea', richtext: true, placeholder: 'Short abstract (HTML)' },
      { key: 'authors', label: 'Authors', type: 'tags', placeholder: 'One author per line' },
      { key: 'publicationType', label: 'Publication type', type: 'select', required: true, options: ['report','research-paper','policy-brief','technical-report','other'] },
      { key: 'category', label: 'Category', type: 'reference', refModel: 'categories', refLabelField: 'name', refValueField: '_id', required: true, placeholder: 'Select a category' },
      { key: 'coverImageUrl', label: 'Cover image URL', type: 'text', placeholder: 'https://…' },
      { key: 'coverImageAlt', label: 'Cover image alt text', type: 'text' },
      { key: 'fileId', label: 'File ID (Drive)', type: 'text', placeholder: 'Google Drive file id (Phase 3)', help: 'For Google Drive files, once the Drive integration is wired in Phase 3.' },
      { key: 'fileUrl', label: 'File URL', type: 'text', required: true, placeholder: 'Link to the PDF/document' },
      { key: 'fileProvider', label: 'File provider', type: 'select', options: ['local','google-drive'], default: 'local' },
      { key: 'publicationDate', label: 'Publication date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'draft' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
    ],
  });

  register({
    slug: 'resources',
    label: 'Resources',
    listFields: [
      { key: 'title', label: 'Title' },
      { key: 'resourceType', label: 'Type' },
      { key: 'status', label: 'Status', pill: true },
      { key: 'updatedAt', label: 'Updated', date: true },
    ],
    params: { filterFields: { resourceType: 'resourceType' }, searchFields: ['title', 'description'] },
    enumMeta: { resourceType: { list: ['learning-material','guideline','toolkit','dataset','other'] } },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Resource title' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title if blank' },
      { key: 'description', label: 'Description', type: 'textarea', richtext: true, placeholder: 'What this resource covers (HTML)' },
      { key: 'resourceType', label: 'Resource type', type: 'select', required: true, options: ['learning-material','guideline','toolkit','dataset','other'] },
      { key: 'category', label: 'Category', type: 'reference', refModel: 'categories', refLabelField: 'name', refValueField: '_id', required: true, placeholder: 'Select a category' },
      { key: 'coverImageUrl', label: 'Cover image URL', type: 'text', placeholder: 'https://…' },
      { key: 'coverImageAlt', label: 'Cover image alt text', type: 'text' },
      { key: 'fileId', label: 'File ID (Drive)', type: 'text', placeholder: 'Google Drive file id (Phase 3)' },
      { key: 'fileUrl', label: 'File URL', type: 'text', placeholder: 'Link to the file' },
      { key: 'fileProvider', label: 'File provider', type: 'select', options: ['local','google-drive'], default: 'local' },
      { key: 'externalUrl', label: 'External URL (optional)', type: 'text', placeholder: 'If this resource links outward instead of a file' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'], default: 'draft' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
    ],
  });

  register({
    slug: 'impact',
    label: 'Impact',
    listFields: [
      { key: 'title', label: 'Title' },
      { key: 'value', label: 'Value' },
      { key: 'unit', label: 'Unit' },
      { key: 'isPublished', label: 'Published', bool: true },
      { key: 'displayOrder', label: 'Order' },
    ],
    params: { searchFields: ['title', 'description'] },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. People reached' },
      { key: 'value', label: 'Value', type: 'number', required: true, placeholder: 'Number to display' },
      { key: 'unit', label: 'Unit', type: 'text', placeholder: 'e.g. people, schools, families' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Context for this statistic' },
      { key: 'displayOrder', label: 'Display order', type: 'number', help: 'Lower numbers appear first.' },
      { key: 'isPublished', label: 'Published', type: 'checkbox' },
    ],
  });

  // ---------- inbox sections ----------

  register({
    slug: 'messages',
    label: 'Messages',
    listFields: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'subject', label: 'Subject' },
      { key: 'createdAt', label: 'Received', date: true },
      { key: 'status', label: 'Status', pill: true },
    ],
    params: { searchFields: ['name', 'email', 'subject', 'message'] },
    inbox: true,
    statuses: ['new','read','replied','archived'],
    detailFields: ['name','email','subject','message','createdAt','status'],
  });

  register({
    slug: 'applications',
    label: 'Applications',
    listFields: [
      { key: 'fullName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'areaOfInterest', label: 'Interest' },
      { key: 'createdAt', label: 'Received', date: true },
      { key: 'status', label: 'Status', pill: true },
    ],
    params: { filterFields: { areaOfInterest: 'areaOfInterest' }, searchFields: ['fullName','email','experience','motivation'] },
    enumMeta: { areaOfInterest: { list: ['health','education','advocacy','research','communications','fundraising','operations','other'] } },
    inbox: true,
    statuses: ['new','reviewing','accepted','declined','archived'],
    detailFields: ['fullName','email','phone','areaOfInterest','experience','motivation','createdAt','status'],
  });

  register({
    slug: 'inquiries',
    label: 'Inquiries',
    listFields: [
      { key: 'organizationName', label: 'Organization' },
      { key: 'contactPerson', label: 'Contact' },
      { key: 'subject', label: 'Subject' },
      { key: 'createdAt', label: 'Received', date: true },
      { key: 'status', label: 'Status', pill: true },
    ],
    params: { searchFields: ['organizationName','contactPerson','email','subject','message'] },
    inbox: true,
    statuses: ['new','reviewing','responded','closed'],
    detailFields: ['organizationName','contactPerson','email','subject','message','createdAt','status'],
  });

  // ---------- shared helpers ----------

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pillClassFor(status) {
    if (status == null) return 'pill--draft';
    var key = String(status).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    var map = {
      draft: 'pill--draft',
      published: 'pill--published',
      archived: 'pill--archived',
      new: 'pill--new',
      read: 'pill--read',
      replied: 'pill--replied',
      reviewing: 'pill--reviewing',
      accepted: 'pill--accepted',
      declined: 'pill--declined',
      responded: 'pill--responded',
      closed: 'pill--closed',
    };
    return map[key] || 'pill--draft';
  }

  function pillHtml(status) {
    return '<span class="pill ' + pillClassFor(status) + '">' + esc(status) + '</span>';
  }

  function dateShort(iso) {
    if (!iso) return '—';
    var d;
    try { d = new Date(iso); } catch (e) { return esc(iso); }
    if (isNaN(d.getTime())) return esc(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function link(label, href, cls) {
    var a = doc.createElement('a');
    a.className = 'btn-admin ' + (cls || 'btn-admin--secondary');
    a.href = href;
    a.textContent = label;
    return a;
  }

  // ---------- CSRF + session guard ----------

  function ensureReady() {
    return api.refreshCsrf().then(function () {
      return api.session();
    }).then(function (session) {
      if (!session || session.data.authenticated !== true) {
        throw { status: 401 };
      }
      return session;
    });
  }

  // ---------- list rendering ----------

  function listFieldsHtml(config, doc) {
    var table = doc.createElement('table');
    table.className = 'admin-table';
    var thead = doc.createElement('thead');
    var headRow = doc.createElement('tr');
    config.listFields.forEach(function (f) {
      var th = doc.createElement('th');
      th.textContent = f.label;
      headRow.appendChild(th);
    });
    var actionsTh = doc.createElement('th');
    actionsTh.textContent = '';
    headRow.appendChild(actionsTh);
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = doc.createElement('tbody');
    return { table: table, tbody: tbody };
  }

  function renderList(opts) {
    var config = opts.config;
    var container = opts.container;
    var meta = opts.meta;
    var items = opts.items;

    // listFieldsHtml(config, doc) builds the table with the document it is given;
    // passing null here threw "Cannot read properties of null (reading 'createElement')".
    var skeleton = listFieldsHtml(config, doc);
    container.innerHTML = '';
    container.appendChild(skeleton.table);

    if (!items || items.length === 0) {
      var empty = doc.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML =
        '<div class="icon">—</div>' +
        '<div class="title">No ' + esc(config.label) + ' yet</div>' +
        '<p class="mb-0">' + (opts.emptyMessage || 'Create one to get started.') + '</p>';
      container.appendChild(empty);
      renderPagination(meta, container, opts);
      return;
    }

    var tbody = skeleton.tbody;
    // The loop parameter used to be called `doc`, which shadowed the module-level
    // `doc` (the document) and made doc.createElement() throw inside every row.
    var docEl = doc;
    items.forEach(function (item) {
      var tr = docEl.createElement('tr');
      config.listFields.forEach(function (f) {
        var td = docEl.createElement('td');
        var val = item[f.key];
        if (f.pill) {
          td.innerHTML = pillHtml(val);
          tr.appendChild(td);
          return;
        }
        if (f.date) {
          td.textContent = dateShort(val);
          tr.appendChild(td);
          return;
        }
        if (f.list) {
          if (Array.isArray(val) && val.length) {
            td.textContent = val.join(', ');
          } else {
            td.textContent = '—';
          }
          tr.appendChild(td);
          return;
        }
        if (f.OBJECTID) {
          if (val) {
            td.textContent = val;
          } else {
            td.textContent = '—';
          }
          tr.appendChild(td);
          return;
        }
        if (f.bool) {
          td.textContent = val ? 'Yes' : 'No';
          tr.appendChild(td);
          return;
        }
        td.textContent = val != null ? String(val) : '—';
        tr.appendChild(td);
      });

      var actionsTd = docEl.createElement('td');
      actionsTd.className = 'actions';
      var editBtn = link('Edit', '/admin/' + config.slug + '.html?id=' + encodeURIComponent(String(item._id)), 'btn-admin--secondary');
      actionsTd.appendChild(editBtn);
      if (config.inbox) {
        var statusSelect = makeStatusSelect(item.status, config.statuses, function (newStatus) {
          updateInboxStatus(config.slug, item._id, newStatus, opts);
        });
        actionsTd.appendChild(statusSelect);
        var delBtn = link('Delete', '#', 'btn-admin--ghost');
        delBtn.addEventListener('click', function (e) {
          e.preventDefault();
          var label = item.fullName || item.organizationName || item.name || 'this item';
          if (!confirm('Permanently delete \"' + esc(label) + '\"? This cannot be undone.')) return;
          deleteInboxItem(config.slug, item._id, opts);
        });
        actionsTd.appendChild(delBtn);
      } else {
        var archiveBtn = link('Archive', '#', 'btn-admin--ghost');
        archiveBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (!confirm('Archive \"' + esc(item.title || item.name || item.fullName || item.organizationName || 'this item') + '\"?')) return;
          archiveItem(config.slug, item._id, opts);
        });
        actionsTd.appendChild(archiveBtn);
      }
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });
    // The rows belong inside the <table>; appending the tbody to the container
    // instead left the table empty and the list looked broken.
    skeleton.table.appendChild(tbody);
    renderPagination(meta, container, opts);
  }

  function makeStatusSelect(current, statuses, onChange) {
    var select = doc.createElement('select');
    select.className = 'form-select form-select-sm';
    select.style.width = '';
    statuses.forEach(function (s) {
      var opt = doc.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === current) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      if (select.value === current) return;
      onChange(select.value);
      select.value = current;
    });
    return select;
  }

  function renderPagination(meta, container, opts) {
    if (!meta) return;
    var pages = meta.pages || 1;
    var page = meta.page || 1;
    var total = meta.total || 0;
    var nav = doc.createElement('div');
    nav.className = 'admin-card-footer d-flex justify-content-between align-items-center flex-wrap gap-2';
    var info = doc.createElement('div');
    info.style.fontSize = '0.85rem';
    info.style.color = 'var(--admin-muted)';
    info.textContent = 'Showing ' + ((page - 1) * (meta.limit || 20) + 1) + '–' + Math.min(page * (meta.limit || 20), total) + ' of ' + total + ' ' + esc(opts.config.label);
    nav.appendChild(info);

    var paging = doc.createElement('div');
    paging.className = 'd-flex gap-1';
    if (meta.hasPrevPage) {
      var prev = link('Prev', opts.pageUrl(page - 1), 'btn-admin--ghost');
      paging.appendChild(prev);
    }
    var pageSpan = doc.createElement('span');
    pageSpan.className = 'badge-id';
    pageSpan.textContent = 'Page ' + page + ' of ' + pages;
    paging.appendChild(pageSpan);
    if (meta.hasNextPage) {
      var next = link('Next', opts.pageUrl(page + 1), 'btn-admin--ghost');
      paging.appendChild(next);
    }
    nav.appendChild(paging);
    container.appendChild(nav);
  }

  // ---------- modal (new / edit) ----------

  var modalTemplate = (
    '<div class="modal fade" id="admin-modal" tabindex="-1" aria-hidden="true">' +
      '<div class="modal-dialog modal-lg">' +
        '<div class="modal-content admin-card">' +
          '<div class="modal-header" style="border-bottom-color:var(--admin-border);">' +
            '<h5 class="modal-title" id="modal-title"></h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
          '</div>' +
          '<div class="modal-body admin-card-body">' +
            '<div id="modal-alert" class="admin-alert admin-alert--error admin-hide"></div>' +
            '<form id="modal-form" class="admin-form" novalidate></form>' +
          '</div>' +
          '<div class="modal-footer" style="border-top-color:var(--admin-border);">' +
            '<button type="button" class="btn-admin btn-admin--secondary" data-bs-dismiss="modal">Cancel</button>' +
            '<button type="submit" class="btn-admin btn-admin--primary" id="modal-save" disabled>Save</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  var modalState = {
    config: null,
    doc: null,
    isNew: false,
    saving: false,
    onSave: null,
    onCancel: null,
  };

  function buildModal() {
    if (!doc.getElementById('admin-modal')) {
      var div = doc.createElement('div');
      div.innerHTML = modalTemplate;
      doc.body.appendChild(div.firstElementChild);
    }
  }

  function fieldHtml(f) {
    var wrap = doc.createElement('div');
    wrap.className = 'field';

    var label = doc.createElement('label');
    label.setAttribute('for', 'f-' + f.key);
    label.textContent = f.label;
    if (f.required) {
      var r = doc.createElement('span');
      r.className = 'text-danger';
      r.textContent = ' *';
      label.appendChild(r);
    }
    wrap.appendChild(label);

    var help = f.help ? (function () {
      var h = doc.createElement('small');
      h.className = 'field-hint';
      h.textContent = f.help;
      return h;
    })() : null;

    var type = f.type;
    if (type === 'textarea') {
      var ta = doc.createElement('textarea');
      ta.id = 'f-' + f.key;
      ta.name = f.key;
      ta.rows = f.rows || 4;
      if (f.placeholder) ta.placeholder = f.placeholder;
      if (f.required) ta.required = true;
      // Mark long-form rich text fields for the Quill editor (see admin-richtext.js).
      if (f.richtext) ta.setAttribute('data-richtext', '1');
      wrap.appendChild(ta);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'select') {
      var sel = doc.createElement('select');
      sel.id = 'f-' + f.key;
      sel.name = f.key;
      if (f.required) sel.required = true;
      (f.options || []).forEach(function (opt) {
        var o = doc.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (f.default && opt === f.default) o.selected = true;
        if (f.value !== undefined && opt === f.value) o.selected = true;
        sel.appendChild(o);
      });
      if (f.placeholder) {
        var ghost = doc.createElement('option');
        ghost.value = '';
        ghost.textContent = f.placeholder;
        ghost.disabled = true;
        ghost.selected = !(f.default !== undefined || f.value !== undefined);
        sel.insertBefore(ghost, sel.firstChild);
      }
      wrap.appendChild(sel);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'select-multiple') {
      var sel = doc.createElement('select');
      sel.id = 'f-' + f.key;
      sel.name = f.key;
      sel.multiple = true;
      sel.size = Math.min(6, (f.options || []).length);
      if (f.required) sel.required = true;
      (f.options || []).forEach(function (opt) {
        var o = doc.createElement('option');
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });
      wrap.appendChild(sel);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'tags') {
      var ta = doc.createElement('textarea');
      ta.id = 'f-' + f.key;
      ta.name = f.key;
      ta.rows = 3;
      if (f.placeholder) ta.placeholder = f.placeholder;
      if (help) wrap.appendChild(help);
      wrap.appendChild(ta);
      return wrap;
    }

    if (type === 'date') {
      var input = doc.createElement('input');
      input.id = 'f-' + f.key;
      input.name = f.key;
      input.type = 'date';
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      wrap.appendChild(input);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'number') {
      var input = doc.createElement('input');
      input.id = 'f-' + f.key;
      input.name = f.key;
      input.type = 'number';
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      if (f.min !== undefined) input.min = f.min;
      wrap.appendChild(input);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'checkbox') {
      var cbWrap = doc.createElement('div');
      cbWrap.className = 'checkbox-field';
      var cb = doc.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'f-' + f.key;
      cb.name = f.key;
      if (f.default === true) cb.checked = true;
      cbWrap.appendChild(cb);
      var cbLabel = doc.createElement('label');
      cbLabel.setAttribute('for', 'f-' + f.key);
      cbLabel.textContent = f.label + (f.required ? ' *' : '');
      cbWrap.appendChild(cbLabel);
      if (help) cbWrap.appendChild(help);
      return cbWrap;
    }

    if (type === 'email') {
      var input = doc.createElement('input');
      input.id = 'f-' + f.key;
      input.name = f.key;
      input.type = 'email';
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      wrap.appendChild(input);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'reference') {
      var sel = doc.createElement('select');
      sel.id = 'f-' + f.key;
      sel.name = f.key;
      if (f.required) sel.required = true;
      sel.dataset.refModel = f.refModel || 'categories';
      sel.dataset.refLabel = f.refLabelField || 'name';
      sel.dataset.refValue = f.refValueField || '_id';
      sel.dataset.needsRef = '1';
      sel.className = 'form-select';
      if (f.placeholder) {
        var ghost = doc.createElement('option');
        ghost.value = '';
        ghost.textContent = f.placeholder;
        ghost.disabled = true;
        sel.appendChild(ghost);
      }
      wrap.appendChild(sel);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'textarea' || type === 'url') {
      var input = doc.createElement('textarea');
      input.id = 'f-' + f.key;
      input.name = f.key;
      input.rows = 3;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      wrap.appendChild(input);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    // text / email fallback
    var input = doc.createElement('input');
    input.id = 'f-' + f.key;
    input.name = f.key;
    input.type = type === 'email' ? 'email' : 'text';
    if (f.placeholder) input.placeholder = f.placeholder;
    if (f.required) input.required = true;
    wrap.appendChild(input);
    if (help) wrap.appendChild(help);
    return wrap;
  }

  function collectFormData(form) {
    var data = {};
    var elements = form.elements;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name || el.name === '') continue;
      if (el.type === 'submit' || el.type === 'button' || el.type === 'reset') continue;
      var value;
      if (el.type === 'select-multiple') {
        value = [];
        var opts = el.options;
        for (var j = 0; j < opts.length; j++) {
          if (opts[j].selected) value.push(opts[j].value);
        }
      } else if (el.type === 'checkbox') {
        value = el.checked;
      } else {
        value = el.value;
      }
      data[el.name] = value;
    }
    return data;
  }

  function normalizeFormData(raw, config) {
    var out = {};
    for (var key in raw) {
      var val = raw[key];
      var field = findField(config.fields, key);
      if (!field) {
        // Pass through unknown keys that look like valid scalars (e.g. category id
        // from a reference select). Do not copy objects/arrays here (handled below).
        if (typeof val === 'string' && val.trim()) out[key] = val.trim();
        continue;
      }
      if (field.type === 'tags') {
        out[key] = normalizeTags(val);
      } else if (field.type === 'select-multiple') {
        out[key] = Array.isArray(val) ? val : (val ? [val] : []);
      } else if (field.type === 'checkbox') {
        out[key] = !!val;
      } else if (field.type === 'number') {
        var n = Number(val);
        out[key] = Number.isFinite(n) && val !== '' ? n : '';
      } else if (field.type === 'date' && val && val !== '') {
        out[key] = val;
      } else if (typeof val === 'string') {
        out[key] = val.trim();
      } else {
        out[key] = val;
      }
    }

    // Embedded / reference-shaped fields built from flat inputs.

    // Media fields: flat featuredImageUrl / featuredImageAlt -> featuredImage object.
    if (!out.featuredImage && raw.featuredImageUrl && typeof raw.featuredImageUrl === 'string') {
      out.featuredImage = {
        url: raw.featuredImageUrl.trim(),
        alt: (raw.featuredImageAlt || '').trim(),
      };
    } else if (raw.featuredImage && typeof raw.featuredImage === 'object' && raw.featuredImage.url) {
      out.featuredImage = raw.featuredImage;
    }

    if (!out.coverImage && raw.coverImageUrl && typeof raw.coverImageUrl === 'string') {
      out.coverImage = {
        url: raw.coverImageUrl.trim(),
        alt: (raw.coverImageAlt || '').trim(),
      };
    } else if (raw.coverImage && typeof raw.coverImage === 'object' && raw.coverImage.url) {
      out.coverImage = raw.coverImage;
    }

    if (!out.profileImage && raw.profileImageUrl && typeof raw.profileImageUrl === 'string') {
      out.profileImage = {
        url: raw.profileImageUrl.trim(),
        alt: (raw.profileImageAlt || '').trim(),
      };
    } else if (raw.profileImage && typeof raw.profileImage === 'object' && raw.profileImage.url) {
      out.profileImage = raw.profileImage;
    }

    // Gallery: textarea of one URL per line -> array of { url }.
    if (!out.gallery && raw.galleryUrls && typeof raw.galleryUrls === 'string') {
      out.gallery = raw.galleryUrls.split(/\n+/).map(function (line) { return { url: line.trim() }; }).filter(function (g) { return g.url; });
    } else if (raw.gallery && Array.isArray(raw.gallery) && raw.gallery.length) {
      out.gallery = raw.gallery.filter(function (g) { return g && g.url; });
    }

    // Reference fields: category / parentCategory are sent as the referenced id
    // (ObjectId string) from the reference <select>. Pass them through as-is so the
    // backend can cast them to ObjectId.
    if (raw.category && typeof raw.category === 'string' && raw.category.trim()) {
      out.category = raw.category.trim();
    }
    if (raw.parentCategory && typeof raw.parentCategory === 'string' && raw.parentCategory.trim()) {
      out.parentCategory = raw.parentCategory.trim();
    }

    return out;
  }

  function findField(fields, key) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].key === key) return fields[i];
    }
    return null;
  }

  function normalizeTags(val) {
    if (!val) return [];
    var s = String(val).replace(/\s+/g, ' ');
    var parts = s.split(/[,\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
    return parts;
  }

  /** Prefill a rich text field from the document into the underlying textarea so
   * the editor (attached after the modal opens) can pick it up. */
  function prefillRichtextFields(form, config, doc) {
    config.fields.forEach(function (f) {
      if (f.type !== 'textarea' || !f.richtext) return;
      var el = form.elements['f-' + f.key];
      if (!el) return;
      var val = doc[f.key];
      if (typeof val === 'string' && val) {
        el.value = val;
      } else {
        el.value = '';
      }
    });
  }

  // ---------- reference selects ----------

  function populateReferenceSelects(form, doc) {
    var selects = form.querySelectorAll('select[data-needs-ref]');
    var promises = [];
    selects.forEach(function (sel) {
      var refModel = sel.dataset.refModel || 'categories';
      var refLabel = sel.dataset.refLabel || 'name';
      var refValue = sel.dataset.refValue || '_id';
      var key = sel.name;
      var promise = api.list(refModel).then(function (res) {
        var items = res && res.data ? res.data : [];
        // Remove existing dynamic options (keep the disabled placeholder if present).
        var opts = sel.options;
        for (var i = opts.length - 1; i >= 0; i--) {
          if (!(opts[i].disabled)) sel.remove(i);
        }
        items.forEach(function (item) {
          var opt = doc.createElement('option');
          opt.value = item[refValue] != null ? String(item[refValue]) : '';
          var label = item[refLabel] != null ? String(item[refLabel]) : String(item[refValue]);
          opt.textContent = label;
          sel.appendChild(opt);
        });
        // Preselect the current document value (edit).
        if (doc && doc[key]) {
          sel.value = doc[key];
        }
      }).catch(function () {
        // If the ref fetch fails, leave the select empty; the save will fail gracefully.
      });
      promises.push(promise);
    });
    return promises;
  }

  // ---------- modal ----------

  // NOTE: the second parameter is the record being edited (null when creating).
  // It used to be called `doc`, which shadowed the module-level `doc` (document)
  // and made doc.getElementById() throw "Cannot read properties of null" as soon
  // as "+ New …" was clicked, so no editor ever opened.
  function openModal(config, record, isNew, onSave, onCancel) {
    buildModal();
    var modal = doc.getElementById('admin-modal');
    if (!modal) return;
    var bs = window.bootstrap;
    var instance = bs ? bs.Modal.getOrCreateInstance(modal) : null;

    modalState.config = config;
    modalState.doc = record;
    modalState.isNew = isNew;
    modalState.saving = false;
    modalState.onSave = onSave || null;
    modalState.onCancel = onCancel || null;

    var titleEl = doc.getElementById('modal-title');
    var form = doc.getElementById('modal-form');
    var saveBtn = doc.getElementById('modal-save');
    var alertEl = doc.getElementById('modal-alert');

    if (titleEl) {
      titleEl.textContent = (isNew ? 'New ' : 'Edit ') + config.label;
    }
    if (alertEl) {
      alertEl.className = 'admin-alert admin-alert--error admin-hide';
      alertEl.textContent = '';
    }
    if (saveBtn) saveBtn.disabled = true;

    form.innerHTML = '';
    config.fields.forEach(function (f) {
      form.appendChild(fieldHtml(f));
    });

    if (record && !isNew) {
      prefillForm(form, config, record);
      prefillRichtextFields(form, config, record);
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      saveBtn.onclick = function (e) {
        e.preventDefault();
        saveFromModal(config, form, isNew);
      };
    }

    // Populate reference selects (async) then show the modal.
    var refPromises = populateReferenceSelects(form, record);
    if (refPromises.length) {
      Promise.all(refPromises).then(function () {
        if (instance) instance.show();
        // Reattach rich text editors after the DOM settled (the modal body was
        // rebuilt by openModal, so stale editors must be dropped first).
        if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
          global.ARAMIOT_ADMIN.richtext.destroyFor(form);
          global.ARAMIOT_ADMIN.richtext.attach();
        }
      }).catch(function () {
        if (instance) instance.show();
        if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
          global.ARAMIOT_ADMIN.richtext.destroyFor(form);
          global.ARAMIOT_ADMIN.richtext.attach();
        }
      });
    } else {
      if (instance) instance.show();
      if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
        global.ARAMIOT_ADMIN.richtext.destroyFor(form);
        global.ARAMIOT_ADMIN.richtext.attach();
      }
    }
  }

  function prefillForm(form, config, doc) {
    config.fields.forEach(function (f) {
      if (f.type === 'reference') return; // handled by populateReferenceSelects
      var el = form.elements['f-' + f.key];
      if (!el) return;
      var val = doc[f.key];
      if (f.type === 'checkbox') {
        if (el.checked !== undefined) el.checked = !!val;
        return;
      }
      if (f.type === 'select-multiple') {
        var opts = Array.isArray(val) ? val : [];
        for (var i = 0; i < el.options.length; i++) {
          el.options[i].selected = opts.indexOf(el.options[i].value) !== -1;
        }
        return;
      }
      if (f.type === 'tags') {
        if (Array.isArray(val)) el.value = val.join('\n');
        else el.value = '';
        return;
      }
      if (f.type === 'date') {
        if (val) {
          var d;
          try { d = new Date(val); } catch (e) {}
          if (d && !isNaN(d.getTime())) {
            var y = d.getUTCFullYear();
            var m = ('0' + (d.getUTCMonth() + 1)).slice(-2);
            var da = ('0' + d.getUTCDate()).slice(-2);
            el.value = y + '-' + m + '-' + da;
          } else {
            el.value = val.slice(0, 10);
          }
        } else {
          el.value = '';
        }
        return;
      }
      if (f.type === 'number') {
        el.value = val != null && val !== '' ? String(val) : '';
        return;
      }
      if (typeof val === 'string') {
        el.value = val;
      } else if (val != null) {
        el.value = String(val);
      } else {
        el.value = '';
      }
    });
  }

  function saveFromModal(config, form, isNew) {
    var alertEl = doc.getElementById('modal-alert');
    var saveBtn = doc.getElementById('modal-save');
    if (!saveBtn) return;
    if (modalState.saving) return;
    if (!api) return;

    // Sync any rich text editors back into their textareas before the form is
    // serialized (the editor root HTML is the source of truth; the textarea is
    // only a carrier for the rest of the form pipeline).
    if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
      global.ARAMIOT_ADMIN.richtext.syncAll();
    }

    var raw = collectFormData(form);
    var payload = normalizeFormData(raw, config);

    var missing = [];
    config.fields.forEach(function (f) {
      if (!f.required) return;
      if (f.type === 'reference') {
        var v = raw[f.key];
        if (!v || String(v).trim() === '') missing.push(f.label);
        return;
      }
      var v = payload[f.key];
      if (f.type === 'tags' || f.type === 'select-multiple') {
        if (!Array.isArray(v) || v.length === 0) missing.push(f.label);
        return;
      }
      if (!v || String(v).trim() === '') missing.push(f.label);
    });
    if (missing.length) {
      if (alertEl) {
        alertEl.className = 'admin-alert admin-alert--error admin-hide';
        alertEl.classList.remove('admin-hide');
        alertEl.textContent = 'Please fill in: ' + missing.join(', ');
      }
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    modalState.saving = true;
    if (alertEl) { alertEl.className = 'admin-alert admin-alert--error admin-hide'; alertEl.textContent = ''; }

    var promise;
    if (isNew) {
      promise = api.create(config.slug, payload);
    } else {
      var id = modalState.doc && modalState.doc._id;
      if (!id) {
        if (alertEl) { alertEl.className = 'admin-alert admin-alert--error admin-hide'; alertEl.classList.remove('admin-hide'); alertEl.textContent = 'Cannot save: missing id.'; }
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        modalState.saving = false;
        return;
      }
      promise = api.update(config.slug, id, payload);
    }

    promise
      .then(function (res) {
        modalState.saving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        if (alertEl) { alertEl.className = 'admin-alert admin-alert--error admin-hide'; alertEl.textContent = ''; }
        if (modalState.onSave) modalState.onSave(res);
        var modalEl = doc.getElementById('admin-modal');
        if (modalEl && window.bootstrap) {
          try { window.bootstrap.Modal.getInstance(modalEl).hide(); } catch (e) {}
        }
        if (window.ARAMIOT_ADMIN && window.ARAMIOT_ADMIN.content && window.ARAMIOT_ADMIN.content.currentPage) {
          window.ARAMIOT_ADMIN.content.currentPage.loadList();
        }
      })
      .catch(function (err) {
        modalState.saving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        var message = (err && err.message) || 'Save failed.';
        if (alertEl) {
          alertEl.className = 'admin-alert admin-alert--error admin-hide';
          alertEl.classList.remove('admin-hide');
          alertEl.textContent = message;
        }
      });
  }

  // ---------- item actions ----------

  function archiveItem(slug, id, opts) {
    if (!api) return;
    api.remove(slug, id)
      .then(function () {
        showAlert('Item archived.', 'success');
        if (opts && opts.config && opts.config.loadList) opts.config.loadList();
      })
      .catch(function (err) {
        showAlert((err && err.message) || 'Archive failed.', 'error');
      });
  }

  function deleteInboxItem(slug, id, opts) {
    if (!api) return;
    var deleter = {
      messages: api.remove,
      applications: api.remove,
      inquiries: api.remove,
    }[slug];
    if (!deleter) return;
    deleter(slug, id)
      .then(function () {
        showAlert('Item deleted.', 'success');
        if (opts && opts.config && opts.config.loadList) opts.config.loadList();
      })
      .catch(function (err) {
        showAlert((err && err.message) || 'Delete failed.', 'error');
      });
  }

  function showAlert(message, kind) {
    var alertEl = doc.getElementById('page-alert');
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.className = 'admin-alert admin-alert--' + (kind || 'error') + ' admin-hide';
    alertEl.classList.remove('admin-hide');
    setTimeout(function () {
      alertEl.classList.add('admin-hide');
    }, 6000);
  }

  function pageUrl(config, page, extraParams) {
    var params = Object.assign({ page: page }, (config.params || {}), extraParams || {});
    var q = new URLSearchParams();
    for (var key in params) {
      var v = params[key];
      if (v === undefined || v === null || v === '' || key === 'page' && v === 1) continue;
      q.append(key, String(v));
    }
    var qs = q.toString();
    return '/admin/' + config.slug + '.html' + (qs ? '?' + qs : '');
  }

  function parseListParams(config) {
    var params = {};
    var paramsEl = doc.getElementById('list-params');
    if (paramsEl) {
      try {
        var parsed = global.JSON.parse(paramsEl.textContent);
        Object.assign(params, parsed);
      } catch (e) {}
    }
    var qs = win.location.search.substring(1);
    if (qs) {
      var sp = new URLSearchParams(qs);
      sp.forEach(function (v, k) { params[k] = v; });
    }
    var allowed = ['page','limit','search','sort','status','section','scope','tag','category','publicationType','resourceType','areaOfInterest','isPublished'];
    var out = {};
    for (var k in params) {
      if (allowed.indexOf(k) === -1) continue;
      var v = params[k];
      if (v === undefined || v === null || v === '') continue;
      out[k] = v;
    }
    return out;
  }

  function wireNewButton(config) {
    var btn = doc.getElementById('new-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      openModal(config, null, true, function () {}, function () {});
    });
  }

  function wireEditFromUrl(config) {
    var params = win.location.search.substring(1);
    if (!params) return;
    var sp = new URLSearchParams(params);
    var id = sp.get('id');
    if (!id) return;
    ensureReady()
      .then(function () {
        return api.getById(config.slug, id);
      })
      .then(function (res) {
        if (!res || !res.data) {
          showAlert('Item not found.', 'error');
          return;
        }
        openModal(config, res.data, false, function () {}, function () {});
      })
      .catch(function (err) {
        showAlert((err && err.message) || 'Could not load item.', 'error');
      });
  }

  /**
   * Fetch one page of the current section and render it.
   *
   * init(), the pagination links and the reload after a save all call this, but
   * the function itself was missing: every content page threw
   * "loadListFor is not defined" on load and stayed on its "Loading …" state, so
   * no list, edit or publish action was reachable from the dashboard.
   */
  function loadListFor(page) {
    var config = page.config;
    var loading = doc.getElementById('list-loading');
    var container = doc.getElementById('list-container');
    if (!container) return;

    if (loading) loading.classList.remove('admin-hide');
    container.classList.add('admin-hide');

    var params = parseListParams(config);

    api
      .list(config.slug, params)
      .then(function (res) {
        var items = (res && res.data) || [];
        var meta = (res && res.meta) || null;

        if (loading) loading.classList.add('admin-hide');
        container.classList.remove('admin-hide');

        var count = doc.getElementById('list-count');
        if (count) {
          var total = meta && typeof meta.total === 'number' ? meta.total : items.length;
          count.textContent = total + ' total';
        }

        renderList({
          // archiveItem/deleteInboxItem reload the list through
          // opts.config.loadList, so hand them a config that carries it.
          config: Object.assign({}, config, {
            loadList: function () {
              loadListFor(page);
            },
          }),
          container: container,
          meta: meta,
          items: items,
          pageUrl: function (target) {
            return pageUrl(config, target);
          },
          reload: function () {
            loadListFor(page);
          },
        });
      })
      .catch(function (error) {
        if (loading) loading.classList.add('admin-hide');
        container.classList.remove('admin-hide');
        container.innerHTML = '';
        showAlert(
          (error && error.message) || 'Could not load ' + config.label + '. Please try again.',
          'error'
        );
      });
  }

  ARAMIOT.content = {
    init: function () {
      var config = SECTIONS[window.ARAMIOT_ADMIN_SECTION];
      if (!config) {
        showAlert('Unknown admin section.', 'error');
        return;
      }
      var page = {
        config: config,
        loadList: function () { loadListFor(page); },
      };
      window.ARAMIOT_ADMIN.content.currentPage = page;
      loadListFor(page);
    },
    wireNewButton: wireNewButton,
    wireEditFromUrl: wireEditFromUrl,
    loadList: function () {
      var page = window.ARAMIOT_ADMIN.content.currentPage;
      if (page) page.loadList();
    },
  };

  function boot() {
    if (window.ARAMIOT_ADMIN_SECTION) {
      ARAMIOT.content.init();
      wireNewButton(SECTIONS[window.ARAMIOT_ADMIN_SECTION]);
      wireEditFromUrl(SECTIONS[window.ARAMIOT_ADMIN_SECTION]);
    }
  }

  // This file is loaded with `defer`, so by the time it runs readyState is already
  // "interactive" and DOMContentLoaded is never awaited — without the else branch
  // the list was never fetched and every content page stayed on "Loading …".
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this);
