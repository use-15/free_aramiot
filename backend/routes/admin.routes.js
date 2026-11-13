'use strict';

/**
 * Protected administrative API, mounted at /api/admin.
 *
 * Every route here requires a valid Super Admin session (see middleware/adminAuth.js).
 * CSRF protection applies to every write; reads use the session cookie only.
 *
 * Two routers are composed:
 *   adminAuth.routes  -> /api/admin/auth/{csrf-token,login,logout,init,session}
 *   this router        -> everything else (/api/admin/dashboard, /api/admin/pages, …)
 *
 * The public website is unaffected: it talks to /api/*, never /api/admin/*.
 */

const express = require('express');
const Admin = require('../models/Admin');

const {
  requireAdmin,
  getAuthState,
} = require('../middleware/adminAuth');
const { csrfTokenFactory, csrfProtection, verifyPassword, hashPassword, mintSession, setSessionCookie } = require('../utils/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { safeDoc, safeDocs, adminUpdate, adminSort, applyPublishDate } = require('../services/contentHelpers');
const { MODEL_FIELDS } = require('../services/modelsToFields');
const config = require('../config/env');

const router = express.Router();

// ---- helpers ----------------------------------------------------------------

function model(name) {
  const map = {
    organization: require('../models/Organization'),
    pages: require('../models/Page'),
    articles: require('../models/Article'),
    categories: require('../models/Category'),
    projects: require('../models/Project'),
    programs: require('../models/Program'),
    team: require('../models/TeamMember'),
    publications: require('../models/Publication'),
    resources: require('../models/Resource'),
    impact: require('../models/ImpactStatistic'),
    contactMessages: require('../models/ContactMessage'),
    volunteerApplications: require('../models/VolunteerApplication'),
    partnershipInquiries: require('../models/PartnershipInquiry'),
  };
  const Model = map[name];
  if (!Model) throw new Error(`Unknown admin model "${name}"`);
  return Model;
}

/** Status allowed across content models. */
const CONTENT_STATUS = ['draft', 'published', 'archived'];

/** Inbox statuses per collection (read-only enum descriptions; Mongo handles the strict enum). */
const INBOX_STATUSES = {
  contactMessages: ['new', 'read', 'replied', 'archived'],
  volunteerApplications: ['new', 'reviewing', 'accepted', 'declined', 'archived'],
  partnershipInquiries: ['new', 'reviewing', 'responded', 'closed'],
};

/** Allowed sort fields per content type (admin can sort on any scalar field). */
const ADMIN_SORT = {
  organization: ['updatedAt', 'createdAt'],
  pages: ['-publishedAt', 'publishedAt', 'title', 'section', '-updatedAt', '-createdAt'],
  articles: ['-publishedAt', 'publishedAt', 'title', '-createdAt', '-updatedAt'],
  categories: ['name', '-createdAt', '-updatedAt'],
  projects: ['-startDate', 'startDate', 'title', '-publishedAt', '-createdAt', '-updatedAt'],
  programs: ['title', '-createdAt', '-updatedAt'],
  team: ['displayOrder', 'name', '-createdAt', '-updatedAt'],
  publications: ['-publicationDate', 'publicationDate', 'title', '-createdAt', '-updatedAt'],
  resources: ['title', '-createdAt', '-updatedAt'],
  impact: ['displayOrder', 'title', '-updatedAt', '-createdAt'],
  contactMessages: ['-createdAt', 'createdAt', 'status'],
  volunteerApplications: ['-createdAt', 'createdAt', 'status'],
  partnershipInquiries: ['-createdAt', 'createdAt', 'status'],
};

/** A small reusable listing for admin (no published-only filter, auth required). */
function adminList(Model, options = {}) {
  return asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10) || 20));
    const skip = (page - 1) * limit;

    const sortString = (req.query.sort || '').trim();
    const sort = adminSort(Model, sortString, options.defaultSort || '-createdAt');

    const filter = { ...(options.baseFilter || {}) };

    if (req.query.search) {
      const term = String(req.query.search).trim();
      if (term) {
        const fields = options.searchFields || ['_id'];
        const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = fields.map((f) => ({ [f]: pattern }));
      }
    }

    for (const [param, field] of Object.entries(options.filterFields || {})) {
      const raw = req.query[param];
      if (raw != null && String(raw).trim() !== '') {
        filter[field] = String(raw).trim().toLowerCase();
      }
    }

    if (req.query.status && CONTENT_STATUS.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.isPublished !== undefined) {
      filter.isPublished = req.query.isPublished === 'true';
    }
    if (req.query.category) {
      // category may be passed as a slug for content models that reference Category.
      const Cat = require('../models/Category');
      const parent = await Cat.findOne({ slug: String(req.query.category).trim().toLowerCase() }).select('_id').lean().exec();
      if (parent) filter.category = parent._id;
    }
    if (req.query.type) {
      filter[options.typeField || 'resourceType'] = String(req.query.type).trim().toLowerCase();
    }

    const [items, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      Model.countDocuments(filter).exec(),
    ]);

    res.json({
      success: true,
      data: safeDocs(items),
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        sort: sortString || null,
      },
    });
  });
}

