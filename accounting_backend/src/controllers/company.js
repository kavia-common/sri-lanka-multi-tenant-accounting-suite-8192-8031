const db = require('../config/database');

class CompanyController {
  /**
   * Get all companies for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getCompanies(req, res) {
    try {
      const companiesQuery = `
        SELECT c.id, c.name, c.code, c.email, c.phone, c.address, c.tax_number,
               c.created_at, c.updated_at, uc.role, uc.permissions
        FROM companies c
        INNER JOIN user_companies uc ON c.id = uc.company_id
        WHERE uc.user_id = $1 AND c.is_active = true
        ORDER BY c.name
      `;
      
      const companiesResult = await db.query(companiesQuery, [req.user.userId]);

      res.json({
        status: 'success',
        data: {
          companies: companiesResult.rows
        }
      });

    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get companies',
        code: 'GET_COMPANIES_ERROR'
      });
    }
  }

  /**
   * Create a new company
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async createCompany(req, res) {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      const { name, code, email, phone, address, tax_number } = req.body;

      // Check if company code already exists
      const existingCompanyQuery = 'SELECT id FROM companies WHERE code = $1';
      const existingCompanyResult = await client.query(existingCompanyQuery, [code]);

      if (existingCompanyResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          status: 'error',
          message: 'Company code already exists',
          code: 'COMPANY_CODE_EXISTS'
        });
      }

      // Create company
      const createCompanyQuery = `
        INSERT INTO companies (name, code, email, phone, address, tax_number, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
        RETURNING id, name, code, email, phone, address, tax_number, created_at
      `;
      
      const createCompanyResult = await client.query(createCompanyQuery, [
        name, code, email, phone, address, tax_number
      ]);

      const newCompany = createCompanyResult.rows[0];

      // Add user as company owner
      const addUserCompanyQuery = `
        INSERT INTO user_companies (user_id, company_id, role, permissions, created_at)
        VALUES ($1, $2, 'OWNER', '["ALL"]', NOW())
      `;
      
      await client.query(addUserCompanyQuery, [req.user.userId, newCompany.id]);

      // Create default chart of accounts for the company
      await this.createDefaultChartOfAccounts(client, newCompany.id);

      await client.query('COMMIT');

      res.status(201).json({
        status: 'success',
        message: 'Company created successfully',
        data: {
          company: {
            ...newCompany,
            role: 'OWNER',
            permissions: ['ALL']
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create company error:', error);
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          status: 'error',
          message: 'Company with this code already exists',
          code: 'COMPANY_CODE_EXISTS'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to create company',
        code: 'CREATE_COMPANY_ERROR'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get company details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getCompany(req, res) {
    try {
      const { companyId } = req.params;

      const companyQuery = `
        SELECT c.id, c.name, c.code, c.email, c.phone, c.address, c.tax_number,
               c.created_at, c.updated_at, uc.role, uc.permissions
        FROM companies c
        INNER JOIN user_companies uc ON c.id = uc.company_id
        WHERE c.id = $1 AND uc.user_id = $2 AND c.is_active = true
      `;
      
      const companyResult = await db.query(companyQuery, [companyId, req.user.userId]);

      if (companyResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Company not found or access denied',
          code: 'COMPANY_NOT_FOUND'
        });
      }

      res.json({
        status: 'success',
        data: {
          company: companyResult.rows[0]
        }
      });

    } catch (error) {
      console.error('Get company error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get company',
        code: 'GET_COMPANY_ERROR'
      });
    }
  }

  /**
   * Create default chart of accounts for a new company
   * @param {Object} client - Database client
   * @param {string} companyId - Company ID
   */
  async createDefaultChartOfAccounts(client, companyId) {
    const defaultAccounts = [
      // Assets
      { code: '1000', name: 'Current Assets', type: 'ASSET', parent_code: null },
      { code: '1100', name: 'Cash and Cash Equivalents', type: 'ASSET', parent_code: '1000' },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', parent_code: '1000' },
      { code: '1300', name: 'Inventory', type: 'ASSET', parent_code: '1000' },
      { code: '1400', name: 'Prepaid Expenses', type: 'ASSET', parent_code: '1000' },
      
      // Fixed Assets
      { code: '1500', name: 'Fixed Assets', type: 'ASSET', parent_code: null },
      { code: '1510', name: 'Equipment', type: 'ASSET', parent_code: '1500' },
      { code: '1520', name: 'Furniture & Fixtures', type: 'ASSET', parent_code: '1500' },
      
      // Liabilities
      { code: '2000', name: 'Current Liabilities', type: 'LIABILITY', parent_code: null },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parent_code: '2000' },
      { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY', parent_code: '2000' },
      { code: '2300', name: 'Short-term Loans', type: 'LIABILITY', parent_code: '2000' },
      
      // Equity
      { code: '3000', name: 'Equity', type: 'EQUITY', parent_code: null },
      { code: '3100', name: 'Owner\'s Equity', type: 'EQUITY', parent_code: '3000' },
      { code: '3200', name: 'Retained Earnings', type: 'EQUITY', parent_code: '3000' },
      
      // Revenue
      { code: '4000', name: 'Revenue', type: 'REVENUE', parent_code: null },
      { code: '4100', name: 'Sales Revenue', type: 'REVENUE', parent_code: '4000' },
      { code: '4200', name: 'Service Revenue', type: 'REVENUE', parent_code: '4000' },
      
      // Expenses
      { code: '5000', name: 'Operating Expenses', type: 'EXPENSE', parent_code: null },
      { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parent_code: '5000' },
      { code: '5200', name: 'Office Expenses', type: 'EXPENSE', parent_code: '5000' },
      { code: '5300', name: 'Marketing Expenses', type: 'EXPENSE', parent_code: '5000' },
    ];

    // Create accounts with proper parent relationships
    const accountMap = new Map();
    
    for (const account of defaultAccounts) {
      let parentAccountId = null;
      
      if (account.parent_code) {
        parentAccountId = accountMap.get(account.parent_code);
      }

      const insertAccountQuery = `
        INSERT INTO accounts (company_id, code, name, type, parent_account_id, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, true, NOW())
        RETURNING id
      `;
      
      const result = await client.query(insertAccountQuery, [
        companyId,
        account.code,
        account.name,
        account.type,
        parentAccountId
      ]);

      accountMap.set(account.code, result.rows[0].id);
    }
  }
}

module.exports = new CompanyController();
