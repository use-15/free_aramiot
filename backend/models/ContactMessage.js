'use strict';

/**
 * ContactMessage
 * Every general enquiry submitted through the public contact form.
 * Created by POST /api/contact. Never readable through a public route.
 */

const mongoose = require('mongoose');
const { CONTACT_MESSAGE_STATUS } = require('../config/constants');
const { submissionSchemaOptions } = require('./sharedFields');

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 140 },
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
      enum: { values: CONTACT_MESSAGE_STATUS, message: `Status must be one of: ${CONTACT_MESSAGE_STATUS.join(', ')}` },
      default: 'new',
      index: true,
    },
  },
  submissionSchemaOptions
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
