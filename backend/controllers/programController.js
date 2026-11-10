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
