'use strict';

/**
 * Resource
 * Learning materials, guidelines and toolkits. A resource points at either an
 * uploaded document (fileUrl / Drive fileId) or an external link.
 */

const mongoose = require('mongoose');
const { RESOURCE_TYPES, MEDIA_PROVIDERS, DEFAULT_MEDIA_PROVIDER } = require('../config/constants');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 240, index: true },
    slug: slugField,
    description: { type: String, trim: true, default: '' },
    resourceType: {
      type: String,
      enum: { values: RESOURCE_TYPES, message: `Resource type must be one of: ${RESOURCE_TYPES.join(', ')}` },
      default: 'learning-material',
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    coverImage: { type: mediaSchema, default: undefined },
    fileId: { type: String, trim: true, default: '' },
    fileUrl: { type: String, trim: true, default: '' },
    fileProvider: {
      type: String,
      enum: { values: MEDIA_PROVIDERS, message: `File provider must be one of: ${MEDIA_PROVIDERS.join(', ')}` },
      default: DEFAULT_MEDIA_PROVIDER,
    },
    externalUrl: { type: String, trim: true, default: '' },
    ...seoFields,
    status: statusField,
  },
  baseSchemaOptions
);

resourceSchema.plugin(slugPlugin);

resourceSchema.index({ status: 1, title: 1 });
resourceSchema.index({ category: 1, status: 1 });
resourceSchema.index({ resourceType: 1, status: 1 });

module.exports = mongoose.model('Resource', resourceSchema);
