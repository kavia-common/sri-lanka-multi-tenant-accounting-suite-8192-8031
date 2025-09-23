'use strict';

const masterService = require('../services/masters');

class MastersController {
  buildEntity(path) {
    const map = {
      customers: 'customers',
      vendors: 'vendors',
      bank_accounts: 'bankAccounts',
      tax_rates: 'taxRates',
      currencies: 'currencies',
    };
    return map[path];
  }

  async create(req, res) {
    try {
      const entity = this.buildEntity(req.params.entity);
      const doc = await masterService.create(req.user.tenantId, req.user.userId, entity, req.user.companyId, req.body);
      return res.status(201).json({ status: 'ok', [entity]: doc });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'MASTER_CREATE_ERROR', message: e.message });
    }
  }

  async list(req, res) {
    try {
      const entity = this.buildEntity(req.params.entity);
      const docs = await masterService.list(req.user.tenantId, entity, req.user.companyId);
      return res.status(200).json({ status: 'ok', [entity]: docs });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'MASTER_LIST_ERROR', message: e.message });
    }
  }

  async get(req, res) {
    try {
      const entity = this.buildEntity(req.params.entity);
      const doc = await masterService.get(req.user.tenantId, entity, req.params.id);
      return res.status(200).json({ status: 'ok', [entity.slice(0, -1)]: doc });
    } catch (e) {
      return res.status(e.status || 404).json({ status: 'error', code: e.code || 'MASTER_GET_ERROR', message: e.message });
    }
  }

  async update(req, res) {
    try {
      const entity = this.buildEntity(req.params.entity);
      const doc = await masterService.update(req.user.tenantId, req.user.userId, entity, req.params.id, req.body);
      return res.status(200).json({ status: 'ok', [entity.slice(0, -1)]: doc });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'MASTER_UPDATE_ERROR', message: e.message });
    }
  }

  async remove(req, res) {
    try {
      const entity = this.buildEntity(req.params.entity);
      const result = await masterService.remove(req.user.tenantId, req.user.userId, entity, req.params.id);
      return res.status(200).json({ status: 'ok', ...result });
    } catch (e) {
      return res.status(e.status || 404).json({ status: 'error', code: e.code || 'MASTER_DELETE_ERROR', message: e.message });
    }
  }
}

module.exports = new MastersController();
