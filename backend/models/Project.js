'use strict';

/**
 * Project
 * Time-bound work with objectives, activities, a location and a date range.
 * Rendered on the Our Work page and featured on the home page.
 */

const mongoose = require('mongoose');
const {
  baseSchemaOptions,
  slugField,
  statusField,
  mediaSchema,
  slugPlugin,
} = require('./sharedFields');

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200, index: true },
    slug: slugField,
    summary: { type: String, trim: true, maxlength: 400, default: '' },
    description: { type: String, default: '' },
    objectives: { type: [String], default: [] },
    activities: { type: [String], default: [] },
    location: { type: String, trim: true, maxlength: 160, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    status: statusField,
    featuredImage: { type: mediaSchema, default: undefined },
    gallery: { type: [mediaSchema], default: [] },
  },
  baseSchemaOptions
);

projectSchema.plugin(slugPlugin);

projectSchema.index({ status: 1, startDate: -1 });
projectSchema.index({ category: 1, status: 1 });

projectSchema.path('endDate').validate(function endAfterStart(value) {
  if (!value || !this.startDate) return true;
  return value >= this.startDate;
}, 'End date cannot be earlier than the start date');

module.exports = mongoose.model('Project', projectSchema);
