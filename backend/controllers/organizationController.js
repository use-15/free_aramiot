'use strict';

/**
 * GET /api/organization
 * Public institutional profile. A single document, edited later by the Super Admin.
 */

const Organization = require('../models/Organization');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const getOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findOne().sort({ updatedAt: -1 }).exec();

  if (!organization) {
    throw ApiError.notFound('The organization profile has not been published yet');
  }

  res.json({ success: true, data: organization });
});

module.exports = { getOrganization };