/** Detail GET by id (admin sees all statuses). */
function adminDetailById(Model) {
  return asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw ApiError.badRequest('Resource id is required');
    const doc = await Model.findById(id).lean().exec();
    if (!doc) throw ApiError.notFound('Resource not found');
    res.json({ success: true, data: safeDoc(doc) });
  });
}

/** Detail GET by slug (admin sees all statuses). */
function adminDetailBySlug(Model, slugField = 'slug') {
  return asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw ApiError.badRequest('Resource slug is required');
    const doc = await Model.findOne({ [slugField]: slug }).lean().exec();
    if (!doc) throw ApiError.notFound('Resource not found');
    res.json({ success: true, data: safeDoc(doc) });
  });
}

/** Create one document (admin payload is untrusted; only allowed fields copied). */
function adminCreate(Model, options = {}) {
  return asyncHandler(async (req, res) => {
    const allowed = MODEL_FIELDS[options.modelName] || {};
    const update = adminUpdate(allowed, req.body);

    // Require at least a title/name/slug so the caller cannot post an empty doc.
    if (!update.title && !update.name && !update.slug && !update.submissionNotes) {
      throw ApiError.badRequest('A title, name, slug or submissionNotes is required');
    }

    // For content models, a slug is required; generate one from title if missing
    // (mirrors the public slugPlugin pre-validate hook where possible).
    if (!update.slug && update.title) {
      const { slugify } = require('../utils/slugify');
      update.slug = slugify(update.title);
    }

    applyPublishDate(Model, update);

    const doc = await Model.create(update);
    res.status(201).json({ success: true, message: 'Created', data: safeDoc(doc) });
  });
}

/** Update one document by id. */
function adminUpdateById(Model, options = {}) {
  return asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw ApiError.badRequest('Resource id is required');

    const allowed = MODEL_FIELDS[options.modelName] || {};
    const update = adminUpdate(allowed, req.body);

    if (Object.keys(update).length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    applyPublishDate(Model, update);

    const doc = await Model.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      fields: { passwordHash: 0 },
    }).lean().exec();

    if (!doc) throw ApiError.notFound('Resource not found');
    res.json({ success: true, message: 'Updated', data: safeDoc(doc) });
  });
}

/** Update one document by slug. */
function adminUpdateBySlug(Model, slugField = 'slug', options = {}) {
  return asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw ApiError.badRequest('Resource slug is required');

    const allowed = MODEL_FIELDS[options.modelName] || {};
    const update = adminUpdate(allowed, req.body);
    if (Object.keys(update).length === 0) throw ApiError.badRequest('No fields to update');

    applyPublishDate(Model, update);

    const doc = await Model.findOneAndUpdate({ [slugField]: slug }, update, {
      new: true,
      runValidators: true,
      fields: { passwordHash: 0 },
    }).lean().exec();

    if (!doc) throw ApiError.notFound('Resource not found');
    res.json({ success: true, message: 'Updated', data: safeDoc(doc) });
  });
}

