'use strict';

/**
 * Operational error with an HTTP status code.
 * The error handler translates these into the API's consistent JSON error shape,
 * so controllers can `throw` instead of building responses by hand.
 */

const STATUS_CODES = {
  400: 'BAD_REQUEST',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || STATUS_CODES[statusCode] || 'ERROR';
    this.details = options.details;
    this.isOperational = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }

  /** Field-level validation failure. `details` is [{ field, message }]. */
  static validation(details, message = 'The submitted data is invalid') {
    return new ApiError(400, message, { code: 'VALIDATION_ERROR', details });
  }

  static forbidden(message = 'This request is not allowed') {
    return new ApiError(403, message);
  }

  static notFound(message = 'The requested resource was not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'The request conflicts with existing data') {
    return new ApiError(409, message);
  }

  /** Used by admin auth middleware when a session is missing or invalid. */
  static unauthorized(message = 'Authentication is required') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }
}

module.exports = ApiError;
