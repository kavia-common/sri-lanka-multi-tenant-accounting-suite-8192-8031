'use strict';

const authService = require('../services/auth');

class AuthController {
  /**
   * Authenticate user and issue a JWT.
   */
  async login(req, res) {
    try {
      const { tenantId, email, password, companyId } = req.body;
      const result = await authService.login({ tenantId, email, password, companyId });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (e) {
      const status = e.status || 400;
      return res.status(status).json({ status: 'error', code: e.code || 'AUTH_ERROR', message: e.message });
    }
  }

  /**
   * Register user for a tenant. Used for seeding tenant admins.
   */
  async register(req, res) {
    try {
      const { tenantId, email, password, name, roles } = req.body;
      const user = await authService.register({ tenantId, email, password, name, roles });
      return res.status(201).json({ status: 'ok', user });
    } catch (e) {
      const status = e.status || 400;
      return res.status(status).json({ status: 'error', code: e.code || 'REGISTER_ERROR', message: e.message });
    }
  }
}

module.exports = new AuthController();
