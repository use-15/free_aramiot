'use strict';

/**
 * API router, mounted at /api by app.js.
 */

const express = require('express');
const contentRoutes = require('./content.routes');
const categoriesRoutes = require('./categories.routes');
const organizationRoutes = require('./organization.routes');
const teamRoutes = require('./team.routes');
const impactRoutes = require('./impact.routes');
const formsRoutes = require('./forms.routes');

const router = express.Router();

/** Self-describing index so the API is explorable without documentation. */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'ARAMIOT public API',
      phase: 1,
      version: '1.0.0',
      endpoints: {
        read: [
          'GET /api/health',
          'GET /api/organization',
          'GET /api/pages',
          'GET /api/pages/:slug',
          'GET /api/articles',
          'GET /api/articles/:slug',
          'GET /api/categories',
          'GET /api/projects',
          'GET /api/projects/:slug',
          'GET /api/programs',
          'GET /api/programs/:slug',
          'GET /api/team',
          'GET /api/publications',
          'GET /api/publications/:slug',
          'GET /api/resources',
          'GET /api/resources/:slug',
          'GET /api/impact',
        ],
        write: ['POST /api/contact', 'POST /api/volunteers', 'POST /api/partnerships'],
      },
    },
  });
});

router.use('/organization', organizationRoutes);
router.use('/categories', categoriesRoutes);
router.use('/team', teamRoutes);
router.use('/impact', impactRoutes);
router.use('/', contentRoutes);
router.use('/', formsRoutes);

module.exports = router;
