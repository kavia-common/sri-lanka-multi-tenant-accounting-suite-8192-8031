'use strict';

const db = require('../repositories/postgres');
const { notFound } = require('../utils/errors');

class LedgerService {
  /**
   * PUBLIC_INTERFACE
   * Get account balance and statement
   */
  async accountStatement(tenantId, companyId, accountId) {
    /** This is a public function. */
    const acc = await db.getById('chart_of_accounts', accountId, { tenantId });
    if (!acc || Number(acc.company_id) !== Number(companyId)) throw notFound('Account not found');

    const compositeId = `${companyId}:${accountId}`;
    const rows = await db.list('ledger_balances', { id: compositeId }, { tenantId });
    const l = rows[0] || { balance: 0, entries: [] };
    return {
      account: { id: Number(accountId), code: acc.code, name: acc.name, type: acc.type },
      balance: Number(l.balance || 0),
      entries: l.entries || [],
    };
  }

  /**
   * PUBLIC_INTERFACE
   * Trial balance: aggregates balances by account
   */
  async trialBalance(tenantId, companyId) {
    /** This is a public function. */
    const accounts = await db.list('chart_of_accounts', { company_id: companyId }, { tenantId });
    const balances = await db.list('ledger_balances', { company_id: companyId }, { tenantId });
    const byAccount = new Map(balances.map((b) => [Number(b.account_id), Number(b.balance || 0)]));
    return accounts.map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      balance: byAccount.get(Number(a.id)) || 0,
    }));
  }
}

module.exports = new LedgerService();
