'use strict';

const express = require('express');
const UsersController = require('../controllers/users');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const ctrl = UsersController;

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

router.use(authenticate);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Users list
 */
router.get('/', authorize(['admin']), ctrl.list.bind(ctrl));

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create user
 *     tags: [Users]
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', authorize(['admin']), ctrl.create.bind(ctrl));

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User
 */
router.get('/:id', authorize(['admin']), ctrl.get.bind(ctrl));

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:id', authorize(['admin']), ctrl.update.bind(ctrl));

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/:id', authorize(['admin']), ctrl.remove.bind(ctrl));

module.exports = router;