/** Delete one document by id (soft status update for content, hard delete for inbox items as requested). */
function adminDeleteById(Model, options = {}) {
  return asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw ApiError.badRequest('Resource id is required');

    // Content models: archive instead of hard-delete (so the public site stops showing it,
    // but content is not lost). Inbox models: hard delete when the admin requests deletion.
    if (options.softDelete !== false) {
      const doc = await Model.findByIdAndUpdate(
        id,
        { $set: { status: 'archived' } },
        { new: true, runValidators: true, fields: { passwordHash: 0 } },
      ).lean().exec();
      if (!doc) throw ApiError.notFound('Resource not found');
      res.json({ success: true, message: 'Archived', data: safeDoc(doc) });
    } else {
      const doc = await Model.findByIdAndDelete(id).lean().exec();
      if (!doc) throw ApiError.notFound('Resource not found');
      res.json({ success: true, message: 'Deleted', data: { id: doc._id } });
    }
  });
}

// ---- CSRF: protect every write endpoint on this router --------------------

const csrf = csrfProtection();
const csrfMiddleware = csrf.doubleCsrfProtection;

// ---- dashboard -------------------------------------------------------------

router.get('/dashboard', requireAdmin, asyncHandler(async (req, res) => {
  const [
    articles,
    pages,
    projects,
    programs,
    publications,
    resources,
    team,
    unreadMessages,
    pendingApplications,
    pendingInquiries,
    impact,
  ] = await Promise.all([
    // Articles
    (async () => {
      const total = await require('../models/Article').countDocuments({ status: 'published' }).exec();
      const drafts = await require('../models/Article').countDocuments({ status: 'draft' }).exec();
      return { published: total, drafts };
    })(),
    // Pages
    (async () => {
      const total = await require('../models/Page').countDocuments({ status: 'published' }).exec();
      const drafts = await require('../models/Page').countDocuments({ status: 'draft' }).exec();
      return { published: total, drafts };
    })(),
    // Projects
    (async () => {
      const total = await require('../models/Project').countDocuments({ status: 'published' }).exec();
      const drafts = await require('../models/Project').countDocuments({ status: 'draft' }).exec();
      return { published: total, drafts };
    })(),
    // Programs
    (async () => {
      const total = await require('../models/Program').countDocuments({ status: 'published' }).exec();
      const drafts = await require('../models/Program').countDocuments({ status: 'draft' }).exec();
      return { published: total, drafts };
    })(),
    // Publications
    (async () => {
      const total = await require('../models/Publication').countDocuments({ status: 'published' }).exec();
      const drafts = await require('../models/Publication').countDocuments({ status: 'draft' }).exec();
      return { published: total, drafts };
    })(),
    // Resources
    (async () => {
      const total = await require('../models/Resource').countDocuments({ status: 'published' }).exec();
      const drafts = await require('../models/Resource').countDocuments({ status: 'draft' }).exec();
      return { published: total, drafts };
    })(),
    // Team
    (async () => {
      const total = await require('../models/TeamMember').countDocuments({ status: 'published' }).exec();
      const drafts = await require('../models/TeamMember').countDocuments({ status: 'draft' }).exec();
      return { published: total, drafts };
    })(),
    // Inbox: unread contact messages
    require('../models/ContactMessage').countDocuments({ status: { $in: ['new', 'read'] } }).exec(),
    // Inbox: pending applications/inquiries
    require('../models/VolunteerApplication').countDocuments({ status: { $in: ['new', 'reviewing'] } }).exec(),
    require('../models/PartnershipInquiry').countDocuments({ status: { $in: ['new', 'reviewing'] } }).exec(),
    // Impact published stats
    require('../models/ImpactStatistic').countDocuments({ isPublished: true }).exec(),
  ]);

  res.json({
    success: true,
    data: {
      summary: {
        publishedArticles: articles.published,
        draftArticles: articles.drafts,
        publishedPages: pages.published,
        draftPages: pages.drafts,
        publishedProjects: projects.published,
        draftProjects: projects.drafts,
        publishedPrograms: programs.published,
        draftPrograms: programs.drafts,
        publishedPublications: publications.published,
        draftPublications: publications.drafts,
        publishedResources: resources.published,
        draftResources: resources.drafts,
        publishedTeam: team.published,
        draftTeam: team.drafts,
        unreadMessages,
        pendingApplications,
        pendingInquiries,
        publishedImpactStats: impact,
      },
      lastLogin: req.admin.lastLogin
        ? new Date(req.admin.lastLogin).toISOString()
        : null,
      server: {
        environment: config.nodeEnv,
        version: require('../../package.json').version,
      },
    },
  });
}));

