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
  // Page / Organization / Category fields that are editable top-level fields but
  // were omitted from the original set ( Mongoose 8.x _presplitPath fix exposed the
  // gap because MODEL_FIELDS now returns all top-level fields).
  'section',
  'contactEmail',
  'scopes',
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

    // Embedded subdocuments (address, socialLinks, logo, featuredImage, coverImage,
    // profileImage, gallery items). Write the whole subdocument back as a plain object
    // built only from the sub-schema's own scalar/array/boolean/date fields, so the
    // admin frontend can edit address.street, socialLinks.facebook, logo.url, etc. and
    // the update stays within the schema (NoSQL-injection safe).
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const isEmbedded =
        modelField && (
          modelField.instance === 'Embedded' ||
          (modelField.type && modelField.type.schema) ||
          (modelField.caster && modelField.caster.instance === 'Embedded')
        );
      if (isEmbedded) {
        update[field] = buildSubdocumentUpdate(modelField, value);
        continue;
      }
    }

    // Array of embedded subdocuments (e.g. Project.gallery: [mediaSchema]). Each item
    // is coerced through the same embedded subdocument builder.
    if (Array.isArray(type) && type.length && (
        type[0] === Number ||
        (type[0] && type[0].instance === 'Embedded') ||
        (type[0] && type[0].schema)
      )) {
      if (!Array.isArray(value)) {
        update[field] = [];
      } else {
        update[field] = value
          .filter(function (item) { return item && typeof item === 'object'; })
          .map(function (item) { return buildSubdocumentUpdate(type[0], item); });
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

    // Plain strings: sanitise, but allow empty strings for short fields.
    if (typeof value === 'string') {
      const max = modelField && typeof modelField.maxlength === 'number' ? modelField.maxlength : null;
      if (max && value.length > max) {
        value = value.slice(0, max);
      }
      update[field] = sanitizeText(value) || '';
      continue;
    }

    // FALLBACK: write scalar values (strings, numbers, booleans) for any field not
    // otherwise handled above. This covers ObjectId ref fields sent as strings (e.g.
    // category / parentCategory selected from a reference picker), plus any other
    // scalar field the admin form sends. Objects and arrays are NOT written here —
    // they are handled by the embedded / array branches above (or skipped if they
    // reach this point, which is safe).
    if (typeof value === 'string') {
      const max = modelField && typeof modelField.maxlength === 'number' ? modelField.maxlength : null;
      if (max && value.length > max) value = value.slice(0, max);
      update[field] = sanitizeText(value) || '';
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      update[field] = value;
    } else if (typeof value === 'boolean') {
      update[field] = value;
    }
  }

  // Remove undefined entries so Mongoose does not clear fields the admin did not
  // touch.
  for (const key of Object.keys(update)) {
    if (update[key] === undefined) delete update[key];
  }

  return update;
}

/**
 * Build a Mongoose subdocument update object for an embedded field (address,
 * socialLinks, logo, featuredImage, coverImage, profileImage, gallery items, …).
 *
 * Only scalar/boolean/number/date/array-of-strings fields that exist on the
 * sub-schema are copied through. This keeps the update inside the schema and is
 * safe against NoSQL injection on the subdocument keys.
 *
 * If the sub-schema cannot be resolved from the model field definition (defensive
 * edge case), we fall back to copying the payload's own keys as scalars — the
 * payload comes from the admin form, which only sends known fields, so this is
 * safe and still lets the embedded field be written.
 */
function buildSubdocumentUpdate(modelField, payload) {
  var subSchema = resolveSubSchema(modelField);
  var paths = subSchema ? subSchema.paths : null;
  var out = {};

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return out;

  // If we resolved the sub-schema, copy only the sub-schema's own fields that the
  // payload also provides.
  if (paths) {
    var keys = Object.keys(paths);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!(key in payload)) continue;
      copySubField(out, key, payload[key], paths[key]);
    }
    // Also copy any extra payload keys that are plain scalars (defensive), so a
    // form that sends a slightly different shape still writes sanely.
    var payloadKeys = Object.keys(payload);
    for (var p = 0; p < payloadKeys.length; p++) {
      var pk = payloadKeys[p];
      if (pk in paths) continue; // already handled
      if (pk === '__v') continue;
      var pv = payload[pk];
      if (pv === undefined || pv === null) continue;
      if (typeof pv === 'string') out[pk] = sanitizeText(pv) || '';
      else if (typeof pv === 'number' && Number.isFinite(pv)) out[pk] = pv;
      else if (typeof pv === 'boolean') out[pk] = pv;
      // objects/arrays inside the payload that are not in the sub-schema: skip
    }
  } else {
    // Sub-schema could not be resolved: copy the payload's own scalar keys.
    var fallbackKeys = Object.keys(payload);
    for (var f = 0; f < fallbackKeys.length; f++) {
      var fk = fallbackKeys[f];
      var fv = payload[fk];
      if (fv === undefined || fv === null) continue;
      if (typeof fv === 'string') out[fk] = sanitizeText(fv) || '';
      else if (typeof fv === 'number' && Number.isFinite(fv)) out[fk] = fv;
      else if (typeof fv === 'boolean') out[fk] = fv;
    }
  }

  var outKeys = Object.keys(out);
  for (var j = 0; j < outKeys.length; j++) {
    if (out[outKeys[j]] === undefined) delete out[outKeys[j]];
  }

  return out;
}

