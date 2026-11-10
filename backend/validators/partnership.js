'use strict';

const { validatePayload } = require('../utils/validate');

/** POST /api/partnerships payload rules. */
const rules = {
  organizationName: { type: 'string', required: true, min: 2, max: 200, label: 'Organization name' },
  contactPerson: { type: 'string', required: true, min: 2, max: 140, label: 'Contact person' },
  email: { type: 'email', required: true, label: 'Email' },
  subject: { type: 'string', required: true, min: 3, max: 160, label: 'Subject' },
  message: { type: 'string', required: true, min: 10, max: 5000, label: 'Message' },
};

function validatePartnership(input) {
  return validatePayload(input, rules);
}

module.exports = { validatePartnership, rules };