// ---- organization (the whole document; admin-only in-place updates) --------

router.get('/organization', requireAdmin, adminDetailById(require('../models/Organization')));

router.put(
  '/organization',
  requireAdmin,
  csrfMiddleware,
  adminUpdateById(require('../models/Organization'), { modelName: 'Organization' })
);

// ---- pages ----------------------------------------------------------------

router.get('/pages', requireAdmin, adminList(require('../models/Page'), {
  searchFields: ['title', 'excerpt'],
  filterFields: { section: 'section' },
  defaultSort: '-updatedAt',
}));

router.get('/pages/slug/:slug', requireAdmin, adminDetailBySlug(require('../models/Page')));
router.get('/pages/id/:id', requireAdmin, adminDetailById(require('../models/Page')));

router.post('/pages', requireAdmin, csrfMiddleware, adminCreate(require('../models/Page'), { modelName: 'Page' }));
router.put('/pages/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/Page'), { modelName: 'Page' }));
router.put('/pages/slug/:slug', requireAdmin, csrfMiddleware, adminUpdateBySlug(require('../models/Page'), 'slug', { modelName: 'Page' }));
router.delete('/pages/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/Page'), { softDelete: true }));

// ---- articles -------------------------------------------------------------

router.get('/articles', requireAdmin, adminList(require('../models/Article'), {
  searchFields: ['title', 'excerpt', 'tags'],
  filterFields: { tag: 'tags' },
  defaultSort: '-updatedAt',
}));

router.get('/articles/slug/:slug', requireAdmin, adminDetailBySlug(require('../models/Article')));
router.get('/articles/id/:id', requireAdmin, adminDetailById(require('../models/Article')));

router.post('/articles', requireAdmin, csrfMiddleware, adminCreate(require('../models/Article'), { modelName: 'Article' }));
router.put('/articles/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/Article'), { modelName: 'Article' }));
router.put('/articles/slug/:slug', requireAdmin, csrfMiddleware, adminUpdateBySlug(require('../models/Article'), 'slug', { modelName: 'Article' }));
router.delete('/articles/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/Article'), { softDelete: true }));

// ---- categories -----------------------------------------------------------

router.get('/categories', requireAdmin, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '20', 10) || 20));
  const skip = (page - 1) * limit;
  const sortString = (req.query.sort || '').trim();
  const sort = adminSort(require('../models/Category'), sortString, 'name');

  const filter = {};
  if (req.query.scope) filter.scopes = String(req.query.scope).trim().toLowerCase();
  if (req.query.parent) {
    const Cat = require('../models/Category');
    const p = await Cat.findOne({ slug: String(req.query.parent).trim().toLowerCase() }).select('_id').lean().exec();
    filter.parentCategory = p ? p._id : null;
  }
  if (req.query.search) {
    const term = String(req.query.search).trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { description: pattern }];
    }
  }

  const [items, total] = await Promise.all([
    require('../models/Category').find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
    require('../models/Category').countDocuments(filter).exec(),
  ]);

  res.json({
    success: true,
    data: safeDocs(items),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}));

router.get('/categories/id/:id', requireAdmin, adminDetailById(require('../models/Category')));

router.post('/categories', requireAdmin, csrfMiddleware, adminCreate(require('../models/Category'), { modelName: 'Category' }));
router.put('/categories/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/Category'), { modelName: 'Category' }));
router.delete('/categories/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/Category'), { softDelete: false }));

// ---- projects -------------------------------------------------------------

router.get('/projects', requireAdmin, adminList(require('../models/Project'), {
  searchFields: ['title', 'summary', 'location'],
  defaultSort: '-updatedAt',
}));

router.get('/projects/slug/:slug', requireAdmin, adminDetailBySlug(require('../models/Project')));
router.get('/projects/id/:id', requireAdmin, adminDetailById(require('../models/Project')));

