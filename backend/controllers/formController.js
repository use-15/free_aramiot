'use strict';

/**
 * Public submission handlers: contact, volunteer, partnership.
 *
 * Each handler receives a validated + sanitised payload (req.validatedBody),
 * stores it, and returns only an identifier. Nothing submitted here is readable
 * through a public route; Phase 2 exposes these collections to the Super Admin.
 */

const ContactMessage = require('../models/ContactMessage');
const VolunteerApplication = require('../models/VolunteerApplication');
const PartnershipInquiry = require('../models/PartnershipInquiry');
const asyncHandler = require('../utils/asyncHandler');

function submissionReceipt(document) {
  return {
    id: document.id,
    status: document.status,
    createdAt: document.createdAt,
  };
}

async function storeContactMessage(req, res) {
  const message = await ContactMessage.create(req.validatedBody);
  res.status(201).json({
    success: true,
    message: 'Thank you for contacting ARAMIOT. Your message has been received.',
    data: submissionReceipt(message),
  });
}

async function storeVolunteerApplication(req, res) {
  const application = await VolunteerApplication.create(req.validatedBody);
  res.status(201).json({
    success: true,
    message: 'Thank you for volunteering. The ARAMIOT team will review your application.',
    data: submissionReceipt(application),
  });
}

async function storePartnershipInquiry(req, res) {
  const inquiry = await PartnershipInquiry.create(req.validatedBody);
  res.status(201).json({
    success: true,
    message: 'Thank you for your interest in partnering with ARAMIOT. We will be in touch.',
    data: submissionReceipt(inquiry),
  });
}

module.exports = {
  submitContact: asyncHandler(storeContactMessage),
  submitVolunteer: asyncHandler(storeVolunteerApplication),
  submitPartnership: asyncHandler(storePartnershipInquiry),
};
