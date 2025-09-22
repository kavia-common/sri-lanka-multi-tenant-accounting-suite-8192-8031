const { body, param } = require('express-validator');

const createCompanyValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Company name is required and must be less than 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .isAlphanumeric()
    .withMessage('Company code must be 2-10 alphanumeric characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email format required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('tax_number')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Tax number must be less than 50 characters'),
];

const companyParamValidation = [
  param('companyId')
    .isUUID()
    .withMessage('Valid company ID required'),
];

module.exports = {
  createCompanyValidation,
  companyParamValidation,
};
