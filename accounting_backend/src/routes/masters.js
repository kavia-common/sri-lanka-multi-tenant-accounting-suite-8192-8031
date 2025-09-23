'use strict';

const express = require('express');
const MastersController = require('../controllers/masters');
const { authenticate, authorize, requireCompany } = require('../middleware/auth');

const router = express.Router();
const ctrl = MastersController;

/**
 * @swagger
 * tags:
 *   name: Masters
 *   description: Customers, Vendors, Bank Accounts, Tax Rates, Currencies
 */

router.use(authenticate, requireCompany);

/**
 * @swagger
 * /{entity}:
 *   get:
 *     summary: List master records
 *     tags: [Masters]
 *   post:
 *     summary: Create master record
 *     tags: [Masters]
 */
router.get('/:entity(customers|vendors|bank_accounts|tax_rates|currencies)', authorize(['admin', 'accountant']), ctrl.list.bind(ctrl));
router.post('/:entity(customers|vendors|bank_accounts|tax_rates|currencies)', authorize(['admin', 'accountant']), ctrl.create.bind(ctrl));

/**
 * @swagger
 * /{entity}/{id}:
 *   get:
 *     summary: Get master record
 *     tags: [Masters]
 *   put:
 *     summary: Update master record
 *     tags: [Masters]
 *   delete:
 *     summary: Delete master record
 *     tags: [Masters]
 */
router.get('/:entity(customers|vendors|bank_accounts|tax_rates|currencies)/:id', authorize(['admin', 'accountant', 'auditor']), ctrl.get.bind(ctrl));
router.put('/:entity(customers|vendors|bank_accounts|tax_rates|currencies)/:id', authorize(['admin', 'accountant']), ctrl.update.bind(ctrl));
router.delete('/:entity(customers|vendors|bank_accounts|tax_rates|currencies)/:id', authorize(['admin']), ctrl.remove.bind(ctrl));

module.exports = router;
