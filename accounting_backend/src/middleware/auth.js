'use strict';

const { verifyJwt } = require('../utils/auth');
const { unauthorized } = require('../utils/errors');

/**
 * Extract bearer token from Authorization header.
 */
function extractToken(req) {
  const hdr = req.headers['authorization'] || '';
  const parts = hdr.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

/**
 * PUBLIC_INTERFACE
 * Authenticate requests with JWT.
 * Adds req.user = { userId, email, roles, tenantId, companyId }
 */
function authenticate(req, res, next) {
  /** This is a public function. */
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized('Missing bearer token');
    const payload = verifyJwt(token);
    // Minimal payload validation
    if (!payload || !payload.sub || !payload.tenantId) {
      throw unauthorized('Invalid token payload');
    }
    req.user = {
      userId: payload.sub,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      tenantId: payload.tenantId,
      companyId: payload.companyId || null,
    };
    return next();
  } catch (e) {
    const status = e.status || 401;
    return res.status(status).json({ status: 'error', code: 'UNAUTHORIZED', message: e.message || 'Unauthorized' });
  }
}

/**
 * PUBLIC_INTERFACE
 * Enforce role-based authorization
 * Usage: authorize('admin') or authorize(['admin','accountant'])
 */
function authorize(requiredRoles) {
  /** This is a public function. */
  const needed = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Not authenticated' });
    const has = req.user.roles && needed.some((r) => req.user.roles.includes(r));
    if (!has) return res.status(403).json({ status: 'error', code: 'FORBIDDEN', message: 'Insufficient role' });
    return next();
  };
}

/**
 * PUBLIC_INTERFACE
 * Require a company context for tenant-scoped entities
 */
function requireCompany(req, res, next) {
  /** This is a public function. */
  if (!req.user?.companyId) {
    return res.status(400).json({ status: 'error', code: 'COMPANY_REQUIRED', message: 'Company context not set in token' });
  }
  return next();
}

module.exports = {
  authenticate,
  authorize,
  requireCompany,
};
