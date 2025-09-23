'use strict';

const repo = require('../repositories/memory');
const { notFound, conflict } = require('../utils/errors');

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

class ChartOfAccountsService {
  /**
   * PUBLIC_INTERFACE
   * Create an account
   */
  async create(tenantId, actorUserId, companyId, { code, name, type, parentId = null, isActive = true, taxRateId = null }) {
    /** This is a public function. */
    if (!ACCOUNT_TYPES.includes(type)) throw new Error('Invalid account type');
    const exists = repo.list(tenantId, 'chartOfAccounts', { companyId, code })[0];
    if (exists) throw conflict('Account code already exists');
    const acc = repo.create(tenantId, 'chartOfAccounts', {
      companyId, code, name, type, parentId, isActive, taxRateId, _actorUserId: actorUserId,
    });
    return acc;
  }

  /**
   * PUBLIC_INTERFACE
   * List accounts by company
   */
  async list(tenantId, companyId) {
    /** This is a public function. */
    return repo.list(tenantId, 'chartOfAccounts', { companyId });
  }

  /**
   * PUBLIC_INTERFACE
   * Update account meta
   */
  async update(tenantId, actorUserId, id, patch) {
    /** This is a public function. */
    const old = repo.getById(tenantId, 'chartOfAccounts', id);
    if (!old) throw notFound('Account not found');
    return repo.update(tenantId, 'chartOfAccounts', id, { ...patch, _actorUserId: actorUserId });
  }
}

module.exports = new ChartOfAccountsService();
