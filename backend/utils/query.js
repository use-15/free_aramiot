'use strict';

/**
 * Query-string helpers shared by every public listing endpoint.
 * Invalid paging/sort input is rejected (400) instead of being silently ignored,
 * and every list is bounded so a client cannot request the whole collection.
 */

const ApiError = require('./ApiError');

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 120;

function parseInteger(raw, { field, fallback, min, max }) {
  if (raw === undefined || raw === '') return fallback;

  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw ApiError.badRequest(`${field} must be a positive integer`);
  }

  const value = Number(text);
  if (value < min || value > max) {
    throw ApiError.badRequest(`${field} must be between ${min} and ${max}`);
  }
  return value;
}

/** @returns {{ page: number, limit: number, skip: number }} */
function parsePagination(query = {}) {
  const page = parseInteger(query.page, { field: 'page', fallback: 1, min: 1, max: 100000 });
  const limit = parseInteger(query.limit, { field: 'limit', fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT });
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Validate a sort expression such as "-publishedAt" against an allow-list.
 * Only allow-listed fields can reach MongoDB, which prevents sort injection.
 */
function parseSort(raw, allowed, fallback) {
  if (raw === undefined || raw === '') return fallback;

  const sort = String(raw).trim();
  if (!allowed.includes(sort)) {
    throw ApiError.badRequest(`sort must be one of: ${allowed.join(', ')}`);
  }
  return sort;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" search across whitelisted fields. */
function buildSearchFilter(search, fields) {
  const term = String(search ?? '').trim();
  if (!term) return null;

  if (term.length > MAX_SEARCH_LENGTH) {
    throw ApiError.badRequest(`search must be ${MAX_SEARCH_LENGTH} characters or fewer`);
  }

  const pattern = new RegExp(escapeRegExp(term), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

/** Read a single string query parameter, trimmed, or undefined. */
function readString(raw, maxLength = 200) {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.length > maxLength) {
    throw ApiError.badRequest(`Query value must be ${maxLength} characters or fewer`);
  }
  return value;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  parseSort,
  buildSearchFilter,
  escapeRegExp,
  readString,
};
