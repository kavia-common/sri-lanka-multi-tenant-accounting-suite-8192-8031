'use strict';

const express = require('express');
const CompaniesController = require('../controllers/companies');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const ctrl = CompaniesController;

/**
 * @swagger
 * tags:
 *   name: Companies
 *   description: Company management
 */

router.use(authenticate);

/**
 * @swagger
 * /companies:
 *   get:
 *     summary: List companies
 *     tags: [Companies]
 *     responses:
 *       200:
 *         description: Companies list
 */
router.get('/', authorize(['admin']), ctrl.list.bind(ctrl));

/**
 * @swagger
 * /companies:
 *   post:
 *     summary: Create company
 *     tags: [Companies]
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', authorize(['admin']), ctrl.create.bind(ctrl));

/**
 * @swagger
 * /companies/{id}:
 *   get:
 *     summary: Get company
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Company
 */
router.get('/:id', authorize(['admin']), ctrl.get.bind(ctrl));

/**
 * @swagger
 * /companies/{id}:
 *   put:
 *     summary: Update company
 *     tags: [Companies]
 */
router.put('/:id', authorize(['admin']), ctrl.update.bind(ctrl));

/**
 * @swagger
 * /companies/{id}:
 *   delete:
 *     summary: Archive company
 *     tags: [Companies]
 */
router.delete('/:id', authorize(['admin']), ctrl.remove.bind(ctrl));

module.exports = router;
