'use strict';

/**
 * Field-level allow-list used by the admin CRUD helpers.
 *
 * The admin frontend sends a JSON body for create/update. Only fields listed here
 * (and only those also present in ALLOWED_UPDATE_KEYS in contentHelpers.js) are
 * ever copied into a Mongoose update. This is a second NoSQL-injection defence on
 * top of Mongoose strict mode: the admin payload cannot set arbitrary document
 * keys, and it cannot touch passwordHash / sensitive internal fields.
 *
 * Each descriptor is the field's Mongoose definition object (so setters, enums,
 * defaults and transforms still apply). We now include every top-level field
 * regardless of type (String, Number, Boolean, Date, ObjectId, Array, Embedded),
 * so the admin UI can edit displayOrder, isPublished, publishedAt, category,
 * tags, gallery, address, socialLinks, logo, featuredImage, coverImage, profileImage
 * and every other editable top-level field — not only String fields.
 *
 * Nested subdocument paths (e.g. featuredImage.url, address.street) are excluded:
 * the admin forms send whole subdocument objects (e.g. featuredImage: { url, alt })
 * and contentHelpers builds the nested writes from the sub-schema, so we do not need
 * the nested path keys here.
 *
 * Internal / auto fields are excluded: _id, createdAt, updatedAt, and any
 * _presplitPath internal paths.
 */

const Organization = require('../models/Organization');
const Page = require('../models/Page');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Project = require('../models/Project');
const Program = require('../models/Program');
const TeamMember = require('../models/TeamMember');
const Publication = require('../models/Publication');
const Resource = require('../models/Resource');
const ImpactStatistic = require('../models/ImpactStatistic');

/** Top-level schema paths only: real fields, all instances, excluding nested/
 * internal/auto paths. */
function topLevelFields(schema) {
  return Object.fromEntries(
    Object.entries(schema.paths).filter(([key, definition]) => {
      if (!definition) return false;
      if (key === '_id') return false; // never let the admin choose the id
      if (key === 'createdAt' || key === 'updatedAt') return false; // managed by timestamps
      if (key.includes('.')) return false; // nested subdocument paths — handled separately
      // NOTE: in Mongoose 8.x every schema path has _presplitPath (an internal
      // [path] array whose length is 1 for top-level fields and >1 for nested).
      // Excluding on _presplitPath alone would drop all top-level fields, so we only
      // drop genuinely nested ones (already handled above by key.includes('.')) and
      // keep top-level user fields.
      if (definition && definition._presplitPath && definition._presplitPath.length > 1) return false;
      return true;
    })
  );
}

const MODEL_FIELDS = {
  Organization: topLevelFields(Organization.schema),
  Page: topLevelFields(Page.schema),
  Article: topLevelFields(Article.schema),
  Category: topLevelFields(Category.schema),
  Project: topLevelFields(Project.schema),
  Program: topLevelFields(Program.schema),
  TeamMember: topLevelFields(TeamMember.schema),
  Publication: topLevelFields(Publication.schema),
  Resource: topLevelFields(Resource.schema),
  ImpactStatistic: topLevelFields(ImpactStatistic.schema),
};

module.exports = { MODEL_FIELDS };
