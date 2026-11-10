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
