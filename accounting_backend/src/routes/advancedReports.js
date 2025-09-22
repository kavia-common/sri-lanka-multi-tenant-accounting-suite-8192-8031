'use strict';

const express = require('express');
const advancedReportsController = require('../controllers/advancedReports');
const { authenticateToken } = require('../middleware/auth');
const { validateCompanyAccess } = require('../middleware/companyContext');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Reports
 *     description: Financial reporting and analytics
 */

/**
 * @swagger
 * /api/reports/v2/trial-balance:
 *   get:
 *     summary: Trial Balance (advanced)
 *     description: Generate trial balance with comparative periods and budget vs actual columns.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: period[]
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *           example: ["2025-01-01..2025-03-31"]
 *         description: Primary periods. Use start..end format or single as_of date for BS-like reports.
 *       - in: query
 *         name: compare_to[]
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *           example: ["2024-01-01..2024-03-31"]
 *       - in: query
 *         name: budget_source
 *         schema:
 *           type: string
 *           example: table:budgets
 *         description: table:budgets|zero|prior_year
 *       - in: query
 *         name: fiscal_year
 *         schema:
 *           type: string
 *           example: "2025"
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, xlsx]
 *     responses:
 *       200:
 *         description: Trial balance generated
 */
router.get('/v2/trial-balance', authenticateToken, validateCompanyAccess, advancedReportsController.trialBalance);

/**
 * @swagger
 * /api/reports/v2/balance-sheet:
 *   get:
 *     summary: Balance Sheet (advanced)
 *     description: Generate balance sheet with comparative as-of periods and budget vs actual columns.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: period[]
 *         schema:
 *           type: array
 *           items: { type: string }
 *           example: ["2025-03-31"]
 *       - in: query
 *         name: compare_to[]
 *         schema:
 *           type: array
 *           items: { type: string }
 *           example: ["2024-03-31"]
 *       - in: query
 *         name: budget_source
 *         schema: { type: string }
 *       - in: query
 *         name: fiscal_year
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx] }
 *     responses:
 *       200:
 *         description: Balance sheet generated
 */
router.get('/v2/balance-sheet', authenticateToken, validateCompanyAccess, advancedReportsController.balanceSheet);

/**
 * @swagger
 * /api/reports/v2/profit-loss:
 *   get:
 *     summary: Profit & Loss (advanced)
 *     description: Generate P&L with comparative periods, budget vs actual columns, and async batched queries.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period[]
 *         schema: { type: array, items: { type: string } }
 *         example: ["2025-01-01..2025-03-31"]
 *       - in: query
 *         name: compare_to[]
 *         schema: { type: array, items: { type: string } }
 *         example: ["2024-01-01..2024-03-31"]
 *       - in: query
 *         name: budget_source
 *         schema: { type: string }
 *       - in: query
 *         name: fiscal_year
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx] }
 *     responses:
 *       200:
 *         description: Profit & Loss generated
 */
router.get('/v2/profit-loss', authenticateToken, validateCompanyAccess, advancedReportsController.profitLoss);

/**
 * @swagger
 * /api/reports/v2/general-ledger:
 *   get:
 *     summary: General Ledger (advanced)
 *     description: Ledger with comparative filters and pagination.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period[]
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: compare_to[]
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: account_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: account_code
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx] }
 *     responses:
 *       200:
 *         description: Ledger generated
 */
router.get('/v2/general-ledger', authenticateToken, validateCompanyAccess, advancedReportsController.generalLedger);

/**
 * @swagger
 * /api/reports/v2/cash-flow:
 *   get:
 *     summary: Cash Flow Statement (advanced)
 *     description: Indirect method with comparative periods.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period[]
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: compare_to[]
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx] }
 *     responses:
 *       200:
 *         description: Cash flow generated
 */
router.get('/v2/cash-flow', authenticateToken, validateCompanyAccess, advancedReportsController.cashFlow);

/**
 * @swagger
 * /api/reports/v2/aged-receivables:
 *   get:
 *     summary: Aged Receivables (advanced)
 *     description: Buckets can be customized; supports as-of (period[] single date) and xlsx export.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period[]
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: buckets
 *         schema: { type: string }
 *         description: Comma-separated e.g., 30,60,90,120
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx] }
 *     responses:
 *       200:
 *         description: Aged receivables generated
 */
router.get('/v2/aged-receivables', authenticateToken, validateCompanyAccess, advancedReportsController.agedReceivables);

/**
 * @swagger
 * /api/reports/v2/aged-payables:
 *   get:
 *     summary: Aged Payables (advanced)
 *     description: Buckets can be customized; supports as-of (period[] single date) and xlsx export.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period[]
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: buckets
 *         schema: { type: string }
 *         description: Comma-separated e.g., 30,60,90,120
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx] }
 *     responses:
 *       200:
 *         description: Aged payables generated
 */
router.get('/v2/aged-payables', authenticateToken, validateCompanyAccess, advancedReportsController.agedPayables);

/**
 * @swagger
 * /api/reports/v2/budget-vs-actual:
 *   get:
 *     summary: Budget vs Actuals (advanced)
 *     description: P&L accounts with budget and variance columns for the selected period(s).
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period[]
 *         schema: { type: array, items: { type: string } }
 *       - in: query
 *         name: budget_source
 *         schema: { type: string }
 *         example: table:budgets
 *       - in: query
 *         name: fiscal_year
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx] }
 *     responses:
 *       200:
 *         description: Budget vs Actuals generated
 */
router.get('/v2/budget-vs-actual', authenticateToken, validateCompanyAccess, advancedReportsController.budgetVsActual);

module.exports = router;
