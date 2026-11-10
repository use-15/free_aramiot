'use strict';

/**
 * Shared enums and constants.
 *
 * A single source of truth for the values that appear in Mongoose schemas,
 * validators and the public API, so a mismatch is impossible.
 */

/** Editorial lifecycle shared by every content model (Phase 2 admin uses these). */
const CONTENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

const CONTENT_STATUS_VALUES = Object.freeze([
  CONTENT_STATUS.DRAFT,
  CONTENT_STATUS.PUBLISHED,
  CONTENT_STATUS.ARCHIVED,
]);

/** Which website section a Page belongs to. */
const PAGE_SECTIONS = Object.freeze([
  'home',
  'overview',
  'about',
  'health',
  'education',
  'advocacy',
  'our-work',
  'resources',
  'get-involved',
  'contact',
]);

/** A category is scoped to the content type it classifies. */
const CATEGORY_SCOPES = Object.freeze([
  'articles',
  'projects',
  'programs',
  'publications',
  'resources',
  'general',
]);

/** Where a file or image currently lives. 'google-drive' is reserved for Phase 3. */
const MEDIA_PROVIDERS = Object.freeze(['local', 'google-drive']);
const DEFAULT_MEDIA_PROVIDER = 'local';

/** Publication types surfaced on the Resources / Publications pages. */
const PUBLICATION_TYPES = Object.freeze([
  'report',
  'research-paper',
  'policy-brief',
  'technical-report',
  'other',
]);

/** Downloadable resource types. */
const RESOURCE_TYPES = Object.freeze([
  'learning-material',
  'guideline',
  'toolkit',
  'dataset',
  'other',
]);

/** Inbox states used by the three public submission models. */
const CONTACT_MESSAGE_STATUS = Object.freeze(['new', 'read', 'replied', 'archived']);
const VOLUNTEER_STATUS = Object.freeze(['new', 'reviewing', 'accepted', 'declined', 'archived']);
const PARTNERSHIP_STATUS = Object.freeze(['new', 'reviewing', 'responded', 'closed']);

/** Values the frontend uses for the "area of interest" and similar select fields. */
const AREAS_OF_INTEREST = Object.freeze([
  'health',
  'education',
  'advocacy',
  'research',
  'communications',
  'fundraising',
  'operations',
  'other',
]);

module.exports = {
  CONTENT_STATUS,
  CONTENT_STATUS_VALUES,
  PAGE_SECTIONS,
  CATEGORY_SCOPES,
  MEDIA_PROVIDERS,
  DEFAULT_MEDIA_PROVIDER,
  PUBLICATION_TYPES,
  RESOURCE_TYPES,
  CONTACT_MESSAGE_STATUS,
  VOLUNTEER_STATUS,
  PARTNERSHIP_STATUS,
  AREAS_OF_INTEREST,
};
