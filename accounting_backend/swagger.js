const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sri Lanka Multi-tenant Accounting API',
      version: '1.0.0',
      description: 'REST API for multi-tenant accounting with double-entry bookkeeping and Sri Lankan compliance.',
    },
    tags: [
      { name: 'Auth', description: 'Authentication' },
      { name: 'Users', description: 'User management' },
      { name: 'Companies', description: 'Companies under a tenant' },
      { name: 'ChartOfAccounts', description: 'Chart of Accounts' },
      { name: 'JournalEntries', description: 'Journal entries' },
      { name: 'GeneralLedger', description: 'Ledger and reports' },
      { name: 'Masters', description: 'Customers, Vendors, Bank Accounts, Tax Rates, Currencies' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
