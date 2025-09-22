const express = require('express');
const transactionsController = require('../controllers/transactions');
const { createTransactionValidation } = require('../validators/accounting');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { validateCompanyAccess } = require('../middleware/companyContext');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         company_id:
 *           type: string
 *           format: uuid
 *         date:
 *           type: string
 *           format: date
 *         description:
 *           type: string
 *         reference:
 *           type: string
 *         total_amount:
 *           type: number
 *           format: decimal
 *         created_at:
 *           type: string
 *           format: date-time
 *         entries:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/JournalEntry'
 *     JournalEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         transaction_id:
 *           type: string
 *           format: uuid
 *         account_id:
 *           type: string
 *           format: uuid
 *         debit_amount:
 *           type: number
 *           format: decimal
 *         credit_amount:
 *           type: number
 *           format: decimal
 *         description:
 *           type: string
 *         account_code:
 *           type: string
 *         account_name:
 *           type: string
 */

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get transactions
 *     description: Retrieve transactions for the specified company with pagination
 *     tags: [Transactions]
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
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
 *         description: Transactions retrieved successfully
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
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, validateCompanyAccess, transactionsController.getTransactions);

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new transaction
 *     description: Create a new transaction with journal entries (double-entry bookkeeping)
 *     tags: [Transactions]
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
 *               - date
 *               - description
 *               - entries
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *               entries:
 *                 type: array
 *                 minItems: 2
 *                 items:
 *                   type: object
 *                   required:
 *                     - account_id
 *                   properties:
 *                     account_id:
 *                       type: string
 *                       format: uuid
 *                     debit_amount:
 *                       type: number
 *                       format: decimal
 *                     credit_amount:
 *                       type: number
 *                       format: decimal
 *                     description:
 *                       type: string
 *                       maxLength: 200
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *       400:
 *         description: Validation failed or unbalanced transaction
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, validateCompanyAccess, createTransactionValidation, handleValidationErrors, transactionsController.createTransaction);

/**
 * @swagger
 * /api/transactions/{transactionId}:
 *   get:
 *     summary: Get transaction details
 *     description: Get details of a specific transaction with all journal entries
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
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
 *         description: Transaction details retrieved successfully
 *       404:
 *         description: Transaction not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:transactionId', authenticateToken, validateCompanyAccess, transactionsController.getTransaction);

module.exports = router;
