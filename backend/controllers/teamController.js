'use strict';

/**
 * Team profiles: GET /api/team (list only, ordered for display).
 */

const TeamMember = require('../models/TeamMember');
const { buildListHandler } = require('../services/contentService');

const list = buildListHandler(TeamMember, {
  label: 'team members',
  dateField: null,
  searchFields: ['name', 'position', 'department'],
  sortable: ['displayOrder', 'name', '-createdAt'],
  defaultSort: 'displayOrder',
  populate: null,
});

module.exports = { list };
