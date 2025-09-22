const express = require('express');
const controller = require('../controllers/advancedReports');
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
 *     description: Generate trial balance with optional drill-down and inclusion of zero balances.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: include_zero
 *         schema: { type: boolean }
 *       - in: query
 *         name: drilldown
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Trial balance generated }
 */
router.get('/v2/trial-balance', authenticateToken, validateCompanyAccess, controller.trialBalance);

/**
 * @swagger
 * /api/reports/v2/balance-sheet:
 *   get:
 *     summary: Balance Sheet (advanced)
 *     description: Generate balance sheet with optional comparative period.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: as_of_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: comparative
 *         schema: { type: boolean }
 *       - in: query
 *         name: compare_as_of_date
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Balance sheet generated }
 */
router.get('/v2/balance-sheet', authenticateToken, validateCompanyAccess, controller.balanceSheet);

/**
 * @swagger
 * /api/reports/v2/profit-loss:
 *   get:
 *     summary: Profit & Loss (advanced)
 *     description: Generate P&L with optional comparative and drill-down.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: comparative
 *         schema: { type: boolean }
 *       - in: query
 *         name: compare_start_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: compare_end_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: drilldown
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Profit & Loss generated }
 */
router.get('/v2/profit-loss', authenticateToken, validateCompanyAccess, controller.profitLoss);

/**
 * @swagger
 * /api/reports/v2/general-ledger:
 *   get:
 *     summary: General Ledger
 *     description: Paginated ledger with filters by account and date range.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: account_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: account_code
 *         schema: { type: string }
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200: { description: Ledger generated }
 */
router.get('/v2/general-ledger', authenticateToken, validateCompanyAccess, controller.generalLedger);

/**
 * @swagger
 * /api/reports/v2/cash-flow:
 *   get:
 *     summary: Cash Flow Statement
 *     description: Indirect method cash flow statement.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Cash flow generated }
 */
router.get('/v2/cash-flow', authenticateToken, validateCompanyAccess, controller.cashFlow);

/**
 * @swagger
 * /api/reports/v2/changes-in-equity:
 *   get:
 *     summary: Statement of Changes in Equity
 *     description: Equity movements over a period.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Changes in equity generated }
 */
router.get('/v2/changes-in-equity', authenticateToken, validateCompanyAccess, controller.changesInEquity);

/**
 * @swagger
 * /api/reports/v2/aged-receivables:
 *   get:
 *     summary: Aged Receivables
 *     description: Buckets receivables into 0-30, 31-60, 61-90, 90+ by default.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: as_of_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: buckets
 *         schema: { type: string, description: "Comma-separated e.g., 30,60,90,120" }
 *     responses:
 *       200: { description: Aged receivables generated }
 */
router.get('/v2/aged-receivables', authenticateToken, validateCompanyAccess, controller.agedReceivables);

/**
 * @swagger
 * /api/reports/v2/aged-payables:
 *   get:
 *     summary: Aged Payables
 *     description: Buckets payables into 0-30, 31-60, 61-90, 90+ by default.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: as_of_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: buckets
 *         schema: { type: string, description: "Comma-separated e.g., 30,60,90,120" }
 *     responses:
 *       200: { description: Aged payables generated }
 */
router.get('/v2/aged-payables', authenticateToken, validateCompanyAccess, controller.agedPayables);

/**
 * @swagger
 * /api/reports/v2/budget-vs-actual:
 *   get:
 *     summary: Budget vs Actuals
 *     description: Baseline budget vs actuals for P&L accounts (works without budgets table).
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Budget vs actuals generated }
 */
router.get('/v2/budget-vs-actual', authenticateToken, validateCompanyAccess, controller.budgetVsActual);

module.exports = router;
