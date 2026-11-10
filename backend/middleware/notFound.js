'use strict';

/**
 * 404 handling.
 * API paths always receive JSON; website paths receive the static 404 page so a
 * mistyped URL still looks like part of the site.
 */

const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

/** Any unmatched /api/* request. */
function apiNotFound(req, res, next) {
  next(new ApiError(404, `Unknown API endpoint: ${req.method} ${req.originalUrl}`));
}

/** Any other unmatched request. */
function notFound(req, res, next) {
  const acceptsHtml = req.accepts(['html', 'json']) === 'html';
  const notFoundPage = path.join(__dirname, '..', '..', 'frontend', '404.html');

  if (config.serveFrontend && acceptsHtml && fs.existsSync(notFoundPage)) {
    return res.status(404).sendFile(notFoundPage);
  }

  return apiNotFound(req, res, next);
}

module.exports = { notFound, apiNotFound };
