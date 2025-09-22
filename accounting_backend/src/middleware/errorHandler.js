'use strict';
/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
// PUBLIC_INTERFACE
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  let status = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = 'Resource not found';
    code = 'NOT_FOUND';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    status = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_RESOURCE';
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    status = 400;
    message = 'Invalid reference';
    code = 'INVALID_REFERENCE';
  } else if (err.code === '23502') { // PostgreSQL not null violation
    status = 400;
    message = 'Required field missing';
    code = 'REQUIRED_FIELD_MISSING';
  }

  // Custom error properties
  if (err.status) {
    status = err.status;
  }
  if (err.message) {
    message = err.message;
  }
  if (err.code) {
    code = err.code;
  }

  // Send error response
  res.status(status).json({
    status: 'error',
    message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Not found middleware - handles 404 errors
 */
// PUBLIC_INTERFACE
const notFoundHandler = (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
