'use strict';

const { validatePayload } = require('../utils/validate');

/** POST /api/contact payload rules. */
const rules = {
  name: { type: 'string', required: true, min: 2, max: 140, label: 'Name' },
  email: { type: 'email', required: true, label: 'Email' },
  subject: { type: 'string', required: true, min: 3, max: 160, label: 'Subject' },
  message: { type: 'string', required: true, min: 10, max: 5000, label: 'Message' },
};

function validateContact(input) {
  return validatePayload(input, rules);
}

module.exports = { validateContact, rules };
