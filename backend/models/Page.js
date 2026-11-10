'use strict';

/**
 * Page
 * Editable content for the general website pages (Overview, About, Health,
 * Education, Advocacy, Get Involved, Contact ...). The frontend renders the
 * `content` supplied by the API instead of hardcoding copy in HTML.
 */

const mongoose = require('mongoose');
const { PAGE_SECTIONS } = require('../config/constants');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 160, index: true },
    slug: slugField,
    section: {
      type: String,
      required: [true, 'Section is required'],
      enum: { values: PAGE_SECTIONS, message: `Section must be one of: ${PAGE_SECTIONS.join(', ')}` },
      index: true,
    },
    content: { type: String, default: '' },
    excerpt: { type: String, trim: true, maxlength: 320, default: '' },
    featuredImage: { type: mediaSchema, default: undefined },
    ...seoFields,
    status: statusField,
    publishedAt: { type: Date, default: null, index: true },
  },
  baseSchemaOptions
);

pageSchema.plugin(slugPlugin);

// Fast lookup of the published pages that belong to one section of the site.
pageSchema.index({ section: 1, status: 1 });
pageSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Page', pageSchema);
