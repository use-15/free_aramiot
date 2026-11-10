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
