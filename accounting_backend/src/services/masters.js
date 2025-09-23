'use strict';

const repo = require('../repositories/memory');
const { notFound } = require('../utils/errors');

class MasterService {
  /**
   * PUBLIC_INTERFACE
   * Generic create for a company-scoped entity
   */
  async create(tenantId, actorUserId, entity, companyId, payload) {
    /** This is a public function. */
    return repo.create(tenantId, entity, { ...payload, companyId, _actorUserId: actorUserId });
  }

  /**
   * PUBLIC_INTERFACE
   * Generic get
   */
  async get(tenantId, entity, id) {
    /** This is a public function. */
    const v = repo.getById(tenantId, entity, id);
    if (!v) throw notFound(`${entity} not found`);
    return v;
  }

  /**
   * PUBLIC_INTERFACE
   * Generic list by company
   */
  async list(tenantId, entity, companyId) {
    /** This is a public function. */
    return repo.list(tenantId, entity, { companyId });
  }

  /**
   * PUBLIC_INTERFACE
   * Generic update
   */
  async update(tenantId, actorUserId, entity, id, patch) {
    /** This is a public function. */
    const v = repo.getById(tenantId, entity, id);
    if (!v) throw notFound(`${entity} not found`);
    return repo.update(tenantId, entity, id, { ...patch, _actorUserId: actorUserId });
  }

  /**
   * PUBLIC_INTERFACE
   * Generic delete
   */
  async remove(tenantId, actorUserId, entity, id) {
    /** This is a public function. */
    const ok = repo.delete(tenantId, entity, id, actorUserId);
    if (!ok) throw notFound(`${entity} not found`);
    return { success: true };
  }
}

module.exports = new MasterService();
