'use strict';

const companyService = require('../services/companies');

class CompaniesController {
  async create(req, res) {
    try {
      const company = await companyService.create(req.user.tenantId, req.user.userId, req.body);
      return res.status(201).json({ status: 'ok', company });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'COMPANY_CREATE_ERROR', message: e.message });
    }
  }

  async list(req, res) {
    try {
      const companies = await companyService.list(req.user.tenantId);
      return res.status(200).json({ status: 'ok', companies });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'COMPANY_LIST_ERROR', message: e.message });
    }
  }

  async get(req, res) {
    try {
      const company = await companyService.get(req.user.tenantId, req.params.id);
      return res.status(200).json({ status: 'ok', company });
    } catch (e) {
      return res.status(e.status || 404).json({ status: 'error', code: e.code || 'COMPANY_GET_ERROR', message: e.message });
    }
  }

  async update(req, res) {
    try {
      const company = await companyService.update(req.user.tenantId, req.user.userId, req.params.id, req.body);
      return res.status(200).json({ status: 'ok', company });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'COMPANY_UPDATE_ERROR', message: e.message });
    }
  }

  async remove(req, res) {
    try {
      const result = await companyService.remove(req.user.tenantId, req.user.userId, req.params.id);
      return res.status(200).json({ status: 'ok', ...result });
    } catch (e) {
      return res.status(e.status || 404).json({ status: 'error', code: e.code || 'COMPANY_DELETE_ERROR', message: e.message });
    }
  }
}

module.exports = new CompaniesController();
