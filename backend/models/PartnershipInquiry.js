'use strict';

/**
 * PartnershipInquiry
 * Created by POST /api/partnerships for organizations that want to collaborate.
 * Confidential: no public read route exists for this collection.
 */

const mongoose = require('mongoose');
const { PARTNERSHIP_STATUS } = require('../config/constants');
const { submissionSchemaOptions } = require('./sharedFields');

const partnershipInquirySchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: 200,
    },
    contactPerson: { type: String, required: [true, 'Contact person is required'], trim: true, maxlength: 140 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 200,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address'],
    },
    subject: { type: String, required: [true, 'Subject is required'], trim: true, maxlength: 160 },
    message: { type: String, required: [true, 'Message is required'], trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: { values: PARTNERSHIP_STATUS, message: `Status must be one of: ${PARTNERSHIP_STATUS.join(', ')}` },
      default: 'new',
      index: true,
    },
  },
  submissionSchemaOptions
);

partnershipInquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model('PartnershipInquiry', partnershipInquirySchema);
