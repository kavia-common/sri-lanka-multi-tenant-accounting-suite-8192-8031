const express = require('express');
const controller = require('../controllers/sriLankaCompliance');
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
 * /api/reports/lk/vat-return:
 *   get:
 *     summary: Sri Lanka VAT Return
 *     description: VAT output vs input and net VAT for the period (baseline heuristic; requires proper tax mapping for production).
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period_start
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: period_end
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: include_transactions
 *         schema: { type: boolean }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf] }
 *         description: Set to 'pdf' to stream a branded PDF. Defaults to 'json'.
 *     responses:
 *       200: { description: VAT return generated (JSON or PDF) }
 */
router.get('/lk/vat-return', authenticateToken, validateCompanyAccess, controller.vatReturn);

/**
 * @swagger
 * /api/reports/lk/income-tax:
 *   get:
 *     summary: Sri Lanka Income Tax Computation Schedule
 *     description: Baseline income tax schedule using P&L, addbacks and allowances heuristics.
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period_start
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: period_end
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf] }
 *         description: Set to 'pdf' to stream a branded PDF. Defaults to 'json'.
 *       200: { description: Income tax schedule generated (JSON or PDF) }
 */
router.get('/lk/income-tax', authenticateToken, validateCompanyAccess, controller.incomeTax);

/**
 * @swagger
 * /api/reports/lk/wht-statement:
 *   get:
 *     summary: Sri Lanka Withholding Tax Statement
 *     description: WHT summary by type; baseline using account name keywords (interest, dividend, services).
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period_start
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: period_end
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: include_transactions
 *         schema: { type: boolean }
 *     responses:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf] }
 *         description: Set to 'pdf' to stream a branded PDF. Defaults to 'json'.
 *       200: { description: WHT statement generated (JSON or PDF) }
 */
router.get('/lk/wht-statement', authenticateToken, validateCompanyAccess, controller.whtStatement);

/**
 * @swagger
 * /api/reports/lk/epf-etf:
 *   get:
 *     summary: Sri Lanka EPF/ETF Report
 *     description: Employer remittance summary using payroll heuristics or estimates.
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period_start
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: period_end
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf] }
 *         description: Set to 'pdf' to stream a branded PDF. Defaults to 'json'.
 *       200: { description: EPF/ETF report generated (JSON or PDF) }
 */
router.get('/lk/epf-etf', authenticateToken, validateCompanyAccess, controller.epfEtf);

/**
 * @swagger
 * /api/reports/lk/annual-financials:
 *   get:
 *     summary: Annual Financials (Companies Act mapping)
 *     description: Baseline mapping of accounts into Companies Act style categories with optional prior year comparison.
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: as_of_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: include_previous_year
 *         schema: { type: boolean }
 *     responses:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, pdf] }
 *         description: Set to 'pdf' to stream a branded PDF. Defaults to 'json'.
 *       200: { description: Annual financials generated (JSON or PDF) }
 */
router.get('/lk/annual-financials', authenticateToken, validateCompanyAccess, controller.annualFinancials);

module.exports = router;
