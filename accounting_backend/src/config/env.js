'use strict';

/**
 * Centralized environment configuration.
 * NOTE: Do not hardcode secrets here; values are read from process.env.
 * Provide a .env.example for required variables.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD', // For local/dev only
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer: process.env.JWT_ISSUER || 'sl-accounting-suite',
    audience: process.env.JWT_AUDIENCE || 'sl-accounting-frontend',
  },
  security: {
    passwordSaltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),
  },
  compliance: {
    country: 'LK',
    currencyDefault: 'LKR',
    // Sri Lankan VAT/NBT/SSCL placeholders
    vatStandardRate: parseFloat(process.env.LK_VAT_STANDARD_RATE || '0.15'),
  },
};

module.exports = config;
