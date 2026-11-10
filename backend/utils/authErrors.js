'use strict';

const ApiError = require('./ApiError');

// Add an explicit UNAUTHORIZED factory. JsonWebToken and session failures map
// here rather than to a generic 400, so the admin UI can react appropriately.
ApiError.unauthorized = function unauthorized(message = 'Authentication is required') {
  return new ApiError(401, message, { code: 'UNAUTHORIZED' });
};

module.exports = ApiError;
