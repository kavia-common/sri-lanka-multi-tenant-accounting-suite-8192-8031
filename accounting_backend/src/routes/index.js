'use strict';
const express = require('express');
const healthController = require('../controllers/health');

const authRoutes = require('./auth');
const userRoutes = require('./users');
const companyRoutes = require('./companies');
const coaRoutes = require('./chartOfAccounts');
const journalRoutes = require('./journal');
const ledgerRoutes = require('./ledger');
const masterRoutes = require('./masters');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
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

// Public
router.use('/auth', authRoutes);

// Protected and tenant-scoped
router.use('/users', userRoutes);
router.use('/companies', companyRoutes);
router.use('/chart_of_accounts', coaRoutes);
router.use('/journal_entries', journalRoutes);
router.use('/general_ledger', ledgerRoutes);
router.use('/', masterRoutes);

module.exports = router;
