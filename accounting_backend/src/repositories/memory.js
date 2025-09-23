'use strict';

/**
 * Simple in-memory repository with per-tenant isolation.
 * This is a placeholder for a real DB. All collections are scoped by tenantId.
 */

const crypto = require('crypto');

class InMemoryRepo {
  constructor() {
    this._tenants = new Map();
  }

  _ensureTenant(tenantId) {
    if (!this._tenants.has(tenantId)) {
      this._tenants.set(tenantId, {
        users: new Map(),
        companies: new Map(),
        chartOfAccounts: new Map(),
        journalEntries: new Map(),
        ledger: new Map(),
        customers: new Map(),
        vendors: new Map(),
        bankAccounts: new Map(),
        taxRates: new Map(),
        currencies: new Map(),
        sequences: new Map(), // per-entity auto increment
        auditLog: [],
      });
    }
    return this._tenants.get(tenantId);
  }

  _nextId(tenant, entity) {
    const key = `${entity}`;
    const current = tenant.sequences.get(key) || 0;
    const next = current + 1;
    tenant.sequences.set(key, next);
    return String(next);
  }

  _genUuid() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  }

  audit(tenantId, { actorUserId, action, entity, entityId, before, after }) {
    const t = this._ensureTenant(tenantId);
    t.auditLog.push({
      id: this._genUuid(),
      ts: new Date().toISOString(),
      actorUserId: actorUserId || 'system',
      action,
      entity,
      entityId,
      before,
      after,
    });
  }

  create(tenantId, entity, doc, { idStrategy = 'sequence' } = {}) {
    const t = this._ensureTenant(tenantId);
    const store = t[entity];
    if (!store || !(store instanceof Map)) throw new Error(`Unknown entity: ${entity}`);
    const id = idStrategy === 'uuid' ? this._genUuid() : this._nextId(t, entity);
    const toSave = { ...doc, id, tenantId };
    store.set(id, toSave);
    this.audit(tenantId, { actorUserId: doc._actorUserId, action: 'create', entity, entityId: id, before: null, after: toSave });
    return toSave;
  }

  update(tenantId, entity, id, patch) {
    const t = this._ensureTenant(tenantId);
    const store = t[entity];
    const existed = store.get(id);
    if (!existed) return null;
    const updated = { ...existed, ...patch, id, tenantId };
    store.set(id, updated);
    this.audit(tenantId, { actorUserId: patch._actorUserId, action: 'update', entity, entityId: id, before: existed, after: updated });
    return updated;
  }

  delete(tenantId, entity, id, actorUserId) {
    const t = this._ensureTenant(tenantId);
    const store = t[entity];
    const existed = store.get(id);
    if (!existed) return false;
    store.delete(id);
    this.audit(tenantId, { actorUserId, action: 'delete', entity, entityId: id, before: existed, after: null });
    return true;
  }

  getById(tenantId, entity, id) {
    const t = this._ensureTenant(tenantId);
    const store = t[entity];
    return store.get(id) || null;
  }

  list(tenantId, entity, filter = {}) {
    const t = this._ensureTenant(tenantId);
    const store = t[entity];
    return Array.from(store.values()).filter((doc) => {
      return Object.keys(filter).every((k) => doc[k] === filter[k]);
    });
  }

  upsert(tenantId, entity, where, data) {
    const t = this._ensureTenant(tenantId);
    const store = t[entity];
    const found = Array.from(store.values()).find((doc) => Object.keys(where).every((k) => doc[k] === where[k]));
    if (found) {
      return this.update(tenantId, entity, found.id, data);
    }
    return this.create(tenantId, entity, data);
  }

  getAuditLog(tenantId, { limit = 100, offset = 0 } = {}) {
    const t = this._ensureTenant(tenantId);
    return t.auditLog.slice(offset, offset + limit);
  }
}

module.exports = new InMemoryRepo();
