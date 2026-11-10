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
