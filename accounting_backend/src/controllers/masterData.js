'use strict';
/**
 * Controllers for master data entities: customers, vendors, bank accounts, tax rates, currencies.
 * These controllers enforce:
 * - Auth (via upstream middleware)
 * - Company context (x-company-id) via middleware
 * - Row-level security (company_id scoped queries)
 * - Validation and standardized responses
 *
 * Swagger/OpenAPI documentation is composed at route definitions via swagger.js setup.
 */

const {
  listCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer,
  listVendors, getVendorById, createVendor, updateVendor, deleteVendor,
  listBankAccounts, getBankAccountById, createBankAccount, updateBankAccount, deleteBankAccount,
  listTaxRates, getTaxRateById, createTaxRate, updateTaxRate, deleteTaxRate,
  listCurrencies, getCurrencyById, createCurrency, updateCurrency, deleteCurrency,
} = require('../models/masterData');

// Helpers
function ok(res, data = {}, message = 'OK') {
  return res.status(200).json({ status: 'success', message, data });
}
function created(res, data = {}, message = 'Created') {
  return res.status(201).json({ status: 'success', message, data });
}
function notFound(res, message = 'Not found') {
  return res.status(404).json({ status: 'error', message });
}
function badRequest(res, message = 'Bad request', errors) {
  return res.status(400).json({ status: 'error', message, errors });
}
function forbidden(res, message = 'Forbidden') {
  return res.status(403).json({ status: 'error', message });
}

