'use strict';

/**
 * GET /api/impact
 * Only statistics the organization has explicitly published are returned.
 * Figures are never generated, estimated or inferred by the application.
 */

const ImpactStatistic = require('../models/ImpactStatistic');
const { buildListHandler } = require('../services/contentService');

const list = buildListHandler(ImpactStatistic, {
  label: 'impact statistics',
  dateField: null,
  baseFilter: { isPublished: true },
  searchFields: ['title', 'description'],
  sortable: ['displayOrder', 'title', '-updatedAt'],
  defaultSort: 'displayOrder',
  populate: null,
});

module.exports = { list };