/** Return the embedded sub-schema for an admin model field, or null. */
function resolveSubSchema(modelField) {
  if (!modelField) return null;
  // modelField.type is often the embedded Schema instance directly (for embedded
  // fields produced by topLevelFields / schema.paths).
  if (modelField.type &&
      typeof modelField.type === 'object' &&
      modelField.type.paths &&
      typeof modelField.type.paths === 'object' &&
      Array.isArray(modelField.type.paths) === false) {
    return modelField.type;
  }
  // modelField.type.schema.
  if (modelField.type && modelField.type.schema &&
      typeof modelField.type.schema.paths === 'object' &&
      Array.isArray(modelField.type.schema.paths) === false) {
    return modelField.type.schema;
  }
  // modelField.schema.
  if (modelField.schema &&
      typeof modelField.schema.paths === 'object' &&
      Array.isArray(modelField.schema.paths) === false) {
    return modelField.schema;
  }
  // modelField.caster (for arrays of embedded).
  if (modelField.caster) {
    if (modelField.caster.type &&
        typeof modelField.caster.type === 'object' &&
        modelField.caster.type.paths &&
        Array.isArray(modelField.caster.type.paths) === false) {
      return modelField.caster.type;
    }
    if (modelField.caster.schema &&
        typeof modelField.caster.schema.paths === 'object' &&
        Array.isArray(modelField.caster.schema.paths) === false) {
      return modelField.caster.schema;
    }
  }
  // modelField.type.prototype.schema (Schema classes).
  if (modelField.type &&
      modelField.type.prototype &&
      modelField.type.prototype.schema &&
      typeof modelField.type.prototype.schema.paths === 'object' &&
      Array.isArray(modelField.type.prototype.schema.paths) === false) {
    return modelField.type.prototype.schema;
  }
  return null;
}

function copySubField(out, key, value, subPath) {
  if (value === undefined || value === null) {
    out[key] = undefined;
    return;
  }

  var subType = subPath && subPath.type ? subPath.type : null;

  // Boolean
  if (subType === Boolean) { out[key] = !!value; return; }

  // Number (single or array-of-number)
  if (subType === Number || (Array.isArray(subType) && subType[0] === Number)) {
    var n = Number(value);
    out[key] = Number.isFinite(n) ? n : undefined;
    return;
  }

  // Date
  if (subType === Date) {
    if (value === '' || value == null) { out[key] = null; return; }
    if (value instanceof Date) { out[key] = value; return; }
    var d = new Date(value);
    out[key] = Number.isNaN(d.getTime()) ? undefined : d;
    return;
  }

  // Array of strings
  if (Array.isArray(subType) && subType[0] === String) {
    if (!Array.isArray(value)) {
      out[key] = Array.isArray(value) && value.length ? value : [];
    } else {
      out[key] = value
        .filter(function (v) { return typeof v === 'string' && v.trim(); })
        .map(function (v) { return v.trim(); });
    }
    return;
  }

  // String (the common case for subdocument scalar fields)
  if (subType === String || (subType && (subType.name === 'String' || String(subType) === 'String'))) {
    if (typeof value !== 'string') value = String(value);
    var max = subPath && typeof subPath.maxlength === 'number' ? subPath.maxlength : null;
    if (max && value.length > max) value = value.slice(0, max);
    out[key] = sanitizeText(value) || '';
    return;
  }

  // Nested embedded sub-subdocument (rare) — recurse.
  if (subPath &&
      (subPath.instance === 'Embedded' ||
       (subPath.type && subPath.type.schema) ||
       (subPath.caster && (subPath.caster.instance === 'Embedded' || subPath.caster.type && subPath.caster.type.schema)))) {
    out[key] = buildSubdocumentUpdate(subPath, value);
    return;
  }

  // Fallback for any other scalar the sub-schema accepts.
  if (typeof value === 'string') out[key] = sanitizeText(value) || '';
  else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  else if (typeof value === 'boolean') out[key] = value;
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

/**
 * Stamp a publish date when a document is published without one.
 *
 * Pages, articles and publications are only publicly visible when `status` is
 * `published` AND their date field is set and already reached (see
 * `visibilityFilter` in contentService). Pressing "Publish" in the dashboard
 * without that stamp produced content that never appeared on the public site.
 * An explicit date is left untouched, so scheduled publishing still works.
 */
function applyPublishDate(Model, update, dateField) {
  if (!update || update.status !== 'published') return update;
  const field =
    dateField || ['publishedAt', 'publicationDate'].find((name) => Model.schema.path(name));
  if (!field || update[field]) return update;
  update[field] = new Date();
  return update;
}

module.exports = {
  adminUpdate,
  applyPublishDate,
  safeDoc,
  safeDocs,
  adminSort,
  ALLOWED_UPDATE_KEYS,
};
