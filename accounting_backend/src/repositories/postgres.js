'use strict';

/**
 * Postgres repository layer implementing multi-tenant row-level isolation in code.
 * NOTE: This is an application-level isolation. For production, consider DB-level RLS policies.
 */

const { Pool } = require('pg');

const REQUIRED_ENV_VARS = [
  'PG_HOST',
  'PG_PORT',
  'PG_DATABASE',
  'PG_USER',
  'PG_PASSWORD',
];

function requireEnv() {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

requireEnv();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  max: Number(process.env.PG_POOL_MAX || '10'),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || '2000'),
});

/**
 * Build WHERE clause parts and values for filtering by tenant/company
 */
function buildWhere(filter = {}, opts = {}) {
  const where = [];
  const values = [];
  let i = 1;

  // Enforce tenant scope always
  if (opts.tenantId) {
    where.push(`tenant_id = $${i++}`);
    values.push(opts.tenantId);
  }
  // Optional company scope for company-scoped entities
  if (opts.companyId !== undefined && opts.companyScoped) {
    where.push(`company_id = $${i++}`);
    values.push(opts.companyId);
  }

  Object.entries(filter).forEach(([k, v]) => {
    if (v === undefined) return;
    where.push(`${k} = $${i++}`);
    values.push(v);
  });

  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { sql, values };
}

/**
 * Insert helper
 */
async function insert(table, data, { tenantId, actorUserId }) {
  const cols = Object.keys(data);
  const vals = Object.values(data);

  // ensure tenant_id present
  if (!('tenant_id' in data)) {
    cols.push('tenant_id');
    vals.push(tenantId);
  }
  // audit columns
  cols.push('created_by');
  vals.push(actorUserId || null);

  const placeholders = cols.map((_, idx) => `$${idx + 1}`);
  const text = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
  const res = await pool.query(text, vals);
  return res.rows[0];
}

/**
 * Update helper
 */
async function update(table, id, patch, { tenantId, actorUserId }) {
  const cols = Object.keys(patch).filter((k) => patch[k] !== undefined);
  const sets = [];
  const values = [];
  let i = 1;
  for (const c of cols) {
    sets.push(`${c} = $${i++}`);
    values.push(patch[c]);
  }
  sets.push('updated_at = NOW()');
  if (actorUserId) {
    sets.push('updated_by = $' + i++);
    values.push(actorUserId);
  }
  values.push(tenantId);
  values.push(id);
  const text = `UPDATE ${table} SET ${sets.join(', ')} WHERE tenant_id = $${i - 1} AND id = $${i} RETURNING *`;
  const res = await pool.query(text, values);
  return res.rows[0] || null;
}

/**
 * Delete helper (soft or hard). Default hard delete here.
 */
async function remove(table, id, { tenantId }) {
  const res = await pool.query(`DELETE FROM ${table} WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
  return res.rowCount > 0;
}

/**
 * Get by id
 */
async function getById(table, id, { tenantId }) {
  const res = await pool.query(`SELECT * FROM ${table} WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
  return res.rows[0] || null;
}

/**
 * List with filter
 */
async function list(table, filter = {}, { tenantId, companyId, companyScoped = false } = {}) {
  const { sql, values } = buildWhere(filter, { tenantId, companyId, companyScoped });
  const res = await pool.query(`SELECT * FROM ${table} ${sql} ORDER BY id ASC`, values);
  return res.rows;
}

/**
 * Upsert by unique filter
 */
async function upsert(table, where, data, { tenantId, actorUserId }) {
  // Simple pattern: try get, then update else insert
  const items = await list(table, where, { tenantId });
  if (items.length > 0) {
    const id = items[0].id;
    return update(table, id, data, { tenantId, actorUserId });
  }
  return insert(table, { ...data }, { tenantId, actorUserId });
}

/**
 * Ledger post helper for balances
 */
async function upsertLedgerBalance({ tenantId, companyId, accountId, entry }) {
  const composite = `${companyId}:${accountId}`;
  // ensure a ledger_balances table exists with id (text) primary key
  const existing = await pool.query(
    'SELECT * FROM ledger_balances WHERE tenant_id = $1 AND id = $2',
    [tenantId, composite]
  );
  let balance = 0;
  let entries = [];
  if (existing.rows.length > 0) {
    balance = Number(existing.rows[0].balance || 0);
    entries = existing.rows[0].entries || [];
  }
  const nextBal = Number((balance + entry.debit - entry.credit).toFixed(2));
  const nextEntries = [...entries, { ...entry, balance: nextBal }];

  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE ledger_balances SET balance = $1, entries = $2, updated_at = NOW() WHERE tenant_id = $3 AND id = $4',
      [nextBal, JSON.stringify(nextEntries), tenantId, composite]
    );
  } else {
    await pool.query(
      'INSERT INTO ledger_balances (id, tenant_id, company_id, account_id, balance, entries) VALUES ($1, $2, $3, $4, $5, $6)',
      [composite, tenantId, companyId, accountId, nextBal, JSON.stringify(nextEntries)]
    );
  }
  return { balance: nextBal, entries: nextEntries };
}

module.exports = {
  pool,
  insert,
  update,
  remove,
  getById,
  list,
  upsert,
  upsertLedgerBalance,
};
