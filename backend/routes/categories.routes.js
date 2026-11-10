'use strict';

/** Taxonomy route: GET /api/categories */

const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.get('/', categoryController.list);

module.exports = router;
