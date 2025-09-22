const express = require('express');
const healthController = require('../controllers/health');

// Import route modules
const authRoutes = require('./auth');
const companyRoutes = require('./companies');
const accountRoutes = require('./accounts');
const transactionRoutes = require('./transactions');
const reportRoutes = require('./reports');

const router = express.Router();

// Health endpoint
/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     description: Check if the API service is running and healthy
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

// API routes
router.use('/api/auth', authRoutes);
router.use('/api/companies', companyRoutes);
router.use('/api/accounts', accountRoutes);
router.use('/api/transactions', transactionRoutes);
router.use('/api/reports', reportRoutes);

module.exports = router;
