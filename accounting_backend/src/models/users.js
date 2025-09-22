const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * Users model: user accounts and company memberships.
 * Row-level security is enforced in queries by filtering on company_id through membership checks.
 */

// PUBLIC_INTERFACE
async function findUserByEmail(email) {
  const { rows } = await db.query(
    `SELECT id, email, password_hash, first_name, last_name, created_at
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

// PUBLIC_INTERFACE
async function createUser({ email, password, first_name, last_name }) {
  const password_hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, first_name, last_name, created_at`,
    [email, password_hash, first_name, last_name]
  );
  return rows[0];
}

// PUBLIC_INTERFACE
async function getUserCompanies(userId) {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.code, uc.role
       FROM user_companies uc
       JOIN companies c ON c.id = uc.company_id
      WHERE uc.user_id = $1
      ORDER BY c.name ASC`,
    [userId]
  );
  return rows;
}

/**
 * Verifies if the user has access to the given company and returns role string or null.
 */
// PUBLIC_INTERFACE
async function getUserRoleForCompany(userId, companyId) {
  const { rows } = await db.query(
    'SELECT role FROM user_companies WHERE user_id = $1 AND company_id = $2',
    [userId, companyId]
  );
  return rows[0]?.role || null;
}

module.exports = {
  findUserByEmail,
  createUser,
  getUserCompanies,
  getUserRoleForCompany,
};
