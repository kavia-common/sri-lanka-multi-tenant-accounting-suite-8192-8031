'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.security.passwordSaltRounds);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signJwt(payload, opts = {}) {
  const base = {
    iss: config.jwt.issuer,
    aud: config.jwt.audience,
  };
  return jwt.sign({ ...base, ...payload }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    ...opts,
  });
}

function verifyJwt(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

module.exports = {
  hashPassword,
  comparePassword,
  signJwt,
  verifyJwt,
};
