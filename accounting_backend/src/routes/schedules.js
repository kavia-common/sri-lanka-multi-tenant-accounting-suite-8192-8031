'use strict';

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateCompanyAccess } = require('../middleware/companyContext');
const controller = require('../controllers/schedules');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Report Schedules
 *     description: Schedule periodic report emails and view delivery logs
 */

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: List report schedules
 *     description: List all report schedules for the company
 *     tags: [Report Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Schedules list
 */
router.get('/', authenticateToken, validateCompanyAccess, controller.list.bind(controller));

/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: Create a report schedule
 *     description: Create new schedule with recurrence, recipients, and report options
 *     tags: [Report Schedules]
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
 *             properties:
 *               name: { type: string }
 *               report_type: { type: string, enum: ['TRIAL_BALANCE','BALANCE_SHEET','PROFIT_LOSS','GENERAL_LEDGER','CASH_FLOW','CHANGES_IN_EQUITY','AGED_RECEIVABLES','AGED_PAYABLES','BUDGET_VS_ACTUAL'] }
 *               format: { type: string, enum: ['PDF','XLSX'] }
 *               recipients: { type: array, items: { type: string, format: email } }
 *               notes: { type: string }
 *               options: { type: object, description: "Report-specific params e.g., start_date/end_date" }
 *               schedule_type: { type: string, enum: ['daily','weekly','monthly','custom'] }
 *               cron_expression: { type: string }
 *               timezone: { type: string }
 *               next_run_at: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', authenticateToken, validateCompanyAccess, controller.create.bind(controller));

/**
 * @swagger
 * /api/schedules/{id}:
 *   get:
 *     summary: Get schedule
 *     tags: [Report Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 */
router.get('/:id', authenticateToken, validateCompanyAccess, controller.get.bind(controller));

/**
 * @swagger
 * /api/schedules/{id}:
 *   put:
 *     summary: Update schedule
 *     tags: [Report Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticateToken, validateCompanyAccess, controller.update.bind(controller));

/**
 * @swagger
 * /api/schedules/{id}:
 *   delete:
 *     summary: Delete schedule
 *     tags: [Report Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', authenticateToken, validateCompanyAccess, controller.remove.bind(controller));

/**
 * @swagger
 * /api/schedules/{id}/logs:
 *   get:
 *     summary: List delivery logs for a schedule
 *     tags: [Report Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/logs', authenticateToken, validateCompanyAccess, controller.logs.bind(controller));

/**
 * @swagger
 * /api/schedules/{id}/trigger:
 *   post:
 *     summary: Trigger schedule now (test)
 *     tags: [Report Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: x-company-id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Triggered }
 */
router.post('/:id/trigger', authenticateToken, validateCompanyAccess, controller.trigger.bind(controller));

module.exports = router;
