'use strict';

/**
 * TeamMember
 * Public team profiles, ordered on the About page by displayOrder.
 */

const mongoose = require('mongoose');
const { baseSchemaOptions, statusField, mediaSchema } = require('./sharedFields');

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 140, index: true },
    position: { type: String, required: [true, 'Position is required'], trim: true, maxlength: 140 },
    biography: { type: String, trim: true, default: '' },
    profileImage: { type: mediaSchema, default: undefined },
    department: { type: String, trim: true, maxlength: 120, default: '' },
    displayOrder: { type: Number, default: 0, min: 0 },
    status: statusField,
  },
  baseSchemaOptions
);

teamMemberSchema.index({ status: 1, displayOrder: 1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
