'use strict';

const repo = require('../repositories/memory');
const { hashPassword, comparePassword, signJwt } = require('../utils/auth');
const { conflict, notFound, unauthorized } = require('../utils/errors');

class AuthService {
  /**
   * PUBLIC_INTERFACE
   * Register a user within a tenant. First user can be admin.
   */
  async register({ tenantId, email, password, name, roles = ['admin'] }) {
    /** This is a public function. */
    const existing = repo.list(tenantId, 'users', { email })[0];
    if (existing) throw conflict('Email already registered');

    const passwordHash = await hashPassword(password);
    const user = repo.create(tenantId, 'users', {
      email,
      name,
      passwordHash,
      roles,
      active: true,
    });

    return { id: user.id, email: user.email, name: user.name, roles: user.roles, active: user.active };
  }

  /**
   * PUBLIC_INTERFACE
   * Login and get a JWT. Optionally scope to a companyId for multi-company tenants.
   */
  async login({ tenantId, email, password, companyId = null }) {
    /** This is a public function. */
    const user = repo.list(tenantId, 'users', { email })[0];
    if (!user) throw notFound('User not found');
    if (!user.active) throw unauthorized('User is inactive');
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid credentials');

    if (companyId) {
      const company = repo.getById(tenantId, 'companies', companyId);
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
