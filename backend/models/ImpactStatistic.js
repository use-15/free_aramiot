'use strict';

/**
 * ImpactStatistic
 * The counters shown in the "Our Impact" section.
 *
 * IMPORTANT: values are entered by the organization only. Sample seed entries use
 * value 0 and a description that says the figure is not yet verified. Never invent
 * impact numbers for this collection.
 */

const mongoose = require('mongoose');
const { baseSchemaOptions } = require('./sharedFields');

const impactStatisticSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    value: {
      type: Number,
      required: [true, 'Value is required'],
      min: [0, 'Impact values cannot be negative'],
    },
    unit: { type: String, trim: true, maxlength: 40, default: '' },
    description: { type: String, trim: true, maxlength: 240, default: '' },
    displayOrder: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: false, index: true },
  },
  baseSchemaOptions
);

impactStatisticSchema.index({ isPublished: 1, displayOrder: 1 });

module.exports = mongoose.model('ImpactStatistic', impactStatisticSchema);