router.post('/projects', requireAdmin, csrfMiddleware, adminCreate(require('../models/Project'), { modelName: 'Project' }));
router.put('/projects/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/Project'), { modelName: 'Project' }));
router.put('/projects/slug/:slug', requireAdmin, csrfMiddleware, adminUpdateBySlug(require('../models/Project'), 'slug', { modelName: 'Project' }));
router.delete('/projects/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/Project'), { softDelete: true }));

// ---- programs -------------------------------------------------------------

router.get('/programs', requireAdmin, adminList(require('../models/Program'), {
  searchFields: ['title', 'description', 'targetAudience'],
  defaultSort: '-updatedAt',
}));

router.get('/programs/slug/:slug', requireAdmin, adminDetailBySlug(require('../models/Program')));
router.get('/programs/id/:id', requireAdmin, adminDetailById(require('../models/Program')));

router.post('/programs', requireAdmin, csrfMiddleware, adminCreate(require('../models/Program'), { modelName: 'Program' }));
router.put('/programs/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/Program'), { modelName: 'Program' }));
router.put('/programs/slug/:slug', requireAdmin, csrfMiddleware, adminUpdateBySlug(require('../models/Program'), 'slug', { modelName: 'Program' }));
router.delete('/programs/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/Program'), { softDelete: true }));

// ---- publications ---------------------------------------------------------

router.get('/publications', requireAdmin, adminList(require('../models/Publication'), {
  searchFields: ['title', 'abstract', 'authors'],
  filterFields: { publicationType: 'publicationType' },
  defaultSort: '-updatedAt',
}));

router.get('/publications/slug/:slug', requireAdmin, adminDetailBySlug(require('../models/Publication')));
router.get('/publications/id/:id', requireAdmin, adminDetailById(require('../models/Publication')));

router.post('/publications', requireAdmin, csrfMiddleware, adminCreate(require('../models/Publication'), { modelName: 'Publication' }));
router.put('/publications/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/Publication'), { modelName: 'Publication' }));
router.put('/publications/slug/:slug', requireAdmin, csrfMiddleware, adminUpdateBySlug(require('../models/Publication'), 'slug', { modelName: 'Publication' }));
router.delete('/publications/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/Publication'), { softDelete: true }));

// ---- resources ------------------------------------------------------------

router.get('/resources', requireAdmin, adminList(require('../models/Resource'), {
  searchFields: ['title', 'description'],
  filterFields: { resourceType: 'resourceType' },
  defaultSort: '-updatedAt',
}));

router.get('/resources/slug/:slug', requireAdmin, adminDetailBySlug(require('../models/Resource')));
router.get('/resources/id/:id', requireAdmin, adminDetailById(require('../models/Resource')));

router.post('/resources', requireAdmin, csrfMiddleware, adminCreate(require('../models/Resource'), { modelName: 'Resource' }));
router.put('/resources/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/Resource'), { modelName: 'Resource' }));
router.put('/resources/slug/:slug', requireAdmin, csrfMiddleware, adminUpdateBySlug(require('../models/Resource'), 'slug', { modelName: 'Resource' }));
router.delete('/resources/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/Resource'), { softDelete: true }));

// ---- team ----------------------------------------------------------------

router.get('/team', requireAdmin, adminList(require('../models/TeamMember'), {
  searchFields: ['name', 'position', 'department'],
  defaultSort: 'displayOrder',
}));

router.get('/team/id/:id', requireAdmin, adminDetailById(require('../models/TeamMember')));

router.post('/team', requireAdmin, csrfMiddleware, adminCreate(require('../models/TeamMember'), { modelName: 'TeamMember' }));
router.put('/team/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/TeamMember'), { modelName: 'TeamMember' }));
router.delete('/team/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/TeamMember'), { softDelete: false }));

// ---- impact ---------------------------------------------------------------

router.get('/impact', requireAdmin, adminList(require('../models/ImpactStatistic'), {
  searchFields: ['title', 'description'],
  defaultSort: 'displayOrder',
}));

router.get('/impact/id/:id', requireAdmin, adminDetailById(require('../models/ImpactStatistic')));

