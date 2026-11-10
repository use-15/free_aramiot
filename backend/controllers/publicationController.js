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
