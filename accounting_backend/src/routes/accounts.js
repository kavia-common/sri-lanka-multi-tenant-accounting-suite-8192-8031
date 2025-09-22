const express = require('express');
const accountsController = require('../controllers/accounts');
const { createAccountValidation } = require('../validators/accounting');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { validateCompanyAccess } = require('../middleware/companyContext');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Account:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         company_id:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]
 *         parent_account_id:
 *           type: string
 *           format: uuid
 *         description:
 *           type: string
 *         balance:
 *           type: number
 *           format: decimal
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: Get chart of accounts
 *     description: Retrieve all accounts for the specified company (chart of accounts)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Company ID for multi-tenant context
 *     responses:
 *       200:
 *         description: Chart of accounts retrieved successfully
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
 *                     accounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Account'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied to company
 */
router.get('/', authenticateToken, validateCompanyAccess, accountsController.getAccounts);

/**
 * @swagger
 * /api/accounts:
 *   post:
 *     summary: Create a new account
 *     description: Create a new account in the chart of accounts
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - type
 *             properties:
 *               code:
 *                 type: string
 *                 maxLength: 20
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               type:
 *                 type: string
 *                 enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]
 *               parent_account_id:
 *                 type: string
 *                 format: uuid
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Account created successfully
 *       409:
 *         description: Account code already exists
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, validateCompanyAccess, createAccountValidation, handleValidationErrors, accountsController.createAccount);

/**
 * @swagger
 * /api/accounts/{accountId}:
 *   get:
 *     summary: Get account details
 *     description: Get details of a specific account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Account details retrieved successfully
 *       404:
 *         description: Account not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:accountId', authenticateToken, validateCompanyAccess, accountsController.getAccount);

/**
 * @swagger
 * /api/accounts/{accountId}:
 *   put:
 *     summary: Update account
 *     description: Update account details (name and description only)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Account updated successfully
 *       404:
 *         description: Account not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:accountId', authenticateToken, validateCompanyAccess, accountsController.updateAccount);

module.exports = router;
