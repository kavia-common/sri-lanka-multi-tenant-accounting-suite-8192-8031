const { body, param, query } = require('express-validator');

const createAccountValidation = [
  body('code')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Account code is required and must be less than 20 characters'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Account name is required and must be less than 100 characters'),
  body('type')
    .isIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
    .withMessage('Account type must be one of: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE'),
  body('parent_account_id')
    .optional()
    .isUUID()
    .withMessage('Parent account ID must be a valid UUID'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
];

const createTransactionValidation = [
  body('date')
    .isISO8601()
    .withMessage('Valid date in ISO format required'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description is required and must be less than 500 characters'),
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference must be less than 100 characters'),
  body('entries')
    .isArray({ min: 2 })
    .withMessage('At least 2 journal entries required for double-entry bookkeeping'),
  body('entries.*.account_id')
    .isUUID()
    .withMessage('Valid account ID required for each entry'),
  body('entries.*.debit_amount')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Debit amount must be a valid decimal with up to 2 decimal places'),
  body('entries.*.credit_amount')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Credit amount must be a valid decimal with up to 2 decimal places'),
  body('entries.*.description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Entry description must be less than 200 characters'),
];

const reportDateValidation = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO format'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO format'),
  query('company_id')
    .optional()
    .isUUID()
    .withMessage('Company ID must be a valid UUID'),
];

module.exports = {
  createAccountValidation,
  createTransactionValidation,
  reportDateValidation,
};
