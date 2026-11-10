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
