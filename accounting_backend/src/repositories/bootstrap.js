'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('./postgres');

/**
 * PUBLIC_INTERFACE
 * Initialize database schema by executing schema.sql idempotently.
 */
async function initSchema() {
  /** This is a public function. */
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
}

module.exports = {
  initSchema,
};
