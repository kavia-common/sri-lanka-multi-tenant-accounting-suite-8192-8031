const db = require('../config/database');

class ReportsController {
  /**
   * Generate trial balance report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getTrialBalance(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      let dateFilter = '';
      let queryParams = [req.companyId];
      let paramIndex = 2;

      if (start_date && end_date) {
        dateFilter = `
          AND je.created_at >= $${paramIndex} 
          AND je.created_at <= $${paramIndex + 1}
        `;
        queryParams.push(start_date, end_date);
      }

      const trialBalanceQuery = `
        SELECT 
          a.id,
          a.code,
          a.name,
          a.type,
          COALESCE(SUM(je.debit_amount), 0) as total_debits,
          COALESCE(SUM(je.credit_amount), 0) as total_credits,
          COALESCE(SUM(je.debit_amount), 0) - COALESCE(SUM(je.credit_amount), 0) as balance
        FROM accounts a
        LEFT JOIN journal_entries je ON a.id = je.account_id ${dateFilter}
        WHERE a.company_id = $1 AND a.is_active = true
        GROUP BY a.id, a.code, a.name, a.type
        HAVING 
          COALESCE(SUM(je.debit_amount), 0) != 0 
          OR COALESCE(SUM(je.credit_amount), 0) != 0
          OR a.balance != 0
        ORDER BY a.code
      `;

      const trialBalanceResult = await db.query(trialBalanceQuery, queryParams);

      // Calculate totals
      let totalDebits = 0;
      let totalCredits = 0;

      trialBalanceResult.rows.forEach(account => {
        totalDebits += parseFloat(account.total_debits);
        totalCredits += parseFloat(account.total_credits);
      });

      res.json({
        status: 'success',
        data: {
          trialBalance: trialBalanceResult.rows,
          summary: {
            totalDebits: totalDebits.toFixed(2),
            totalCredits: totalCredits.toFixed(2),
            isBalanced: Math.abs(totalDebits - totalCredits) < 0.01
          },
          reportParams: {
            companyId: req.companyId,
            startDate: start_date,
            endDate: end_date,
            generatedAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Trial balance error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate trial balance',
        code: 'TRIAL_BALANCE_ERROR'
      });
    }
  }

  /**
   * Generate balance sheet report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getBalanceSheet(req, res) {
    try {
      const { as_of_date = new Date().toISOString().split('T')[0] } = req.query;

      const balanceSheetQuery = `
        SELECT 
          a.id,
          a.code,
          a.name,
          a.type,
          a.parent_account_id,
          COALESCE(SUM(
            CASE 
              WHEN a.type IN ('ASSET', 'EXPENSE') THEN je.debit_amount - je.credit_amount
              ELSE je.credit_amount - je.debit_amount
            END
          ), 0) + a.balance as current_balance
        FROM accounts a
        LEFT JOIN journal_entries je ON a.id = je.account_id 
          AND DATE(je.created_at) <= $2
        WHERE a.company_id = $1 
          AND a.is_active = true 
          AND a.type IN ('ASSET', 'LIABILITY', 'EQUITY')
        GROUP BY a.id, a.code, a.name, a.type, a.parent_account_id, a.balance
        ORDER BY a.type, a.code
      `;

      const balanceSheetResult = await db.query(balanceSheetQuery, [req.companyId, as_of_date]);

      // Organize by account type
      const balanceSheet = {
        assets: [],
        liabilities: [],
        equity: []
      };

      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;

      balanceSheetResult.rows.forEach(account => {
        const balance = parseFloat(account.current_balance);
        
        if (account.type === 'ASSET') {
          balanceSheet.assets.push(account);
          totalAssets += balance;
        } else if (account.type === 'LIABILITY') {
          balanceSheet.liabilities.push(account);
          totalLiabilities += balance;
        } else if (account.type === 'EQUITY') {
          balanceSheet.equity.push(account);
          totalEquity += balance;
        }
      });

      res.json({
        status: 'success',
        data: {
          balanceSheet,
          summary: {
            totalAssets: totalAssets.toFixed(2),
            totalLiabilities: totalLiabilities.toFixed(2),
            totalEquity: totalEquity.toFixed(2),
            isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
          },
          reportParams: {
            companyId: req.companyId,
            asOfDate: as_of_date,
            generatedAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Balance sheet error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate balance sheet',
        code: 'BALANCE_SHEET_ERROR'
      });
    }
  }

  /**
   * Generate profit and loss report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getProfitLoss(req, res) {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({
          status: 'error',
          message: 'Start date and end date are required for P&L report',
          code: 'DATE_RANGE_REQUIRED'
        });
      }

      const profitLossQuery = `
        SELECT 
          a.id,
          a.code,
          a.name,
          a.type,
          COALESCE(SUM(
            CASE 
              WHEN a.type = 'REVENUE' THEN je.credit_amount - je.debit_amount
              WHEN a.type = 'EXPENSE' THEN je.debit_amount - je.credit_amount
              ELSE 0
            END
          ), 0) as amount
        FROM accounts a
        LEFT JOIN journal_entries je ON a.id = je.account_id
          AND DATE(je.created_at) >= $2
          AND DATE(je.created_at) <= $3
        WHERE a.company_id = $1 
          AND a.is_active = true 
          AND a.type IN ('REVENUE', 'EXPENSE')
        GROUP BY a.id, a.code, a.name, a.type
        HAVING COALESCE(SUM(
          CASE 
            WHEN a.type = 'REVENUE' THEN je.credit_amount - je.debit_amount
            WHEN a.type = 'EXPENSE' THEN je.debit_amount - je.credit_amount
            ELSE 0
          END
        ), 0) != 0
        ORDER BY a.type DESC, a.code
      `;

      const profitLossResult = await db.query(profitLossQuery, [req.companyId, start_date, end_date]);

      // Organize by account type
      const profitLoss = {
        revenue: [],
        expenses: []
      };

      let totalRevenue = 0;
      let totalExpenses = 0;

      profitLossResult.rows.forEach(account => {
        const amount = parseFloat(account.amount);
        
        if (account.type === 'REVENUE') {
          profitLoss.revenue.push(account);
          totalRevenue += amount;
        } else if (account.type === 'EXPENSE') {
          profitLoss.expenses.push(account);
          totalExpenses += amount;
        }
      });

      const netIncome = totalRevenue - totalExpenses;

      res.json({
        status: 'success',
        data: {
          profitLoss,
          summary: {
            totalRevenue: totalRevenue.toFixed(2),
            totalExpenses: totalExpenses.toFixed(2),
            netIncome: netIncome.toFixed(2),
            netIncomePercent: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : '0.00'
          },
          reportParams: {
            companyId: req.companyId,
            startDate: start_date,
            endDate: end_date,
            generatedAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Profit & Loss error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate profit & loss report',
        code: 'PROFIT_LOSS_ERROR'
      });
    }
  }
}

module.exports = new ReportsController();
