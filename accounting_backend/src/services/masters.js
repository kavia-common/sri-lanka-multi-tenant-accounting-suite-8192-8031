'use strict';

const db = require('../repositories/postgres');
const { notFound } = require('../utils/errors');

const entityTableMap = {
  customers: 'customers',
  vendors: 'vendors',
  bankAccounts: 'bank_accounts',
  taxRates: 'tax_rates',
  currencies: 'currencies',
};

class MasterService {
  /**
   * PUBLIC_INTERFACE
   * Generic create for a company-scoped entity
   */
  async create(tenantId, actorUserId, entity, companyId, payload) {
    /** This is a public function. */
    const table = entityTableMap[entity];
    return db.insert(table, { ...payload, company_id: companyId }, { tenantId, actorUserId });
  }

  /**
   * PUBLIC_INTERFACE
   * Generic get
   */
  async get(tenantId, entity, id) {
    /** This is a public function. */
    const table = entityTableMap[entity];
    const v = await db.getById(table, id, { tenantId });
    if (!v) throw notFound(`${entity} not found`);
    return v;
  }

  /**
   * PUBLIC_INTERFACE
   * Generic list by company
   */
  async list(tenantId, entity, companyId) {
    /** This is a public function. */
    const table = entityTableMap[entity];
    return db.list(table, { company_id: companyId }, { tenantId });
  }

  /**
   * PUBLIC_INTERFACE
   * Generic update
   */
  async update(tenantId, actorUserId, entity, id, patch) {
    /** This is a public function. */
    const table = entityTableMap[entity];
    const existing = await db.getById(table, id, { tenantId });
    if (!existing) throw notFound(`${entity} not found`);
    return db.update(table, id, patch, { tenantId, actorUserId });
  }

  /**
   * PUBLIC_INTERFACE
   * Generic delete
   */
  async remove(tenantId, actorUserId, entity, id) {
    /** This is a public function. */
    const table = entityTableMap[entity];
    const ok = await db.remove(table, id, { tenantId });
    if (!ok) throw notFound(`${entity} not found`);
    return { success: true };
  }
}

module.exports = new MasterService();
