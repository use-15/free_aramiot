'use strict';

/** Impact route: GET /api/impact */

const express = require('express');
const impactController = require('../controllers/impactController');

const router = express.Router();

router.get('/', impactController.list);

module.exports = router;
