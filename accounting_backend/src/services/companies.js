'use strict';

const repo = require('../repositories/memory');
const { notFound } = require('../utils/errors');

class CompanyService {
  /**
   * PUBLIC_INTERFACE
   * Create a company under tenant
   */
  async create(tenantId, actorUserId, payload) {
    /** This is a public function. */
    const defaults = {
      name: payload.name,
      taxNumber: payload.taxNumber || null,
      currency: payload.currency || 'LKR',
      country: 'LK',
      address: payload.address || null,
      fiscalYearStart: payload.fiscalYearStart || '04-01', // Sri Lankan common fiscal year
      settings: payload.settings || {},
      active: true,
    };
    const company = repo.create(tenantId, 'companies', { ...defaults, _actorUserId: actorUserId });
    return company;
  }

  /**
   * PUBLIC_INTERFACE
   * Get a company
   */
  async get(tenantId, id) {
    /** This is a public function. */
    const c = repo.getById(tenantId, 'companies', id);
    if (!c) throw notFound('Company not found');
    return c;
  }

  /**
   * PUBLIC_INTERFACE
   * List companies
   */
  async list(tenantId) {
    /** This is a public function. */
    return repo.list(tenantId, 'companies');
  }

  /**
   * PUBLIC_INTERFACE
   * Update company
   */
  async update(tenantId, actorUserId, id, patch) {
    /** This is a public function. */
    const c = repo.getById(tenantId, 'companies', id);
    if (!c) throw notFound('Company not found');
    return repo.update(tenantId, 'companies', id, { ...patch, _actorUserId: actorUserId });
  }

  /**
   * PUBLIC_INTERFACE
   * Archive company
   */
  async remove(tenantId, actorUserId, id) {
    /** This is a public function. */
    const ok = repo.update(tenantId, 'companies', id, { active: false, _actorUserId: actorUserId });
    if (!ok) throw notFound('Company not found');
    return { success: true };
  }
}

module.exports = new CompanyService();
