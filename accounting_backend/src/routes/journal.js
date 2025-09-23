'use strict';

const express = require('express');
const JournalController = require('../controllers/journal');
const { authenticate, authorize, requireCompany } = require('../middleware/auth');

const router = express.Router();
const ctrl = JournalController;

/**
 * @swagger
 * tags:
 *   name: JournalEntries
 *   description: Journal entries and posting
 */

router.use(authenticate, requireCompany);

/**
 * @swagger
 * /journal_entries:
 *   get:
 *     summary: List journal entries
 *     tags: [JournalEntries]
 */
router.get('/', authorize(['admin', 'accountant', 'auditor']), ctrl.list.bind(ctrl));

/**
 * @swagger
 * /journal_entries:
 *   post:
 *     summary: Create and post a journal entry
 *     tags: [JournalEntries]
 */
router.post('/', authorize(['admin', 'accountant']), ctrl.create.bind(ctrl));

/**
 * @swagger
 * /journal_entries/{id}:
 *   get:
 *     summary: Get journal entry
 *     tags: [JournalEntries]
 */
router.get('/:id', authorize(['admin', 'accountant', 'auditor']), ctrl.get.bind(ctrl));

module.exports = router;
