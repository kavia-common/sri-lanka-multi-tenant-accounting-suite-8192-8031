'use strict';

const journalService = require('../services/journal');

class JournalController {
  async create(req, res) {
    try {
      const journal = await journalService.create(req.user.tenantId, req.user.userId, req.user.companyId, req.body);
      return res.status(201).json({ status: 'ok', journal });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'JOURNAL_CREATE_ERROR', message: e.message });
    }
  }

  async list(req, res) {
    try {
      const { from, to } = req.query;
      const journals = await journalService.list(req.user.tenantId, req.user.companyId, { from, to });
      return res.status(200).json({ status: 'ok', journals });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'JOURNAL_LIST_ERROR', message: e.message });
    }
  }

  async get(req, res) {
    try {
      const journal = await journalService.get(req.user.tenantId, req.params.id);
      return res.status(200).json({ status: 'ok', journal });
    } catch (e) {
      return res.status(e.status || 404).json({ status: 'error', code: e.code || 'JOURNAL_GET_ERROR', message: e.message });
    }
  }
}

module.exports = new JournalController();
