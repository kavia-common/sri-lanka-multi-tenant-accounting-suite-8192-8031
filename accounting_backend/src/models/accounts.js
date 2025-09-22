const db = require('../config/database');

/**
 * Accounts model: chart of accounts per company with code uniqueness and hierarchy.
 */

// PUBLIC_INTERFACE
async function listAccounts(companyId) {
  const { rows } = await db.query(
    `SELECT id, company_id, code, name, type, parent_account_id, description, balance, is_active, created_at
       FROM accounts
      WHERE company_id = $1
      ORDER BY code ASC`,
    [companyId]
  );
  return rows;
}

// PUBLIC_INTERFACE
async function createAccount(companyId, { code, name, type, parent_account_id, description }) {
  const { rows } = await db.query(
    `INSERT INTO accounts (company_id, code, name, type, parent_account_id, description, is_active, balance, created_at)
     VALUES ($1, UPPER($2), $3, $4, $5, $6, true, 0, NOW())
     RETURNING id, company_id, code, name, type, parent_account_id, description, balance, is_active, created_at`,
    [companyId, code, name, type, parent_account_id || null, description || null]
  );
  return rows[0];
}

// PUBLIC_INTERFACE
async function getAccount(companyId, accountId) {
  const { rows } = await db.query(
    `SELECT id, company_id, code, name, type, parent_account_id, description, balance, is_active, created_at
       FROM accounts
      WHERE id = $1 AND company_id = $2`,
    [accountId, companyId]
  );
  return rows[0] || null;
}

// PUBLIC_INTERFACE
async function updateAccount(companyId, accountId, { name, description }) {
  const { rows } = await db.query(
    `UPDATE accounts
        SET name = COALESCE($3, name),
            description = COALESCE($4, description),
            updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING id, company_id, code, name, type, parent_account_id, description, balance, is_active, created_at, updated_at`,
    [accountId, companyId, name || null, description || null]
  );
  return rows[0] || null;
}

// PUBLIC_INTERFACE
async function accountCodeExists(companyId, code) {
  const { rows } = await db.query(
    'SELECT 1 FROM accounts WHERE company_id = $1 AND code = UPPER($2)',
    [companyId, code]
  );
  return !!rows[0];
}

module.exports = {
  listAccounts,
  createAccount,
  getAccount,
  updateAccount,
  accountCodeExists,
};
