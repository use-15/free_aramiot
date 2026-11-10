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
 * defaults and transforms still apply). 'content'/'description' etc. are included
 * as generous defaults for the rich-text fields the admin will edit.
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

const MODEL_FIELDS = {
  Organization: Object.fromEntries(
    Object.entries(Organization.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  Page: Object.fromEntries(
    Object.entries(Page.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  Article: Object.fromEntries(
    Object.entries(Article.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  Category: Object.fromEntries(
    Object.entries(Category.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  Project: Object.fromEntries(
    Object.entries(Project.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  Program: Object.fromEntries(
    Object.entries(Program.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  TeamMember: Object.fromEntries(
    Object.entries(TeamMember.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  Publication: Object.fromEntries(
    Object.entries(Publication.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  Resource: Object.fromEntries(
    Object.entries(Resource.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
  ImpactStatistic: Object.fromEntries(
    Object.entries(ImpactStatistic.schema.paths).filter(([, definition]) =>
      definition && definition.instance === 'String' && !definition._presplitPath
    )
  ),
};

module.exports = { MODEL_FIELDS };
