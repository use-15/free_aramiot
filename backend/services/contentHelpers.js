'use strict';

/**
 * Admin-side helpers for managing Phase 1 content models.
 *
 * These re-use the same Mongoose models and Mongoose helpers that the public API
 * uses (sharedFields, slugPlugin, schema validation), so the admin dashboard
 * edits the identical database records the public site reads. Only the visibility
 * rule differs: the public API enforces published-only reads, the admin API
 * enforces authentication + authorisation and reads/writes all documents,
 * including drafts.
 *
 * To avoid duplicating controllers, each admin route calls the generic helpers
 * below with the right Model + options. This is the admin analogue of
 * contentService.buildListHandler / buildDetailHandler, but without any
 * published-only filter and with full create/update/delete support.
 */

const { MODEL_FIELDS } = require('./modelsToFields');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sanitizeText } = require('../utils/validate');

// Fields that every content admin endpoint is allowed to read/write on its model.
// Anything not in this allow-list cannot be injected into an update by the
// admin frontend (NoSQL injection mitigation — the admin payload is not trusted
// to choose arbitrary document keys).
const ALLOWED_UPDATE_KEYS = new Set([
  'title',
  'slug',
  'excerpt',
  'content',
  'summary',
  'description',
  'abstract',
  'body',
  'author',
  'publishDate',
  'publishedAt',
  'publicationDate',
  'status',
  'published',
  'isPublished',
  'category',
  'parentCategory',
  'tags',
  'featuredImage',
  'coverImage',
  'profileImage',
  'logo',
  'gallery',
  'fileId',
  'fileUrl',
  'fileProvider',
  'externalUrl',
  'publicationType',
  'resourceType',
  'position',
  'displayOrder',
  'biography',
  'department',
  'startDate',
  'endDate',
  'targetAudience',
  'location',
  'objectives',
  'activities',
  'name',
  'submissionNotes',
]);

/**
 * Build a Mongoose update object from an untrusted admin payload.
 *
 * - Only known model fields are copied through (MODEL_FIELDS whitelist per model).
 * - Plain-text fields are sanitised (control chars / tag-like sequences removed);
 *   HTML authored in a future rich-text editor should be sanitised at input time
 *   (Phase 2 doc note; enforcement deferred to Phase 2).
 * - Date fields are coerced to Date; empty values clear the field.
 * - Unknown keys are discarded, not passed to Mongoose.
 */
function adminUpdate(allowed, payload) {
  const update = {};
  const now = new Date();

  for (const field of Object.keys(allowed)) {
    if (!ALLOWED_UPDATE_KEYS.has(field)) continue;

    let value = payload[field];
    if (value === undefined || value === null) {
      update[field] = undefined;
      continue;
    }

    const modelField = allowed[field];
    const type = modelField && modelField.type ? modelField.type : null;

    // Boolean-ish fields.
    if (type === Boolean) {
      update[field] = !!value;
      continue;
    }

    // Numeric fields.
    if (type === Number || (Array.isArray(type) && type[0] === Number)) {
      const n = Number(value);
      update[field] = Number.isFinite(n) ? n : undefined;
      continue;
    }

    // ObjectId refs (single).
    if (type === String && modelField.ref) {
      if (typeof value !== 'string' || value.trim() === '') {
        update[field] = null;
      } else {
        update[field] = value.trim();
      }
      continue;
    }

    // Array of strings.
    if (Array.isArray(type) && type[0] === String) {
      if (!Array.isArray(value)) {
        update[field] = Array.isArray(value) && value.length ? value : [];
      } else {
        update[field] = value
          .filter((v) => typeof v === 'string' && v.trim())
          .map((v) => v.trim());
      }
      continue;
    }

    // Date fields: accept ISO string, Date, or empty to clear.
    if (type === Date) {
      if (value === '' || value == null) {
        update[field] = null;
      } else if (value instanceof Date) {
        update[field] = value;
      } else {
        const d = new Date(value);
        update[field] = Number.isNaN(d.getTime()) ? undefined : d;
      }
      continue;
    }

    // Plain strings: sanitise, but allow empty strings for short fields.
    if (typeof value === 'string') {
      const max = modelField && typeof modelField.maxlength === 'number' ? modelField.maxlength : null;
      if (max && value.length > max) {
        value = value.slice(0, max);
      }
      update[field] = sanitizeText(value) || '';
      continue;
    }

    // FALLBACK: write through only for well-known rich-text / config fields.
    const known = ['content', 'description', 'story', 'mission', 'vision', 'summary'];
    if (known.includes(field) && typeof value === 'string') {
      update[field] = sanitizeText(value);
    }
  }

  // Remove undefined entries so Mongoose does not clear fields the admin did not
  // touch.
  for (const key of Object.keys(update)) {
    if (update[key] === undefined) delete update[key];
  }

  return update;
}

/** Extract only document fields that are safe to return (no passwords, no system fields). */
function safeDoc(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc.toJSON ? doc.toJSON() : Object.assign({}, doc);
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}

function safeDocs(docs) {
  return (docs || []).map(safeDoc);
}

/**
 * Return the Mongoose sort object for a content type, given an admin-friendly
 * sort string such as "-publishedAt" / "title" / "displayOrder".
 */
function adminSort(model, sortString, defaultSort) {
  if (!sortString) return defaultSort ? { [defaultSort]: 1 } : {};
  const dir = sortString.startsWith('-') ? -1 : 1;
  const field = sortString.startsWith('-') ? sortString.slice(1) : sortString;
  // Only allow sort on scalar model fields (no nested / populated paths).
  if (!model.schema.paths[field]) return {};
  return { [field]: dir };
}

module.exports = {
  adminUpdate,
  safeDoc,
  safeDocs,
  adminSort,
  ALLOWED_UPDATE_KEYS,
};
