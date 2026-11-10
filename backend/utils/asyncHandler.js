'use strict';

/**
 * Wrap an async route handler so rejected promises reach Express' error handler.
 * Without this, an await that throws inside a handler hangs the request.
 */

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
