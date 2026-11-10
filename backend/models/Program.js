'use strict';

/**
 * Program
 * An ongoing service or programme (as opposed to a time-bound project).
 */

const mongoose = require('mongoose');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  slugPlugin,
} = require('./sharedFields');

const programSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200, index: true },
    slug: slugField,
    description: { type: String, default: '' },
    objectives: { type: [String], default: [] },
    activities: { type: [String], default: [] },
    targetAudience: { type: String, trim: true, maxlength: 220, default: '' },
    location: { type: String, trim: true, maxlength: 160, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    status: statusField,
    featuredImage: { type: mediaSchema, default: undefined },
  },
  baseSchemaOptions
);

programSchema.plugin(slugPlugin);

programSchema.index({ status: 1, title: 1 });
programSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Program', programSchema);
