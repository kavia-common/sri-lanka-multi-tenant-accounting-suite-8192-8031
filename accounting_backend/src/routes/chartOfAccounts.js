'use strict';

const express = require('express');
const CoAController = require('../controllers/chartOfAccounts');
const { authenticate, authorize, requireCompany } = require('../middleware/auth');

const router = express.Router();
const ctrl = CoAController;

/**
 * @swagger
 * tags:
 *   name: ChartOfAccounts
 *   description: Chart of Accounts
 */

router.use(authenticate, requireCompany);

/**
 * @swagger
 * /chart_of_accounts:
 *   get:
 *     summary: List accounts
 *     tags: [ChartOfAccounts]
 */
router.get('/', authorize(['admin', 'accountant']), ctrl.list.bind(ctrl));

/**
 * @swagger
 * /chart_of_accounts:
 *   post:
 *     summary: Create account
 *     tags: [ChartOfAccounts]
 */
router.post('/', authorize(['admin', 'accountant']), ctrl.create.bind(ctrl));

/**
 * @swagger
 * /chart_of_accounts/{id}:
 *   put:
 *     summary: Update account
 *     tags: [ChartOfAccounts]
 */
router.put('/:id', authorize(['admin', 'accountant']), ctrl.update.bind(ctrl));

module.exports = router;
