'use strict';

const repo = require('../repositories/memory');
const { hashPassword } = require('../utils/auth');
const { notFound, conflict } = require('../utils/errors');

class UserService {
  /**
   * PUBLIC_INTERFACE
   * Create user (admin only).
   */
  async create(tenantId, actorUserId, { email, name, roles = ['accountant'], password, active = true }) {
    /** This is a public function. */
    const existing = repo.list(tenantId, 'users', { email })[0];
    if (existing) throw conflict('Email already exists');
    const passwordHash = await hashPassword(password || Math.random().toString(36).slice(2));
    const user = repo.create(tenantId, 'users', { email, name, roles, active, passwordHash, _actorUserId: actorUserId });
    return this._mask(user);
  }

  /**
   * PUBLIC_INTERFACE
   * Get user by id.
   */
  async get(tenantId, id) {
    /** This is a public function. */
    const u = repo.getById(tenantId, 'users', id);
    if (!u) throw notFound('User not found');
    return this._mask(u);
  }

  /**
   * PUBLIC_INTERFACE
   * List users.
   */
  async list(tenantId) {
    /** This is a public function. */
    return repo.list(tenantId, 'users').map((u) => this._mask(u));
  }

  /**
   * PUBLIC_INTERFACE
   * Update user metadata and roles.
   */
  async update(tenantId, actorUserId, id, { name, roles, active }) {
    /** This is a public function. */
    const u = repo.getById(tenantId, 'users', id);
    if (!u) throw notFound('User not found');
    const updated = repo.update(tenantId, 'users', id, { name: name ?? u.name, roles: roles ?? u.roles, active: active ?? u.active, _actorUserId: actorUserId });
    return this._mask(updated);
  }

  /**
   * PUBLIC_INTERFACE
   * Delete user.
   */
  async remove(tenantId, actorUserId, id) {
    /** This is a public function. */
    const ok = repo.delete(tenantId, 'users', id, actorUserId);
    if (!ok) throw notFound('User not found');
    return { success: true };
  }

  _mask(user) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

module.exports = new UserService();
