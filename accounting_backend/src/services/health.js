const { pool } = require('../repositories/postgres');

class HealthService {
  async getStatus() {
    let db = 'unknown';
    try {
      await pool.query('SELECT 1');
      db = 'ok';
    } catch (e) {
      db = 'error';
    }
    return {
      status: 'ok',
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: db,
    };
  }
}

module.exports = new HealthService();
