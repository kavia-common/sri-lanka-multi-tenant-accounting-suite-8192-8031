'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const companyContext = require('../middleware/companyContext');
const validate = require('../middleware/validation');
const controller = require('../controllers/customReports');

// Basic validators
const createSchema = {
  type: 'object',
  required: ['name', 'spec'],
  properties: {
    name: { type: 'string', maxLength: 150 },
    description: { type: 'string' },
    category: { type: 'string' },
    spec: { type: 'object' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        required: ['field_key'],
        properties: {
          field_key: { type: 'string' },
          field_label: { type: 'string' },
          data_type: { type: 'string' },
        },
      },
    },
  },
};

const updateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 150 },
    description: { type: 'string' },
    category: { type: 'string' },
    is_favorite: { type: 'boolean' },
    notes: { type: 'string' },
    spec: { type: 'object' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        required: ['field_key'],
        properties: {
          field_key: { type: 'string' },
          field_label: { type: 'string' },
          data_type: { type: 'string' },
        },
      },
    },
  },
};

router.use(authMiddleware);
router.use(companyContext);

/**
 * @swagger
 * /api/custom-reports:
 *   get:
 *     summary: List custom report templates
 *     tags: [Custom Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CompanyId'
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: favorites
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Templates list
 */
router.get('/', controller.listTemplates);

/**
 * @swagger
 * /api/custom-reports:
 *   post:
 *     summary: Create a custom report template
 *     tags: [Custom Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CompanyId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', validate(createSchema), controller.createTemplate);

/**
 * @swagger
 * /api/custom-reports/{id}:
 *   get:
 *     summary: Get a custom report template
 *     tags: [Custom Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CompanyId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 */
router.get('/:id', controller.getTemplate);

/**
 * @swagger
 * /api/custom-reports/{id}:
 *   put:
 *     summary: Update a custom report template
 *     tags: [Custom Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CompanyId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:id', validate(updateSchema), controller.updateTemplate);

/**
 * @swagger
 * /api/custom-reports/{id}:
 *   delete:
 *     summary: Delete a custom report template
 *     tags: [Custom Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CompanyId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete('/:id', controller.deleteTemplate);

/**
 * @swagger
 * /api/custom-reports/{id}/execute:
 *   post:
 *     summary: Execute a custom report
 *     tags: [Custom Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/CompanyId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx, pdf], default: json }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Runtime parameters (e.g., period[], compare_to[]) to override template parts
 *     responses:
 *       200: { description: Executed }
 *       404: { description: Not found }
 */
router.post('/:id/execute', controller.executeTemplate);

module.exports = router;
