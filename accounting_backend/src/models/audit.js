const db = require('../config/database');

/**
 * Audit model: record audit events if AUDIT_ENABLED is true.
 */
// PUBLIC_INTERFACE
async function recordAuditEvent({ userId, companyId, action, entity, entityId, details }) {
  if (process.env.AUDIT_ENABLED !== 'true') return;
  await db.query(
    `INSERT INTO audit_trail (user_id, company_id, action, entity, entity_id, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [userId || null, companyId || null, action, entity, entityId || null, details ? JSON.stringify(details) : null]
  );
}

module.exports = {
  recordAuditEvent,
};
