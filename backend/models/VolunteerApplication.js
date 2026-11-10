'use strict';

/**
 * VolunteerApplication
 * Created by POST /api/volunteers from the Get Involved page.
 * Confidential: no public read route exists for this collection.
 */

const mongoose = require('mongoose');
const { VOLUNTEER_STATUS, AREAS_OF_INTEREST } = require('../config/constants');
const { submissionSchemaOptions } = require('./sharedFields');

const volunteerApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 140 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 200,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address'],
    },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    areaOfInterest: {
      type: String,
      required: [true, 'Area of interest is required'],
      enum: { values: AREAS_OF_INTEREST, message: `Area of interest must be one of: ${AREAS_OF_INTEREST.join(', ')}` },
    },
    experience: { type: String, trim: true, maxlength: 2000, default: '' },
    motivation: { type: String, required: [true, 'Motivation is required'], trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: { values: VOLUNTEER_STATUS, message: `Status must be one of: ${VOLUNTEER_STATUS.join(', ')}` },
      default: 'new',
      index: true,
    },
  },
  submissionSchemaOptions
);

volunteerApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VolunteerApplication', volunteerApplicationSchema);
