'use strict';

/**
 * Article
 * News posts and articles shown on the home page, the Health / Education /
 * Advocacy pages and the resources listing.
 */

const mongoose = require('mongoose');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  seoFields,
  slugPlugin,
} = require('./sharedFields');

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200, index: true },
    slug: slugField,
    excerpt: { type: String, trim: true, maxlength: 400, default: '' },
    content: { type: String, default: '' },
    featuredImage: { type: mediaSchema, default: undefined },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    tags: { type: [String], default: [], index: true },
    author: { type: String, trim: true, maxlength: 120, default: 'ARAMIOT' },
    ...seoFields,
    status: statusField,
    publishedAt: { type: Date, default: null, index: true },
  },
  baseSchemaOptions
);

articleSchema.plugin(slugPlugin);

// Listing queries: published articles, optionally filtered by category, newest first.
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ category: 1, status: 1, publishedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
