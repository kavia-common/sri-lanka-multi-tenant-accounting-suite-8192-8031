'use strict';
/**
 * Master data models for multi-tenant entities:
 * - Customers
 * - Vendors
 * - Bank Accounts
 * - Tax Rates
 * - Currencies
 *
 * Each table is scoped by company_id to enforce multi-tenancy and row-level security.
 * All public functions are documented and prefixed with PUBLIC_INTERFACE comments.
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/** Helper: standard pagination clamp */
function clampPagination({ page = 1, limit = 50 }) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;
  return { page: safePage, limit: safeLimit, offset };
}

/** Helper: trim and normalize strings */
function normStr(s) {
  if (s == null) return null;
  const v = String(s).trim();
  return v.length ? v : null;
}

/** Enforces RLS by always filtering by company_id on reads/updates/deletes */
async function rlsGetAll(table, companyId, { page, limit, q } = {}) {
  const { offset, limit: safeLimit, page: safePage } = clampPagination({ page, limit });
  const params = [companyId];
  let where = 'company_id = ?';
  if (q && String(q).trim()) {
    where += ' AND (LOWER(name) LIKE ? OR LOWER(code) LIKE ?)';
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like);
  }
  // Total
  const [countRows] = await db.execute(
    `SELECT COUNT(1) as cnt FROM ${table} WHERE ${where}`,
    params
  );
  const total = countRows[0]?.cnt || 0;
  // Data
  const [rows] = await db.execute(
    `SELECT * FROM ${table} WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
}

async function rlsGetById(table, companyId, id) {
  const [rows] = await db.execute(
    `SELECT * FROM ${table} WHERE id = ? AND company_id = ? LIMIT 1`,
    [id, companyId]
  );
  return rows[0] || null;
}

async function rlsCreate(table, companyId, payload) {
  const id = uuidv4();
  const now = new Date();
  const record = { id, company_id: companyId, created_at: now, updated_at: now, ...payload };
  const columns = Object.keys(record);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((k) => record[k]);
  await db.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return await rlsGetById(table, companyId, id);
}

async function rlsUpdate(table, companyId, id, payload) {
  const now = new Date();
  const entries = Object.entries({ ...payload, updated_at: now })
    .filter(([_, v]) => v !== undefined);
  if (!entries.length) {
    return await rlsGetById(table, companyId, id);
  }
  const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([_, v]) => v);
  const [res] = await db.execute(
    `UPDATE ${table} SET ${setClause} WHERE id = ? AND company_id = ?`,
    [...values, id, companyId]
  );
  if (res.affectedRows === 0) return null;
  return await rlsGetById(table, companyId, id);
}

async function rlsDelete(table, companyId, id) {
  const [res] = await db.execute(
    `DELETE FROM ${table} WHERE id = ? AND company_id = ?`,
    [id, companyId]
  );
  return res.affectedRows > 0;
}

// Tables
const TABLES = {
  CUSTOMERS: 'customers',
  VENDORS: 'vendors',
  BANK_ACCOUNTS: 'bank_accounts',
  TAX_RATES: 'tax_rates',
  CURRENCIES: 'currencies',
};

/**
 * Shapes incoming payloads with safe normalization per entity type.
 */
const shape = {
  customer: (p = {}) => ({
    code: normStr(p.code),
    name: normStr(p.name),
    email: normStr(p.email),
    phone: normStr(p.phone),
    address: normStr(p.address),
    tax_number: normStr(p.tax_number),
    is_active: p.is_active === undefined ? true : !!p.is_active,
  }),
  vendor: (p = {}) => ({
    code: normStr(p.code),
    name: normStr(p.name),
    email: normStr(p.email),
    phone: normStr(p.phone),
    address: normStr(p.address),
    tax_number: normStr(p.tax_number),
    is_active: p.is_active === undefined ? true : !!p.is_active,
  }),
  bank: (p = {}) => ({
    bank_name: normStr(p.bank_name),
    account_name: normStr(p.account_name),
    account_number: normStr(p.account_number),
    currency_code: normStr(p.currency_code),
    is_active: p.is_active === undefined ? true : !!p.is_active,
  }),
  tax: (p = {}) => ({
    code: normStr(p.code),
    name: normStr(p.name),
    rate: p.rate != null ? Number(p.rate) : null,
    type: normStr(p.type) || 'VAT', // VAT, NBT, WHT etc.
    is_active: p.is_active === undefined ? true : !!p.is_active,
  }),
  currency: (p = {}) => ({
    code: normStr(p.code), // LKR, USD
    name: normStr(p.name),
    symbol: normStr(p.symbol),
    decimal_places: p.decimal_places != null ? Math.min(4, Math.max(0, Number(p.decimal_places))) : 2,
    is_active: p.is_active === undefined ? true : !!p.is_active,
  }),
};

// PUBLIC_INTERFACE
async function listCustomers(companyId, { page, limit, q } = {}) {
  /** List customers for a company with pagination. */
  return await rlsGetAll(TABLES.CUSTOMERS, companyId, { page, limit, q });
}

// PUBLIC_INTERFACE
async function getCustomerById(companyId, id) {
  /** Get a customer by id, enforcing row-level security via company_id. */
  return await rlsGetById(TABLES.CUSTOMERS, companyId, id);
}

// PUBLIC_INTERFACE
async function createCustomer(companyId, payload) {
  /** Create a customer under the current company context. */
  const record = shape.customer(payload);
  return await rlsCreate(TABLES.CUSTOMERS, companyId, record);
}

// PUBLIC_INTERFACE
async function updateCustomer(companyId, id, payload) {
  /** Update a customer under the current company context. */
  const record = shape.customer(payload);
  return await rlsUpdate(TABLES.CUSTOMERS, companyId, id, record);
}

// PUBLIC_INTERFACE
async function deleteCustomer(companyId, id) {
  /** Delete a customer under the current company context. */
  return await rlsDelete(TABLES.CUSTOMERS, companyId, id);
}

// PUBLIC_INTERFACE
async function listVendors(companyId, { page, limit, q } = {}) {
  /** List vendors for a company with pagination. */
  return await rlsGetAll(TABLES.VENDORS, companyId, { page, limit, q });
}

// PUBLIC_INTERFACE
async function getVendorById(companyId, id) {
  /** Get a vendor by id under RLS. */
  return await rlsGetById(TABLES.VENDORS, companyId, id);
}

// PUBLIC_INTERFACE
async function createVendor(companyId, payload) {
  /** Create a vendor under the company context. */
  const record = shape.vendor(payload);
  return await rlsCreate(TABLES.VENDORS, companyId, record);
}

// PUBLIC_INTERFACE
async function updateVendor(companyId, id, payload) {
  /** Update a vendor under the company context. */
  const record = shape.vendor(payload);
  return await rlsUpdate(TABLES.VENDORS, companyId, id, record);
}

// PUBLIC_INTERFACE
async function deleteVendor(companyId, id) {
  /** Delete a vendor under the company context. */
  return await rlsDelete(TABLES.VENDORS, companyId, id);
}

// PUBLIC_INTERFACE
async function listBankAccounts(companyId, { page, limit, q } = {}) {
  /** List bank accounts; q searches by bank/account names or numbers. */
  const { offset, limit: safeLimit, page: safePage } = clampPagination({ page, limit });
  const params = [companyId];
  let where = 'company_id = ?';
  if (q && String(q).trim()) {
    where += ' AND (LOWER(bank_name) LIKE ? OR LOWER(account_name) LIKE ? OR account_number LIKE ?)';
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, String(q));
  }
  const [countRows] = await db.execute(`SELECT COUNT(1) as cnt FROM ${TABLES.BANK_ACCOUNTS} WHERE ${where}`, params);
  const total = countRows[0]?.cnt || 0;
  const [rows] = await db.execute(
    `SELECT * FROM ${TABLES.BANK_ACCOUNTS} WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
}

