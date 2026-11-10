'use strict';

/**
 * Publication
 * Research reports and papers. The PDF/document itself lives outside MongoDB:
 * Phase 1 stores a `fileUrl` (plus an optional Drive `fileId`), the future admin
 * dashboard uploads to Google Drive through the Drive API.
 */

const mongoose = require('mongoose');
const { PUBLICATION_TYPES, MEDIA_PROVIDERS, DEFAULT_MEDIA_PROVIDER } = require('../config/constants');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const publicationSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 240, index: true },
    slug: slugField,
    abstract: { type: String, trim: true, maxlength: 1200, default: '' },
    authors: { type: [String], default: [] },
    publicationType: {
      type: String,
      enum: { values: PUBLICATION_TYPES, message: `Publication type must be one of: ${PUBLICATION_TYPES.join(', ')}` },
      default: 'report',
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    coverImage: { type: mediaSchema, default: undefined },
    // Google Drive file id (Phase 3) and a resolvable/preview URL.
    fileId: { type: String, trim: true, default: '' },
    fileUrl: { type: String, trim: true, default: '' },
    fileProvider: {
      type: String,
      enum: { values: MEDIA_PROVIDERS, message: `File provider must be one of: ${MEDIA_PROVIDERS.join(', ')}` },
      default: DEFAULT_MEDIA_PROVIDER,
    },
    publicationDate: { type: Date, default: null, index: true },
    ...seoFields,
    status: statusField,
  },
  baseSchemaOptions
);

publicationSchema.plugin(slugPlugin);

publicationSchema.index({ status: 1, publicationDate: -1 });
publicationSchema.index({ category: 1, status: 1, publicationDate: -1 });

module.exports = mongoose.model('Publication', publicationSchema);
