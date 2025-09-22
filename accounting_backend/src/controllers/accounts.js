const db = require('../config/database');

class AccountsController {
  /**
   * Get all accounts for a company (chart of accounts)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getAccounts(req, res) {
    try {
      const accountsQuery = `
        WITH RECURSIVE account_hierarchy AS (
          -- Base case: root accounts (no parent)
          SELECT id, company_id, code, name, type, parent_account_id, 
                 balance, is_active, created_at, updated_at,
                 ARRAY[code] as path, 0 as level
          FROM accounts 
          WHERE company_id = $1 AND parent_account_id IS NULL AND is_active = true
          
          UNION ALL
          
          -- Recursive case: child accounts
          SELECT a.id, a.company_id, a.code, a.name, a.type, a.parent_account_id,
                 a.balance, a.is_active, a.created_at, a.updated_at,
                 ah.path || a.code, ah.level + 1
          FROM accounts a
          INNER JOIN account_hierarchy ah ON a.parent_account_id = ah.id
          WHERE a.company_id = $1 AND a.is_active = true
        )
        SELECT * FROM account_hierarchy 
        ORDER BY path, code
      `;
      
      const accountsResult = await db.query(accountsQuery, [req.companyId]);

      res.json({
        status: 'success',
        data: {
          accounts: accountsResult.rows,
          companyId: req.companyId
        }
      });

    } catch (error) {
      console.error('Get accounts error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get accounts',
        code: 'GET_ACCOUNTS_ERROR'
      });
    }
  }

  /**
   * Create a new account
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async createAccount(req, res) {
    try {
      const { code, name, type, parent_account_id, description } = req.body;

      // Check if account code already exists for this company
      const existingAccountQuery = 'SELECT id FROM accounts WHERE company_id = $1 AND code = $2';
      const existingAccountResult = await db.query(existingAccountQuery, [req.companyId, code]);

      if (existingAccountResult.rows.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Account code already exists for this company',
          code: 'ACCOUNT_CODE_EXISTS'
        });
      }

      // Validate parent account if provided
      if (parent_account_id) {
        const parentAccountQuery = 'SELECT id, type FROM accounts WHERE id = $1 AND company_id = $2 AND is_active = true';
        const parentAccountResult = await db.query(parentAccountQuery, [parent_account_id, req.companyId]);

        if (parentAccountResult.rows.length === 0) {
          return res.status(400).json({
            status: 'error',
            message: 'Parent account not found',
            code: 'PARENT_ACCOUNT_NOT_FOUND'
          });
        }

        // Validate that account type is compatible with parent
        const parentType = parentAccountResult.rows[0].type;
        if (parentType !== type) {
          return res.status(400).json({
            status: 'error',
            message: 'Account type must match parent account type',
            code: 'ACCOUNT_TYPE_MISMATCH'
          });
        }
      }

      // Create account
      const createAccountQuery = `
        INSERT INTO accounts (company_id, code, name, type, parent_account_id, description, balance, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 0.00, true, NOW())
        RETURNING id, company_id, code, name, type, parent_account_id, description, balance, is_active, created_at
      `;
      
      const createAccountResult = await db.query(createAccountQuery, [
        req.companyId,
        code,
        name,
        type,
        parent_account_id,
        description
      ]);

      const newAccount = createAccountResult.rows[0];

      res.status(201).json({
        status: 'success',
        message: 'Account created successfully',
        data: {
          account: newAccount
        }
      });

    } catch (error) {
      console.error('Create account error:', error);
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          status: 'error',
          message: 'Account code already exists',
          code: 'ACCOUNT_CODE_EXISTS'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to create account',
        code: 'CREATE_ACCOUNT_ERROR'
      });
    }
  }

  /**
   * Get account details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getAccount(req, res) {
    try {
      const { accountId } = req.params;

      const accountQuery = `
        SELECT a.*, pa.name as parent_account_name
        FROM accounts a
        LEFT JOIN accounts pa ON a.parent_account_id = pa.id
        WHERE a.id = $1 AND a.company_id = $2 AND a.is_active = true
      `;
      
      const accountResult = await db.query(accountQuery, [accountId, req.companyId]);

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Account not found',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      res.json({
        status: 'success',
        data: {
          account: accountResult.rows[0]
        }
      });

    } catch (error) {
      console.error('Get account error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get account',
        code: 'GET_ACCOUNT_ERROR'
      });
    }
  }

  /**
   * Update account
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async updateAccount(req, res) {
    try {
      const { accountId } = req.params;
      const { name, description } = req.body;

      // Check if account exists and belongs to company
      const existingAccountQuery = 'SELECT id FROM accounts WHERE id = $1 AND company_id = $2 AND is_active = true';
      const existingAccountResult = await db.query(existingAccountQuery, [accountId, req.companyId]);

      if (existingAccountResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Account not found',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      // Update account
      const updateAccountQuery = `
        UPDATE accounts 
        SET name = $1, description = $2, updated_at = NOW()
        WHERE id = $3 AND company_id = $4
        RETURNING id, company_id, code, name, type, parent_account_id, description, balance, is_active, updated_at
      `;
      
      const updateAccountResult = await db.query(updateAccountQuery, [
        name,
        description,
        accountId,
        req.companyId
      ]);

      res.json({
        status: 'success',
        message: 'Account updated successfully',
        data: {
          account: updateAccountResult.rows[0]
        }
      });

    } catch (error) {
      console.error('Update account error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update account',
        code: 'UPDATE_ACCOUNT_ERROR'
      });
    }
  }
}

module.exports = new AccountsController();
