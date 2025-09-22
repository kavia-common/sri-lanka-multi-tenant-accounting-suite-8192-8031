const express = require('express');
const reportsController = require('../controllers/reports');
const { reportDateValidation } = require('../validators/accounting');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { validateCompanyAccess } = require('../middleware/companyContext');

const router = express.Router();

/**
 * @swagger
 * /api/reports/trial-balance:
 *   get:
 *     summary: Generate trial balance report
 *     description: Generate trial balance report for the specified company and date range
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
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Trial balance generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     trialBalance:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                           total_debits:
 *                             type: string
 *                           total_credits:
 *                             type: string
 *                           balance:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalDebits:
 *                           type: string
 *                         totalCredits:
 *                           type: string
 *                         isBalanced:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/trial-balance', authenticateToken, validateCompanyAccess, reportDateValidation, handleValidationErrors, reportsController.getTrialBalance);

/**
 * @swagger
 * /api/reports/balance-sheet:
 *   get:
 *     summary: Generate balance sheet report
 *     description: Generate balance sheet report for the specified company as of a specific date
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
 *         name: as_of_date
 *         schema:
 *           type: string
 *           format: date
 *           description: Date for balance sheet (defaults to current date)
 *     responses:
 *       200:
 *         description: Balance sheet generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     balanceSheet:
 *                       type: object
 *                       properties:
 *                         assets:
 *                           type: array
 *                           items:
 *                             type: object
 *                         liabilities:
 *                           type: array
 *                           items:
 *                             type: object
 *                         equity:
 *                           type: array
 *                           items:
 *                             type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAssets:
 *                           type: string
 *                         totalLiabilities:
 *                           type: string
 *                         totalEquity:
 *                           type: string
 *                         isBalanced:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/balance-sheet', authenticateToken, validateCompanyAccess, reportDateValidation, handleValidationErrors, reportsController.getBalanceSheet);

/**
 * @swagger
 * /api/reports/profit-loss:
 *   get:
 *     summary: Generate profit and loss report
 *     description: Generate profit and loss report for the specified company and date range
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
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Profit and loss report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     profitLoss:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: array
 *                           items:
 *                             type: object
 *                         expenses:
 *                           type: array
 *                           items:
 *                             type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: string
 *                         totalExpenses:
 *                           type: string
 *                         netIncome:
 *                           type: string
 *                         netIncomePercent:
 *                           type: string
 *       400:
 *         description: Date range required
 *       401:
 *         description: Unauthorized
 */
router.get('/profit-loss', authenticateToken, validateCompanyAccess, reportDateValidation, handleValidationErrors, reportsController.getProfitLoss);

module.exports = router;
