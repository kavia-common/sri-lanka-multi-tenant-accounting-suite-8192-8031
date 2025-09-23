'use strict';

const express = require('express');
const AuthController = require('../controllers/auth');

const router = express.Router();
const ctrl = AuthController;

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a user in a tenant
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               name: { type: string }
 *               roles:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/register', ctrl.register.bind(ctrl));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               companyId: { type: string }
 *     responses:
 *       200:
 *         description: Authenticated
 */
router.post('/login', ctrl.login.bind(ctrl));

module.exports = router;
