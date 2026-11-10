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
