const { authenticateToken } = require('./auth');
const { validateCompanyAccess, optionalCompanyContext } = require('./companyContext');
const { handleValidationErrors } = require('./validation');
const { generalLimiter, authLimiter } = require('./rateLimiter');
const { errorHandler, notFoundHandler } = require('./errorHandler');

module.exports = {
  authenticateToken,
  validateCompanyAccess,
  optionalCompanyContext,
  handleValidationErrors,
  generalLimiter,
  authLimiter,
  errorHandler,
  notFoundHandler,
};
