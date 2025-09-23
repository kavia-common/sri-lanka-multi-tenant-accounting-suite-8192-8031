'use strict';

const db = require('../repositories/postgres');
const { hashPassword } = require('../utils/auth');
const { notFound, conflict } = require('../utils/errors');

class UserService {
  /**
   * PUBLIC_INTERFACE
   * Create user (admin only).
   */
  async create(tenantId, actorUserId, { email, name, roles = ['accountant'], password, active = true }) {
    /** This is a public function. */
    const existing = await db.list('users', { email }, { tenantId });
    if (existing.length > 0) throw conflict('Email already exists');
    const password_hash = await hashPassword(password || Math.random().toString(36).slice(2));
    const user = await db.insert('users', { email, name, roles, active, password_hash }, { tenantId, actorUserId });
    return this._mask(user);
  }

  /**
   * PUBLIC_INTERFACE
   * Get user by id.
   */
  async get(tenantId, id) {
    /** This is a public function. */
    const u = await db.getById('users', id, { tenantId });
    if (!u) throw notFound('User not found');
    return this._mask(u);
  }

  /**
   * PUBLIC_INTERFACE
   * List users.
   */
  async list(tenantId) {
    /** This is a public function. */
    const rows = await db.list('users', {}, { tenantId });
    return rows.map((u) => this._mask(u));
  }

  /**
   * PUBLIC_INTERFACE
   * Update user metadata and roles.
   */
  async update(tenantId, actorUserId, id, { name, roles, active }) {
    /** This is a public function. */
    const u = await db.getById('users', id, { tenantId });
    if (!u) throw notFound('User not found');
    const patch = {
      name: name ?? u.name,
      roles: roles ?? u.roles,
      active: active ?? u.active,
    };
    const updated = await db.update('users', id, patch, { tenantId, actorUserId });
    return this._mask(updated);
  }

  /**
   * PUBLIC_INTERFACE
   * Delete user.
   */
  async remove(tenantId, actorUserId, id) {
    /** This is a public function. */
    const ok = await db.remove('users', id, { tenantId });
    if (!ok) throw notFound('User not found');
    return { success: true };
  }

  _mask(user) {
    // Map DB column to API shape by removing password_hash
    const { password_hash, ...rest } = user;
    return rest;
  }
}

module.exports = new UserService();
