'use strict';

/**
 * Content routes: pages, articles, projects, programs, publications, resources.
 * All six share the same list + detail contract.
 */

const express = require('express');
const pageController = require('../controllers/pageController');
const articleController = require('../controllers/articleController');
const projectController = require('../controllers/projectController');
const programController = require('../controllers/programController');
const publicationController = require('../controllers/publicationController');
const resourceController = require('../controllers/resourceController');

const router = express.Router();

const resources = [
  { path: '/pages', controller: pageController },
  { path: '/articles', controller: articleController },
  { path: '/projects', controller: projectController },
  { path: '/programs', controller: programController },
  { path: '/publications', controller: publicationController },
  { path: '/resources', controller: resourceController },
];

for (const { path: routePath, controller } of resources) {
  router.get(routePath, controller.list);
  router.get(`${routePath}/:slug`, controller.getBySlug);
}

module.exports = router;
