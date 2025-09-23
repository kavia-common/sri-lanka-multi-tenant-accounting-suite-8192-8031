'use strict';

const ledgerService = require('../services/ledger');

class LedgerController {
  async accountStatement(req, res) {
    try {
      const { accountId } = req.params;
      const result = await ledgerService.accountStatement(req.user.tenantId, req.user.companyId, accountId);
      return res.status(200).json({ status: 'ok', ...result });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'LEDGER_ACCOUNT_ERROR', message: e.message });
    }
  }

  async trialBalance(req, res) {
    try {
      const result = await ledgerService.trialBalance(req.user.tenantId, req.user.companyId);
      return res.status(200).json({ status: 'ok', accounts: result });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'LEDGER_TB_ERROR', message: e.message });
    }
  }
}

module.exports = new LedgerController();
