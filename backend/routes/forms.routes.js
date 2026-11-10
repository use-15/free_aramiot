'use strict';

/**
 * Public write routes.
 * Each POST is validated and sanitised before it reaches the controller, and the
 * payload is capped by the 100kb JSON body limit set in app.js.
 */

const express = require('express');
const formController = require('../controllers/formController');
const validateBody = require('../middleware/validateBody');
const { validateContact } = require('../validators/contact');
const { validateVolunteer } = require('../validators/volunteer');
const { validatePartnership } = require('../validators/partnership');

const router = express.Router();

router.post('/contact', validateBody(validateContact), formController.submitContact);
router.post('/volunteers', validateBody(validateVolunteer), formController.submitVolunteer);
router.post('/partnerships', validateBody(validatePartnership), formController.submitPartnership);

module.exports = router;
