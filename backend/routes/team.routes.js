'use strict';

/** Team route: GET /api/team */

const express = require('express');
const teamController = require('../controllers/teamController');

const router = express.Router();

router.get('/', teamController.list);

module.exports = router;
