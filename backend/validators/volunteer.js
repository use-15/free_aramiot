'use strict';

const { validatePayload } = require('../utils/validate');
const { AREAS_OF_INTEREST } = require('../config/constants');

/** POST /api/volunteers payload rules. */
const rules = {
  fullName: { type: 'string', required: true, min: 2, max: 140, label: 'Full name' },
  email: { type: 'email', required: true, label: 'Email' },
  phone: { type: 'phone', required: false, label: 'Phone' },
  areaOfInterest: { type: 'enum', required: true, values: AREAS_OF_INTEREST, label: 'Area of interest' },
  experience: { type: 'string', required: false, max: 2000, label: 'Experience' },
  motivation: { type: 'string', required: true, min: 10, max: 2000, label: 'Motivation' },
};

function validateVolunteer(input) {
  return validatePayload(input, rules);
}

module.exports = { validateVolunteer, rules };
