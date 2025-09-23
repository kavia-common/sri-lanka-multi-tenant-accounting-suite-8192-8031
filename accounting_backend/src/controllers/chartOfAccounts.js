'use strict';

const coaService = require('../services/chartOfAccounts');

class CoAController {
  async create(req, res) {
    try {
      const account = await coaService.create(req.user.tenantId, req.user.userId, req.user.companyId, req.body);
      return res.status(201).json({ status: 'ok', account });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'COA_CREATE_ERROR', message: e.message });
    }
  }

  async list(req, res) {
    try {
      const accounts = await coaService.list(req.user.tenantId, req.user.companyId);
      return res.status(200).json({ status: 'ok', accounts });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'COA_LIST_ERROR', message: e.message });
    }
  }

  async update(req, res) {
    try {
      const account = await coaService.update(req.user.tenantId, req.user.userId, req.params.id, req.body);
      return res.status(200).json({ status: 'ok', account });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'COA_UPDATE_ERROR', message: e.message });
    }
  }
}

module.exports = new CoAController();
