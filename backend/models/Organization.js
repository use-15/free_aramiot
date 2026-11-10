'use strict';

/**
 * Organization
 * Single-document collection holding ARAMIOT's institutional information.
 * The public site reads it through GET /api/organization; Phase 2 lets the
 * Super Admin edit the same document.
 */

const mongoose = require('mongoose');
const { baseSchemaOptions, mediaSchema } = require('./sharedFields');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const socialLinksSchema = new mongoose.Schema(
  {
    facebook: { type: String, trim: true, default: '' },
    x: { type: String, trim: true, default: '' },
    instagram: { type: String, trim: true, default: '' },
    linkedin: { type: String, trim: true, default: '' },
    youtube: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Organization name is required'], trim: true, maxlength: 160 },
    tagline: { type: String, trim: true, maxlength: 220, default: '' },
    description: { type: String, trim: true, default: '' },
    story: { type: String, trim: true, default: '' },
    mission: { type: String, trim: true, default: '' },
    vision: { type: String, trim: true, default: '' },
    values: { type: [String], default: [] },
    logo: { type: mediaSchema, default: undefined },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Contact email must be a valid email address'],
      default: '',
    },
    contactPhone: { type: String, trim: true, maxlength: 40, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    socialLinks: { type: socialLinksSchema, default: () => ({}) },
  },
  baseSchemaOptions
);

module.exports = mongoose.model('Organization', organizationSchema);
