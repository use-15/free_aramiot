'use strict';

/**
 * Body validation middleware.
 * On success the sanitised, whitelisted payload is attached as req.validatedBody,
 * so controllers never read req.body directly.
 */

const ApiError = require('../utils/ApiError');

function validateBody(validator, message) {
  return function validate(req, res, next) {
    const { value, errors } = validator(req.body);

    if (errors.length > 0) {
      return next(ApiError.validation(errors, message));
    }

    req.validatedBody = value;
    return next();
  };
}

module.exports = validateBody;
