'use strict';

const express = require('express');
const LedgerController = require('../controllers/ledger');
const { authenticate, authorize, requireCompany } = require('../middleware/auth');

const router = express.Router();
const ctrl = LedgerController;

/**
 * @swagger
 * tags:
 *   name: GeneralLedger
 *   description: Ledger and reports
 */

router.use(authenticate, requireCompany);

/**
 * @swagger
 * /general_ledger/trial_balance:
 *   get:
 *     summary: Trial balance
 *     tags: [GeneralLedger]
 */
router.get('/trial_balance', authorize(['admin', 'accountant', 'auditor']), ctrl.trialBalance.bind(ctrl));

/**
 * @swagger
 * /general_ledger/accounts/{accountId}:
 *   get:
 *     summary: Account statement
 *     tags: [GeneralLedger]
 */
router.get('/accounts/:accountId', authorize(['admin', 'accountant', 'auditor']), ctrl.accountStatement.bind(ctrl));

module.exports = router;