// PUBLIC_INTERFACE
async function listCustomersCtrl(req, res, next) {
  /** List customers for a company (paginated). */
  try {
    const companyId = req.company?.id;
    if (!companyId) return forbidden(res, 'Company context missing');
    const { page, limit, q } = req.query;
    const result = await listCustomers(companyId, { page, limit, q });
    return ok(res, { customers: result.rows, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function getCustomerCtrl(req, res, next) {
  /** Get a single customer. */
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await getCustomerById(companyId, id);
    if (!record) return notFound(res, 'Customer not found');
    return ok(res, { customer: record });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function createCustomerCtrl(req, res, next) {
  /** Create a customer. */
  try {
    const companyId = req.company?.id;
    if (!companyId) return forbidden(res, 'Company context missing');
    const { name } = req.body || {};
    if (!name) return badRequest(res, 'Customer name is required');
    const record = await createCustomer(companyId, req.body);
    return created(res, { customer: record }, 'Customer created');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function updateCustomerCtrl(req, res, next) {
  /** Update a customer. */
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await updateCustomer(companyId, id, req.body);
    if (!record) return notFound(res, 'Customer not found');
    return ok(res, { customer: record }, 'Customer updated');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function deleteCustomerCtrl(req, res, next) {
  /** Delete a customer. */
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const okDel = await deleteCustomer(companyId, id);
    if (!okDel) return notFound(res, 'Customer not found');
    return ok(res, {}, 'Customer deleted');
  } catch (err) {
    next(err);
  }
}

// Vendors
// PUBLIC_INTERFACE
async function listVendorsCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { page, limit, q } = req.query;
    const result = await listVendors(companyId, { page, limit, q });
    return ok(res, { vendors: result.rows, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function getVendorCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await getVendorById(companyId, id);
    if (!record) return notFound(res, 'Vendor not found');
    return ok(res, { vendor: record });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function createVendorCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { name } = req.body || {};
    if (!name) return badRequest(res, 'Vendor name is required');
    const record = await createVendor(companyId, req.body);
    return created(res, { vendor: record }, 'Vendor created');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function updateVendorCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await updateVendor(companyId, id, req.body);
    if (!record) return notFound(res, 'Vendor not found');
    return ok(res, { vendor: record }, 'Vendor updated');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function deleteVendorCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const okDel = await deleteVendor(companyId, id);
    if (!okDel) return notFound(res, 'Vendor not found');
    return ok(res, {}, 'Vendor deleted');
  } catch (err) {
    next(err);
  }
}

// Bank Accounts
// PUBLIC_INTERFACE
async function listBankAccountsCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { page, limit, q } = req.query;
    const result = await listBankAccounts(companyId, { page, limit, q });
    return ok(res, { bankAccounts: result.rows, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function getBankAccountCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await getBankAccountById(companyId, id);
    if (!record) return notFound(res, 'Bank account not found');
    return ok(res, { bankAccount: record });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function createBankAccountCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { bank_name, account_name, account_number } = req.body || {};
    if (!bank_name || !account_name || !account_number) {
      return badRequest(res, 'bank_name, account_name and account_number are required');
    }
    const record = await createBankAccount(companyId, req.body);
    return created(res, { bankAccount: record }, 'Bank account created');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function updateBankAccountCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await updateBankAccount(companyId, id, req.body);
    if (!record) return notFound(res, 'Bank account not found');
    return ok(res, { bankAccount: record }, 'Bank account updated');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function deleteBankAccountCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const okDel = await deleteBankAccount(companyId, id);
    if (!okDel) return notFound(res, 'Bank account not found');
    return ok(res, {}, 'Bank account deleted');
  } catch (err) {
    next(err);
  }
}

// Tax Rates
// PUBLIC_INTERFACE
async function listTaxRatesCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { page, limit, q } = req.query;
    const result = await listTaxRates(companyId, { page, limit, q });
    return ok(res, { taxRates: result.rows, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function getTaxRateCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await getTaxRateById(companyId, id);
    if (!record) return notFound(res, 'Tax rate not found');
    return ok(res, { taxRate: record });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function createTaxRateCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { rate } = req.body || {};
    if (rate == null) return badRequest(res, 'name and rate are required');
    const numericRate = Number(rate);
    if (Number.isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      return badRequest(res, 'rate must be a percentage between 0 and 100');
    }
    const record = await createTaxRate(companyId, { ...req.body, rate: numericRate });
    return created(res, { taxRate: record }, 'Tax rate created');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function updateTaxRateCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const patch = { ...req.body };
    if (patch.rate != null) {
      const numericRate = Number(patch.rate);
      if (Number.isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
        return badRequest(res, 'rate must be a percentage between 0 and 100');
      }
      patch.rate = numericRate;
    }
    const record = await updateTaxRate(companyId, id, patch);
    if (!record) return notFound(res, 'Tax rate not found');
    return ok(res, { taxRate: record }, 'Tax rate updated');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function deleteTaxRateCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const okDel = await deleteTaxRate(companyId, id);
    if (!okDel) return notFound(res, 'Tax rate not found');
    return ok(res, {}, 'Tax rate deleted');
  } catch (err) {
    next(err);
  }
}

// Currencies
// PUBLIC_INTERFACE
async function listCurrenciesCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { page, limit, q } = req.query;
    const result = await listCurrencies(companyId, { page, limit, q });
    return ok(res, { currencies: result.rows, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function getCurrencyCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await getCurrencyById(companyId, id);
    if (!record) return notFound(res, 'Currency not found');
    return ok(res, { currency: record });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function createCurrencyCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { code, name } = req.body || {};
    if (!code || !name) return badRequest(res, 'code and name are required');
    const record = await createCurrency(companyId, req.body);
    return created(res, { currency: record }, 'Currency created');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function updateCurrencyCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const record = await updateCurrency(companyId, id, req.body);
    if (!record) return notFound(res, 'Currency not found');
    return ok(res, { currency: record }, 'Currency updated');
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function deleteCurrencyCtrl(req, res, next) {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const okDel = await deleteCurrency(companyId, id);
    if (!okDel) return notFound(res, 'Currency not found');
    return ok(res, {}, 'Currency deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // Customers
  listCustomersCtrl,
  getCustomerCtrl,
  createCustomerCtrl,
  updateCustomerCtrl,
  deleteCustomerCtrl,
  // Vendors
  listVendorsCtrl,
  getVendorCtrl,
  createVendorCtrl,
  updateVendorCtrl,
  deleteVendorCtrl,
  // Bank Accounts
  listBankAccountsCtrl,
  getBankAccountCtrl,
  createBankAccountCtrl,
  updateBankAccountCtrl,
  deleteBankAccountCtrl,
  // Tax Rates
  listTaxRatesCtrl,
  getTaxRateCtrl,
  createTaxRateCtrl,
  updateTaxRateCtrl,
  deleteTaxRateCtrl,
  // Currencies
  listCurrenciesCtrl,
  getCurrencyCtrl,
  createCurrencyCtrl,
  updateCurrencyCtrl,
  deleteCurrencyCtrl,
};
