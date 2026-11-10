'use strict';

/**
 * Terminal error handler.
 * Converts every error (ours, Mongoose', Express') into one JSON shape:
 *   { success: false, error: { code, message, details? } }
 */

const ApiError = require('../utils/ApiError');
const config = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred. Please try again later.';
  let details;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError' && error.errors) {
    // Mongoose schema validation (e.g. a bad enum reaching the database layer).
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'The submitted data is invalid';
    details = Object.entries(error.errors).map(([field, issue]) => ({
      field,
      message: issue.message,
    }));
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid value for "${error.path}"`;
  } else if (error.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists`;
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body must be valid JSON';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    code = error.code || 'ERROR';
    message = error.message || message;
  }

  if (statusCode >= 500) {
    console.error(`[api] ${req.method} ${req.originalUrl} -> ${statusCode}`, error);
  } else if (!config.isProduction) {
    console.warn(`[api] ${req.method} ${req.originalUrl} -> ${statusCode} (${code}): ${message}`);
  }

  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
