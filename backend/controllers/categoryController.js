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
