const db = require('../config/database');

class TransactionsController {
  /**
   * Get all transactions for a company
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getTransactions(req, res) {
    try {
      const { page = 1, limit = 50, start_date, end_date } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE t.company_id = $1';
      let queryParams = [req.companyId];
      let paramIndex = 2;

      if (start_date) {
        whereClause += ` AND t.date >= $${paramIndex}`;
        queryParams.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereClause += ` AND t.date <= $${paramIndex}`;
        queryParams.push(end_date);
        paramIndex++;
      }

      const transactionsQuery = `
        SELECT t.id, t.date, t.description, t.reference, t.total_amount, t.created_at,
               COUNT(je.id) as entry_count
        FROM transactions t
        LEFT JOIN journal_entries je ON t.id = je.transaction_id
        ${whereClause}
        GROUP BY t.id, t.date, t.description, t.reference, t.total_amount, t.created_at
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const transactionsResult = await db.query(transactionsQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT t.id) as total
        FROM transactions t
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, queryParams.slice(0, -2));

      res.json({
        status: 'success',
        data: {
          transactions: transactionsResult.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countResult.rows[0].total),
            totalPages: Math.ceil(countResult.rows[0].total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get transactions',
        code: 'GET_TRANSACTIONS_ERROR'
      });
    }
  }

  /**
   * Create a new transaction with journal entries
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async createTransaction(req, res) {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      const { date, description, reference, entries } = req.body;

      // Validate double-entry bookkeeping: debits must equal credits
      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of entries) {
        if (entry.debit_amount) {
          totalDebits += parseFloat(entry.debit_amount);
        }
        if (entry.credit_amount) {
          totalCredits += parseFloat(entry.credit_amount);
        }
      }

      if (Math.abs(totalDebits - totalCredits) > 0.01) { // Allow for small rounding differences
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'Total debits must equal total credits',
          code: 'UNBALANCED_TRANSACTION',
          details: {
            totalDebits: totalDebits.toFixed(2),
            totalCredits: totalCredits.toFixed(2),
            difference: (totalDebits - totalCredits).toFixed(2)
          }
        });
      }

      // Validate that all accounts exist and belong to the company
      for (const entry of entries) {
        const accountQuery = 'SELECT id FROM accounts WHERE id = $1 AND company_id = $2 AND is_active = true';
        const accountResult = await client.query(accountQuery, [entry.account_id, req.companyId]);

        if (accountResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: `Account ${entry.account_id} not found or inactive`,
            code: 'ACCOUNT_NOT_FOUND'
          });
        }
      }

      // Create transaction
      const createTransactionQuery = `
        INSERT INTO transactions (company_id, date, description, reference, total_amount, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, company_id, date, description, reference, total_amount, created_at
      `;

      const totalAmount = Math.max(totalDebits, totalCredits);
      const transactionResult = await client.query(createTransactionQuery, [
        req.companyId,
        date,
        description,
        reference,
        totalAmount
      ]);

      const transaction = transactionResult.rows[0];

      // Create journal entries
      const journalEntries = [];
      for (const entry of entries) {
        const createEntryQuery = `
          INSERT INTO journal_entries (transaction_id, account_id, debit_amount, credit_amount, description, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING id, transaction_id, account_id, debit_amount, credit_amount, description, created_at
        `;

        const entryResult = await client.query(createEntryQuery, [
          transaction.id,
          entry.account_id,
          entry.debit_amount || 0,
          entry.credit_amount || 0,
          entry.description || description
        ]);

        journalEntries.push(entryResult.rows[0]);

        // Update account balance
        const balanceChange = (entry.debit_amount || 0) - (entry.credit_amount || 0);
        const updateBalanceQuery = `
          UPDATE accounts 
          SET balance = balance + $1, updated_at = NOW()
          WHERE id = $2 AND company_id = $3
        `;
        await client.query(updateBalanceQuery, [balanceChange, entry.account_id, req.companyId]);
      }

      await client.query('COMMIT');

      res.status(201).json({
        status: 'success',
        message: 'Transaction created successfully',
        data: {
          transaction: {
            ...transaction,
            entries: journalEntries
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create transaction error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create transaction',
        code: 'CREATE_TRANSACTION_ERROR'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get transaction details with journal entries
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getTransaction(req, res) {
    try {
      const { transactionId } = req.params;

      // Get transaction details
      const transactionQuery = `
        SELECT id, company_id, date, description, reference, total_amount, created_at, updated_at
        FROM transactions
        WHERE id = $1 AND company_id = $2
      `;
      
      const transactionResult = await db.query(transactionQuery, [transactionId, req.companyId]);

      if (transactionResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Transaction not found',
          code: 'TRANSACTION_NOT_FOUND'
        });
      }

      const transaction = transactionResult.rows[0];

      // Get journal entries
      const entriesQuery = `
        SELECT je.id, je.account_id, je.debit_amount, je.credit_amount, je.description, je.created_at,
               a.code as account_code, a.name as account_name
        FROM journal_entries je
        INNER JOIN accounts a ON je.account_id = a.id
        WHERE je.transaction_id = $1
        ORDER BY je.created_at
      `;
      
      const entriesResult = await db.query(entriesQuery, [transactionId]);

      res.json({
        status: 'success',
        data: {
          transaction: {
            ...transaction,
            entries: entriesResult.rows
          }
        }
      });

    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get transaction',
        code: 'GET_TRANSACTION_ERROR'
      });
    }
  }
}

module.exports = new TransactionsController();