router.post('/impact', requireAdmin, csrfMiddleware, adminCreate(require('../models/ImpactStatistic'), { modelName: 'ImpactStatistic' }));
router.put('/impact/:id', requireAdmin, csrfMiddleware, adminUpdateById(require('../models/ImpactStatistic'), { modelName: 'ImpactStatistic' }));
router.delete('/impact/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/ImpactStatistic'), { softDelete: false }));

// ---- inbox: messages ------------------------------------------------------

router.get('/messages', requireAdmin, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10) || 20));
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const term = String(req.query.search).trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }, { subject: pattern }, { message: pattern }];
    }
  }
  const [items, total] = await Promise.all([
    require('../models/ContactMessage').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
    require('../models/ContactMessage').countDocuments(filter).exec(),
  ]);
  res.json({ success: true, data: safeDocs(items), meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}));

// Update a contact message's status (e.g. new -> read).
router.put('/messages/:id', requireAdmin, csrfMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!id) throw ApiError.badRequest('Message id is required');
  const status = (req.body && req.body.status) || 'read';
  if (!['new', 'read', 'replied', 'archived'].includes(status)) {
    throw ApiError.badRequest('Valid status is required');
  }
  const doc = await require('../models/ContactMessage').findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true }).lean().exec();
  if (!doc) throw ApiError.notFound('Message not found');
  res.json({ success: true, message: 'Updated', data: safeDoc(doc) });
}));

router.delete('/messages/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/ContactMessage'), { softDelete: false }));

// ---- inbox: applications --------------------------------------------------

router.get('/applications', requireAdmin, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10) || 20));
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.areaOfInterest) filter.areaOfInterest = req.query.areaOfInterest;
  if (req.query.search) {
    const term = String(req.query.search).trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fullName: pattern }, { email: pattern }, { experience: pattern }, { motivation: pattern }];
    }
  }
  const [items, total] = await Promise.all([
    require('../models/VolunteerApplication').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
    require('../models/VolunteerApplication').countDocuments(filter).exec(),
  ]);
  res.json({ success: true, data: safeDocs(items), meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}));

router.put('/applications/:id', requireAdmin, csrfMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!id) throw ApiError.badRequest('Application id is required');
  const status = (req.body && req.body.status) || 'reviewing';
  if (!['new', 'reviewing', 'accepted', 'declined', 'archived'].includes(status)) {
    throw ApiError.badRequest('Valid status is required');
  }
  const doc = await require('../models/VolunteerApplication').findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true }).lean().exec();
  if (!doc) throw ApiError.notFound('Application not found');
  res.json({ success: true, message: 'Updated', data: safeDoc(doc) });
}));

router.delete('/applications/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/VolunteerApplication'), { softDelete: false }));

// ---- inbox: partnership inquiries -----------------------------------------

router.get('/inquiries', requireAdmin, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10) || 20));
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const term = String(req.query.search).trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ organizationName: pattern }, { contactPerson: pattern }, { email: pattern }, { subject: pattern }, { message: pattern }];
    }
  }
  const [items, total] = await Promise.all([
    require('../models/PartnershipInquiry').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
    require('../models/PartnershipInquiry').countDocuments(filter).exec(),
  ]);
  res.json({ success: true, data: safeDocs(items), meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}));

router.put('/inquiries/:id', requireAdmin, csrfMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!id) throw ApiError.badRequest('Inquiry id is required');
  const status = (req.body && req.body.status) || 'reviewing';
  if (!['new', 'reviewing', 'responded', 'closed'].includes(status)) {
    throw ApiError.badRequest('Valid status is required');
  }
  const doc = await require('../models/PartnershipInquiry').findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true }).lean().exec();
  if (!doc) throw ApiError.notFound('Inquiry not found');
  res.json({ success: true, message: 'Updated', data: safeDoc(doc) });
}));

router.delete('/inquiries/:id', requireAdmin, csrfMiddleware, adminDeleteById(require('../models/PartnershipInquiry'), { softDelete: false }));

// ---- website settings (protected subset of Organization fields) ------------

