'use strict';

/**
 * Admin — Super Administrator accounts.
 *
 * Only a single role is permitted: super_admin. Accounts are created (and
 * passwords set) exclusively through the secure CLI init script, never through
 * any public or form-based endpoint. Passwords are stored as bcrypt hashes.
 *
 * Mongoose `timestamps: true` provides createdAt + updatedAt automatically.
 */

const mongoose = require('mongoose');
const { baseSchemaOptions } = require('./sharedFields');

const ROLE_VALUES = ['super_admin'];

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      maxlength: 64,
      unique: true,
      match: [/^[a-zA-Z0-9._-]{3,64}$/, 'Username may contain only letters, numbers, dots, underscores and hyphens, and be 3–64 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address'],
      unique: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'A password hash is required'],
      // Never exposed through any API response.
      select: false,
    },
    role: {
      type: String,
      enum: { values: ROLE_VALUES, message: 'The only permitted role is super_admin' },
      default: 'super_admin',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  baseSchemaOptions
);

adminSchema.index({ isActive: 1 });

// eslint-disable-next-line no-unused-vars
adminSchema.pre('save', function touchLastLogin(next) {
  if (this.isModified() && this.isActive) {
    this.lastLogin = new Date();
  }
  next();
});

module.exports = mongoose.model('Admin', adminSchema);
