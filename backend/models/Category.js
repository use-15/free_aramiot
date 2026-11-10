'use strict';

/**
 * Category
 * One taxonomy collection shared by articles, projects, programs, publications
 * and resources. `scopes` records which content types a category classifies
 * (a "Health" category can serve articles *and* projects), and `parentCategory`
 * allows a light two-level hierarchy such as Health > Mental Health.
 */

const mongoose = require('mongoose');
const { CATEGORY_SCOPES } = require('../config/constants');
const { baseSchemaOptions, slugField, slugPlugin } = require('./sharedFields');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true, maxlength: 120, index: true },
    slug: slugField,
    description: { type: String, trim: true, maxlength: 320, default: '' },
    scopes: {
      type: [{ type: String, enum: { values: CATEGORY_SCOPES, message: `Invalid category scope: {VALUE}` } }],
      default: ['general'],
      index: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
  },
  baseSchemaOptions
);

categorySchema.plugin(slugPlugin);

categorySchema.path('scopes').validate(function atLeastOneScope(value) {
  return Array.isArray(value) && value.length > 0;
}, 'A category needs at least one scope');

module.exports = mongoose.model('Category', categorySchema);
