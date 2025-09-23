'use strict';

const db = require('../repositories/postgres');
const { notFound } = require('../utils/errors');

class CompanyService {
  /**
   * PUBLIC_INTERFACE
   * Create a company under tenant
   */
  async create(tenantId, actorUserId, payload) {
    /** This is a public function. */
    const company = await db.insert('companies', {
      name: payload.name,
      tax_number: payload.taxNumber || null,
      currency: payload.currency || 'LKR',
      country: 'LK',
      address: payload.address || null,
      fiscal_year_start: payload.fiscalYearStart || '04-01',
      settings: payload.settings || {},
      active: true,
    }, { tenantId, actorUserId });
    return company;
  }

  /**
   * PUBLIC_INTERFACE
   * Get a company
   */
  async get(tenantId, id) {
    /** This is a public function. */
    const c = await db.getById('companies', id, { tenantId });
    if (!c) throw notFound('Company not found');
    return c;
  }

  /**
   * PUBLIC_INTERFACE
   * List companies
   */
  async list(tenantId) {
    /** This is a public function. */
    return db.list('companies', {}, { tenantId });
  }

  /**
   * PUBLIC_INTERFACE
   * Update company
   */
  async update(tenantId, actorUserId, id, patch) {
    /** This is a public function. */
    const c = await db.getById('companies', id, { tenantId });
    if (!c) throw notFound('Company not found');
    const mapped = {};
    if (patch.name !== undefined) mapped.name = patch.name;
    if (patch.taxNumber !== undefined) mapped.tax_number = patch.taxNumber;
    if (patch.currency !== undefined) mapped.currency = patch.currency;
    if (patch.address !== undefined) mapped.address = patch.address;
    if (patch.fiscalYearStart !== undefined) mapped.fiscal_year_start = patch.fiscalYearStart;
    if (patch.settings !== undefined) mapped.settings = patch.settings;
    if (patch.active !== undefined) mapped.active = patch.active;
    return db.update('companies', id, mapped, { tenantId, actorUserId });
  }

  /**
   * PUBLIC_INTERFACE
   * Archive company
   */
  async remove(tenantId, actorUserId, id) {
    /** This is a public function. */
    const updated = await db.update('companies', id, { active: false }, { tenantId, actorUserId });
    if (!updated) throw notFound('Company not found');
    return { success: true };
  }
}

module.exports = new CompanyService();
