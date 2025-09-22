const db = require('../config/database');

/**
 * Company context middleware - validates user access to company and sets company context
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
// PUBLIC_INTERFACE
const validateCompanyAccess = async (req, res, next) => {
  try {
    // Get company_id from header, body, or query params
    const companyId = req.headers['x-company-id'] || req.body.company_id || req.query.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: 'error',
        message: 'Company ID is required',
        code: 'COMPANY_ID_MISSING'
      });
    }

    // Validate that user has access to this company
    const accessQuery = `
      SELECT c.id, c.name, c.code, uc.role, uc.permissions
      FROM companies c
      INNER JOIN user_companies uc ON c.id = uc.company_id
      WHERE c.id = $1 AND uc.user_id = $2 AND c.is_active = true
    `;
    
    const accessResult = await db.query(accessQuery, [companyId, req.user.userId]);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to company',
        code: 'COMPANY_ACCESS_DENIED'
      });
    }

    // Set company context in request
    req.company = accessResult.rows[0];
    req.companyId = companyId;
    
    next();
  } catch (error) {
    console.error('Company context error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to validate company access',
      code: 'COMPANY_CONTEXT_ERROR'
    });
  }
};

/**
 * Optional company context middleware - sets company context if provided
 */
// PUBLIC_INTERFACE
const optionalCompanyContext = async (req, res, next) => {
  try {
    const companyId = req.headers['x-company-id'] || req.body.company_id || req.query.company_id;

    if (companyId) {
      // Validate access if company ID is provided
      return validateCompanyAccess(req, res, next);
    }

    // Continue without company context
    next();
  } catch (error) {
    console.error('Optional company context error:', error);
    next(); // Continue even if there's an error
  }
};

module.exports = {
  validateCompanyAccess,
  optionalCompanyContext,
};
