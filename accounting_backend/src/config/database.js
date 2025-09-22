const { Pool } = require('pg');

// DATABASE CONNECTION CONFIGURATION
// Using environment variables that will be set by the database container
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait when connecting
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0]);
    client.release();
  } catch (err) {
    console.error('Database connection test failed:', err);
  }
};

async function safeRollback(client) {
  if (!client) return;
  try {
    await client.query('ROLLBACK');
  } catch (e) {
    // ignore rollback errors
  }
}

module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  safeRollback,
};
