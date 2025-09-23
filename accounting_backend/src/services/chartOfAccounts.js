'use strict';

const db = require('../repositories/postgres');
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
    const exists = await db.list('chart_of_accounts', { company_id: companyId, code }, { tenantId });
    if (exists.length > 0) throw conflict('Account code already exists');
    const acc = await db.insert('chart_of_accounts', {
      company_id: companyId, code, name, type, parent_id: parentId, is_active: isActive, tax_rate_id: taxRateId,
    }, { tenantId, actorUserId });
    return acc;
  }

  /**
   * PUBLIC_INTERFACE
   * List accounts by company
   */
  async list(tenantId, companyId) {
    /** This is a public function. */
    return db.list('chart_of_accounts', { company_id: companyId }, { tenantId });
  }

  /**
   * PUBLIC_INTERFACE
   * Update account meta
   */
  async update(tenantId, actorUserId, id, patch) {
    /** This is a public function. */
    const old = await db.getById('chart_of_accounts', id, { tenantId });
    if (!old) throw notFound('Account not found');
    const mapped = {};
    if (patch.code !== undefined) mapped.code = patch.code;
    if (patch.name !== undefined) mapped.name = patch.name;
    if (patch.type !== undefined) mapped.type = patch.type;
    if (patch.parentId !== undefined) mapped.parent_id = patch.parentId;
    if (patch.isActive !== undefined) mapped.is_active = patch.isActive;
    if (patch.taxRateId !== undefined) mapped.tax_rate_id = patch.taxRateId;
    return db.update('chart_of_accounts', id, mapped, { tenantId, actorUserId });
  }
}

module.exports = new ChartOfAccountsService();
