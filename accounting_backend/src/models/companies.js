const db = require('../config/database');

/**
 * Companies model: create and fetch companies, ensure unique company code.
 */

// PUBLIC_INTERFACE
async function createCompany({ name, code, email, phone, address, tax_number }) {
  const { rows } = await db.query(
    `INSERT INTO companies (name, code, email, phone, address, tax_number, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
     RETURNING id, name, code, email, phone, address, tax_number, created_at`,
    [name, code.toUpperCase(), email || null, phone || null, address || null, tax_number || null]
  );
  return rows[0];
}

// PUBLIC_INTERFACE
async function getCompanyById(companyId) {
  const { rows } = await db.query(
    `SELECT id, name, code, email, phone, address, tax_number, created_at
       FROM companies WHERE id = $1`,
    [companyId]
  );
  return rows[0] || null;
}

// PUBLIC_INTERFACE
async function companyCodeExists(code) {
  const { rows } = await db.query('SELECT 1 FROM companies WHERE code = $1', [code.toUpperCase()]);
  return !!rows[0];
}

// PUBLIC_INTERFACE
async function addOwnerMembership(userId, companyId) {
  await db.query(
    `INSERT INTO user_companies (user_id, company_id, role, created_at)
     VALUES ($1, $2, 'OWNER', NOW())
     ON CONFLICT (user_id, company_id) DO NOTHING`,
    [userId, companyId]
  );
}

module.exports = {
  createCompany,
  getCompanyById,
  companyCodeExists,
  addOwnerMembership,
};