/**
 * Website settings is the part of the organization profile the Super Admin edits
 * most often: name, tagline, description, story, mission, vision, values, contact
 * details, social links, logo. The admin edit form uses this endpoint so a single
 * save updates the same document the public site reads.
 */
router.get('/website-settings', requireAdmin, adminDetailById(require('../models/Organization')));

router.put(
  '/website-settings',
  requireAdmin,
  csrfMiddleware,
  adminUpdateById(require('../models/Organization'), { modelName: 'Organization' })
);

// ---- account settings (admin's own profile + password change) --------------

router.get('/account', requireAdmin, asyncHandler(async (req, res) => {
  // Do not return passwordHash even though it is excluded by schema.select(false).
  const admin = await Admin.findById(req.adminId).select('-passwordHash').lean().exec();
  if (!admin) throw ApiError.notFound('Administrator account not found');
  res.json({ success: true, data: safeDoc(admin) });
}));

router.put(
  '/account',
  requireAdmin,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const allowedUpdates = {};
    if (body.email && typeof body.email === 'string' && body.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        throw ApiError.badRequest('A valid email address is required');
      }
      allowedUpdates.email = body.email.trim().toLowerCase();
    }
    if (body.isActive !== undefined) {
      allowedUpdates.isActive = !!body.isActive;
    }
    if (!allowedUpdates.email && allowedUpdates.isActive === undefined) {
      throw ApiError.badRequest('Nothing to update');
    }
    const admin = await Admin.findByIdAndUpdate(req.adminId, { $set: allowedUpdates }, { new: true, runValidators: true, fields: { passwordHash: 0 } }).lean().exec();
    if (!admin) throw ApiError.notFound('Administrator account not found');
    res.json({ success: true, message: 'Account updated', data: safeDoc(admin) });
  })
);

router.post(
  '/account/password',
  requireAdmin,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;

    if (!currentPassword || typeof currentPassword !== 'string') {
      throw ApiError.badRequest('The current password is required');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 12) {
      throw ApiError.badRequest('The new password must be at least 12 characters');
    }

    const admin = await Admin.findById(req.adminId).select('+passwordHash').exec();
    if (!admin) throw ApiError.notFound('Administrator account not found');
    if (!verifyPassword(currentPassword, admin.passwordHash)) {
      throw ApiError.unauthorized('The current password is incorrect');
    }

    admin.passwordHash = hashPassword(newPassword);
    admin.save().catch(() => {});

    // Rotate session so the new password takes effect on the current session's
    // effective lifetime (the old session still works, but a new login gets a fresh
    // token bound to the updated account state).
    const token = mintSession(admin);
    setSessionCookie(res, token);

    res.json({ success: true, message: 'Password changed' });
  })
);

// ---- media (Drive-ready placeholder; Phase 3 fills in the real Drive SDK) ----

router.post('/media/upload', requireAdmin, csrfMiddleware, asyncHandler(async (req, res) => {
  const { uploadToProvider } = require('../services/mediaService');
  const options = (req.body && typeof req.body === 'object') ? req.body : {};
  // The admin-api.js client sends the media opts as urlencoded form; normalize to
  // an object for the service. The service rejects unsupported providers with a
  // clear Phase-3 message.
  const normalized = {}
  if (options.provider != null) normalized.provider = options.provider;
  if (options.fileId != null) normalized.fileId = options.fileId;
  if (options.fileUrl != null) normalized.fileUrl = options.fileUrl;
  if (options.fileName != null) normalized.fileName = options.fileName;
  if (options.mimeType != null) normalized.mimeType = options.mimeType;
  try {
    const media = await uploadToProvider(normalized);
    return res.json({ success: true, data: media });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.notFound(error.message || 'Media upload is not implemented in this phase.');
  }
}));

// ---- health ----------------------------------------------------------------

router.get('/health', requireAdmin, asyncHandler(async (req, res) => {
  const database = req.app.get('mongooseReady') ? 'connected' : 'disconnected';
  res.json({
    success: true,
    data: {
      status: database === 'connected' ? 'ok' : 'degraded',
      authenticatedAs: req.admin.username,
      database,
      environment: config.nodeEnv,
      version: require('../../package.json').version,
    },
  });
}));

module.exports = router;
