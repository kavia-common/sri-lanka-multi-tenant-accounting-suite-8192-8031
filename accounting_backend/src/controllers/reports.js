const ReportingService = require('../services/ReportingService');

class ReportsController {
  /**
   * Generate trial balance report (basic)
   * Query: start_date?, end_date?
   */
  // PUBLIC_INTERFACE
  async getTrialBalance(req, res) {
    try {
      const { start_date, end_date } = req.query;
      const data = await ReportingService.getTrialBalance(req.companyId, { start_date, end_date });
      res.json({
        status: 'success',
        data: {
          ...data,
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
      res.status(error.status || 500).json({
        status: 'error',
        message: 'Failed to generate trial balance',
        code: 'TRIAL_BALANCE_ERROR'
      });
    }
  }

  /**
   * Generate balance sheet report (basic)
   * Query: as_of_date?
   */
  // PUBLIC_INTERFACE
  async getBalanceSheet(req, res) {
    try {
      const { as_of_date } = req.query;
      const data = await ReportingService.getBalanceSheet(req.companyId, { as_of_date });
      res.json({
        status: 'success',
        data: {
          ...data,
          reportParams: {
            companyId: req.companyId,
            asOfDate: as_of_date,
            generatedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Balance sheet error:', error);
      res.status(error.status || 500).json({
        status: 'error',
        message: 'Failed to generate balance sheet',
        code: 'BALANCE_SHEET_ERROR'
      });
    }
  }

  /**
   * Generate profit and loss report (basic)
   * Query: start_date, end_date
   */
  // PUBLIC_INTERFACE
  async getProfitLoss(req, res) {
    try {
      const { start_date, end_date } = req.query;
      const data = await ReportingService.getProfitLoss(req.companyId, { start_date, end_date });
      res.json({
        status: 'success',
        data: {
          ...data,
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
      const status = error.status || 500;
      res.status(status).json({
        status: 'error',
        message: status === 400 ? 'Start date and end date are required for P&L report' : 'Failed to generate profit & loss report',
        code: status === 400 ? 'DATE_RANGE_REQUIRED' : 'PROFIT_LOSS_ERROR'
      });
    }
  }
}

module.exports = new ReportsController();
