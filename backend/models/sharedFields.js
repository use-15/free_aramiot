'use strict';

/**
 * Reusable schema fragments.
 *
 * Every model shares slug, status, media and SEO definitions so the editorial
 * rules (and the future Super Admin UI) behave identically across content types.
 */

const mongoose = require('mongoose');
const {
  CONTENT_STATUS,
  CONTENT_STATUS_VALUES,
  MEDIA_PROVIDERS,
  DEFAULT_MEDIA_PROVIDER,
} = require('../config/constants');
const { slugify } = require('../utils/slugify');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Unique, lowercase, hyphenated public identifier used in URLs. */
const slugField = {
  type: String,
  required: [true, 'Slug is required'],
  unique: true,
  trim: true,
  lowercase: true,
  match: [SLUG_PATTERN, 'Slug may only contain lowercase letters, numbers and single hyphens'],
};

/** Editorial lifecycle: draft -> published -> archived. */
const statusField = {
  type: String,
  enum: {
    values: CONTENT_STATUS_VALUES,
    message: `Status must be one of: ${CONTENT_STATUS_VALUES.join(', ')}`,
  },
  default: CONTENT_STATUS.DRAFT,
  index: true,
};

/**
 * Image or file reference.
 * fileId/provider are placeholders for the future Google Drive integration:
 * Phase 1 stores a local or remote URL, Phase 3 can store a Drive file id.
 */
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: [true, 'Media URL is required'], trim: true },
    alt: { type: String, trim: true, maxlength: 200, default: '' },
    fileId: { type: String, trim: true, default: '' },
    provider: {
      type: String,
      enum: { values: MEDIA_PROVIDERS, message: `Provider must be one of: ${MEDIA_PROVIDERS.join(', ')}` },
      default: DEFAULT_MEDIA_PROVIDER,
    },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  { _id: false }
);

/** Search engine metadata, editable per document by the future Super Admin. */
const seoFields = {
  seoTitle: { type: String, trim: true, maxlength: 70 },
  seoDescription: { type: String, trim: true, maxlength: 160 },
};

/** Standard schema options: timestamps, no __v in the public JSON, virtual `id`. */
const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

/** Submission-only models need a creation date but are never edited, so no updatedAt. */
const submissionSchemaOptions = {
  ...baseSchemaOptions,
  timestamps: { createdAt: true, updatedAt: false },
};

/** Derive a slug from the title when the caller did not supply one. */
function slugPlugin(schema) {
  schema.pre('validate', function generateSlug(next) {
    if (!this.slug && this.title) {
      this.slug = slugify(this.title);
    }
    next();
  });
}

module.exports = {
  SLUG_PATTERN,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  baseSchemaOptions,
  submissionSchemaOptions,
  slugPlugin,
};
