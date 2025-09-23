'use strict';

class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST', details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFound(message = 'Resource not found', details) {
  return new AppError(message, 404, 'NOT_FOUND', details);
}

function unauthorized(message = 'Unauthorized') {
  return new AppError(message, 401, 'UNAUTHORIZED');
}

function forbidden(message = 'Forbidden') {
  return new AppError(message, 403, 'FORBIDDEN');
}

function conflict(message = 'Conflict', details) {
  return new AppError(message, 409, 'CONFLICT', details);
}

module.exports = {
  AppError,
  notFound,
  unauthorized,
  forbidden,
  conflict,
};