// PUBLIC_INTERFACE
async function getBankAccountById(companyId, id) {
  /** Get bank account by id under RLS. */
  return await rlsGetById(TABLES.BANK_ACCOUNTS, companyId, id);
}

// PUBLIC_INTERFACE
async function createBankAccount(companyId, payload) {
  /** Create bank account under company. */
  const record = shape.bank(payload);
  return await rlsCreate(TABLES.BANK_ACCOUNTS, companyId, record);
}

// PUBLIC_INTERFACE
async function updateBankAccount(companyId, id, payload) {
  /** Update bank account under company. */
  const record = shape.bank(payload);
  return await rlsUpdate(TABLES.BANK_ACCOUNTS, companyId, id, record);
}

// PUBLIC_INTERFACE
async function deleteBankAccount(companyId, id) {
  /** Delete bank account under company. */
  return await rlsDelete(TABLES.BANK_ACCOUNTS, companyId, id);
}

// PUBLIC_INTERFACE
async function listTaxRates(companyId, { page, limit, q } = {}) {
  /** List tax rates; supports query by code/name/type. */
  const { offset, limit: safeLimit, page: safePage } = clampPagination({ page, limit });
  const params = [companyId];
  let where = 'company_id = ?';
  if (q && String(q).trim()) {
    where += ' AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(type) LIKE ?)';
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like);
  }
  const [countRows] = await db.execute(`SELECT COUNT(1) as cnt FROM ${TABLES.TAX_RATES} WHERE ${where}`, params);
  const total = countRows[0]?.cnt || 0;
  const [rows] = await db.execute(
    `SELECT * FROM ${TABLES.TAX_RATES} WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
}

// PUBLIC_INTERFACE
async function getTaxRateById(companyId, id) {
  /** Get tax rate by id under RLS. */
  return await rlsGetById(TABLES.TAX_RATES, companyId, id);
}

// PUBLIC_INTERFACE
async function createTaxRate(companyId, payload) {
  /** Create a tax rate under company; supports Sri Lankan VAT/NBT/WHT mapping. */
  const record = shape.tax(payload);
  return await rlsCreate(TABLES.TAX_RATES, companyId, record);
}

// PUBLIC_INTERFACE
async function updateTaxRate(companyId, id, payload) {
  /** Update a tax rate under company. */
  const record = shape.tax(payload);
  return await rlsUpdate(TABLES.TAX_RATES, companyId, id, record);
}

// PUBLIC_INTERFACE
async function deleteTaxRate(companyId, id) {
  /** Delete a tax rate under company. */
  return await rlsDelete(TABLES.TAX_RATES, companyId, id);
}

// PUBLIC_INTERFACE
async function listCurrencies(companyId, { page, limit, q } = {}) {
  /** List currencies configured for the company. */
  const { offset, limit: safeLimit, page: safePage } = clampPagination({ page, limit });
  const params = [companyId];
  let where = 'company_id = ?';
  if (q && String(q).trim()) {
    where += ' AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ?)';
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like);
  }
  const [countRows] = await db.execute(`SELECT COUNT(1) as cnt FROM ${TABLES.CURRENCIES} WHERE ${where}`, params);
  const total = countRows[0]?.cnt || 0;
  const [rows] = await db.execute(
    `SELECT * FROM ${TABLES.CURRENCIES} WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
}

// PUBLIC_INTERFACE
async function getCurrencyById(companyId, id) {
  /** Get currency by id under RLS. */
  return await rlsGetById(TABLES.CURRENCIES, companyId, id);
}

// PUBLIC_INTERFACE
async function createCurrency(companyId, payload) {
  /** Create a currency under company. */
  const record = shape.currency(payload);
  return await rlsCreate(TABLES.CURRENCIES, companyId, record);
}

// PUBLIC_INTERFACE
async function updateCurrency(companyId, id, payload) {
  /** Update a currency under company. */
  const record = shape.currency(payload);
  return await rlsUpdate(TABLES.CURRENCIES, companyId, id, record);
}

// PUBLIC_INTERFACE
async function deleteCurrency(companyId, id) {
  /** Delete a currency under company. */
  return await rlsDelete(TABLES.CURRENCIES, companyId, id);
}

module.exports = {
  TABLES,
  // Customers
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  // Vendors
  listVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  // Bank Accounts
  listBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  // Tax Rates
  listTaxRates,
  getTaxRateById,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  // Currencies
  listCurrencies,
  getCurrencyById,
  createCurrency,
  updateCurrency,
  deleteCurrency,
};
