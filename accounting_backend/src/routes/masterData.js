'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const companyContext = require('../middleware/companyContext');

const {
  listCustomersCtrl, getCustomerCtrl, createCustomerCtrl, updateCustomerCtrl, deleteCustomerCtrl,
  listVendorsCtrl, getVendorCtrl, createVendorCtrl, updateVendorCtrl, deleteVendorCtrl,
  listBankAccountsCtrl, getBankAccountCtrl, createBankAccountCtrl, updateBankAccountCtrl, deleteBankAccountCtrl,
  listTaxRatesCtrl, getTaxRateCtrl, createTaxRateCtrl, updateTaxRateCtrl, deleteTaxRateCtrl,
  listCurrenciesCtrl, getCurrencyCtrl, createCurrencyCtrl, updateCurrencyCtrl, deleteCurrencyCtrl,
} = require('../controllers/masterData');

// All routes here require auth and company header for multi-tenancy
router.use(rateLimiter);
router.use(auth);
router.use(companyContext);

// Customers
router.get('/customers', listCustomersCtrl);
router.get('/customers/:id', getCustomerCtrl);
router.post('/customers', createCustomerCtrl);
router.put('/customers/:id', updateCustomerCtrl);
router.delete('/customers/:id', deleteCustomerCtrl);

// Vendors
router.get('/vendors', listVendorsCtrl);
router.get('/vendors/:id', getVendorCtrl);
router.post('/vendors', createVendorCtrl);
router.put('/vendors/:id', updateVendorCtrl);
router.delete('/vendors/:id', deleteVendorCtrl);

// Bank Accounts
router.get('/bank-accounts', listBankAccountsCtrl);
router.get('/bank-accounts/:id', getBankAccountCtrl);
router.post('/bank-accounts', createBankAccountCtrl);
router.put('/bank-accounts/:id', updateBankAccountCtrl);
router.delete('/bank-accounts/:id', deleteBankAccountCtrl);

// Tax Rates
router.get('/tax-rates', listTaxRatesCtrl);
router.get('/tax-rates/:id', getTaxRateCtrl);
router.post('/tax-rates', createTaxRateCtrl);
router.put('/tax-rates/:id', updateTaxRateCtrl);
router.delete('/tax-rates/:id', deleteTaxRateCtrl);

// Currencies
router.get('/currencies', listCurrenciesCtrl);
router.get('/currencies/:id', getCurrencyCtrl);
router.post('/currencies', createCurrencyCtrl);
router.put('/currencies/:id', updateCurrencyCtrl);
router.delete('/currencies/:id', deleteCurrencyCtrl);

module.exports = router;
