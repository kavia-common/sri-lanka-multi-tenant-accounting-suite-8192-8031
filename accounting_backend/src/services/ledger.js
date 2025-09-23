'use strict';

const repo = require('../repositories/memory');
const { notFound } = require('../utils/errors');

class LedgerService {
  /**
   * PUBLIC_INTERFACE
   * Get account balance and statement
   */
  async accountStatement(tenantId, companyId, accountId) {
    /** This is a public function. */
    const acc = repo.getById(tenantId, 'chartOfAccounts', accountId);
    if (!acc || acc.companyId !== companyId) throw notFound('Account not found');

    const compositeId = `${companyId}:${accountId}`;
    const ledger = repo.getById(tenantId, 'ledger', compositeId) || { balance: 0, entries: [] };
    return {
      account: { id: accountId, code: acc.code, name: acc.name, type: acc.type },
      balance: ledger.balance || 0,
      entries: ledger.entries || [],
    };
  }

  /**
   * PUBLIC_INTERFACE
   * Trial balance: aggregates balances by account
   */
  async trialBalance(tenantId, companyId) {
    /** This is a public function. */
    const accounts = repo.list(tenantId, 'chartOfAccounts', { companyId });
    return accounts.map((a) => {
      const compositeId = `${companyId}:${a.id}`;
      const l = repo.getById(tenantId, 'ledger', compositeId) || { balance: 0 };
      return { accountId: a.id, code: a.code, name: a.name, type: a.type, balance: l.balance || 0 };
    });
  }
}

module.exports = new LedgerService();
