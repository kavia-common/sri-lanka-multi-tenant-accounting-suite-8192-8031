const express = require('express');
const companyController = require('../controllers/company');
const { createCompanyValidation, companyParamValidation } = require('../validators/company');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Company:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         address:
 *           type: string
 *         tax_number:
 *           type: string
 *         role:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Get user's companies
 *     description: Retrieve all companies the authenticated user has access to
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Companies retrieved successfully
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
 *                     companies:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Company'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, companyController.getCompanies);

/**
 * @swagger
 * /api/companies:
 *   post:
 *     summary: Create a new company
 *     description: Create a new company and assign the user as owner
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               code:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 10
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *                 maxLength: 500
 *               tax_number:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Company created successfully
 *       409:
 *         description: Company code already exists
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, createCompanyValidation, handleValidationErrors, companyController.createCompany);

/**
 * @swagger
 * /api/companies/{companyId}:
 *   get:
 *     summary: Get company details
 *     description: Get details of a specific company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Company details retrieved successfully
 *       404:
 *         description: Company not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:companyId', authenticateToken, companyParamValidation, handleValidationErrors, companyController.getCompany);

module.exports = router;
