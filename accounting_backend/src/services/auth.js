'use strict';

const db = require('../repositories/postgres');
const { hashPassword, comparePassword, signJwt } = require('../utils/auth');
const { conflict, notFound, unauthorized } = require('../utils/errors');

class AuthService {
  /**
   * PUBLIC_INTERFACE
   * Register a user within a tenant. First user can be admin.
   */
  async register({ tenantId, email, password, name, roles = ['admin'] }) {
    /** This is a public function. */
    const existing = await db.list('users', { email }, { tenantId });
    if (existing.length > 0) throw conflict('Email already registered');

    const password_hash = await hashPassword(password);
    const user = await db.insert('users', {
      email,
      name,
      password_hash,
      roles,
      active: true,
    }, { tenantId, actorUserId: null });

    return { id: user.id, email: user.email, name: user.name, roles: user.roles, active: user.active };
  }

  /**
   * PUBLIC_INTERFACE
   * Login and get a JWT. Optionally scope to a companyId for multi-company tenants.
   */
  async login({ tenantId, email, password, companyId = null }) {
    /** This is a public function. */
    const users = await db.list('users', { email }, { tenantId });
    const user = users[0];
    if (!user) throw notFound('User not found');
    if (!user.active) throw unauthorized('User is inactive');
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) throw unauthorized('Invalid credentials');

    if (companyId) {
      const company = await db.getById('companies', companyId, { tenantId });
      if (!company) throw notFound('Company not found for tenant');
    }

    const token = signJwt({
      sub: user.id,
      email: user.email,
      roles: user.roles || [],
      tenantId,
      companyId,
    });

    return { token, user: { id: user.id, email: user.email, name: user.name, roles: user.roles, companyId } };
  }
}

module.exports = new AuthService();
