const ReportingService = require('../services/ReportingService');

class AdvancedReportsController {
  /**
   * PUBLIC_INTERFACE
   * Generate Trial Balance with optional drill-down and zero-balance inclusion.
   * Query: start_date?, end_date?, include_zero?, drilldown?
   */
  async trialBalance(req, res) {
    try {
      const { start_date, end_date, include_zero, drilldown } = req.query;
      const data = await ReportingService.getTrialBalance(req.companyId, {
        start_date,
        end_date,
        include_zero: include_zero === 'true',
        drilldown: drilldown === 'true',
      });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('trialBalance error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate trial balance' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Generate Balance Sheet with optional comparative period.
   * Query: as_of_date?, comparative?, compare_as_of_date?
   */
  async balanceSheet(req, res) {
    try {
      const { as_of_date, comparative, compare_as_of_date } = req.query;
      const data = await ReportingService.getBalanceSheet(req.companyId, {
        as_of_date,
        comparative: comparative === 'true',
        compare_as_of_date,
      });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('balanceSheet error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate balance sheet' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Generate Profit & Loss with optional comparative and drilldown.
   * Query: start_date, end_date, comparative?, compare_start_date?, compare_end_date?, drilldown?
   */
  async profitLoss(req, res) {
    try {
      const { start_date, end_date, comparative, compare_start_date, compare_end_date, drilldown } = req.query;
      const data = await ReportingService.getProfitLoss(req.companyId, {
        start_date,
        end_date,
        comparative: comparative === 'true',
        compare_start_date,
        compare_end_date,
        drilldown: drilldown === 'true',
      });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('profitLoss error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate profit & loss' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * General Ledger view with pagination and filters.
   * Query: start_date?, end_date?, account_id?, account_code?, page?, limit?
   */
  async generalLedger(req, res) {
    try {
      const { start_date, end_date, account_id, account_code, page, limit } = req.query;
      const data = await ReportingService.getGeneralLedger(req.companyId, {
        start_date,
        end_date,
        account_id,
        account_code,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('generalLedger error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate general ledger' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Cash Flow Statement (indirect method).
   * Query: start_date, end_date
   */
  async cashFlow(req, res) {
    try {
      const { start_date, end_date } = req.query;
      const data = await ReportingService.getCashFlow(req.companyId, { start_date, end_date });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('cashFlow error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate cash flow' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Statement of Changes in Equity.
   * Query: start_date, end_date
   */
  async changesInEquity(req, res) {
    try {
      const { start_date, end_date } = req.query;
      const data = await ReportingService.getChangesInEquity(req.companyId, { start_date, end_date });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('changesInEquity error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate changes in equity' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Aged Receivables with default buckets (30/60/90/120).
   * Query: as_of_date?, buckets? (comma-separated)
   */
  async agedReceivables(req, res) {
    try {
      const { as_of_date, buckets } = req.query;
      const parsedBuckets = buckets ? buckets.split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x)) : undefined;
      const data = await ReportingService.getAgedReceivables(req.companyId, { as_of_date, buckets: parsedBuckets });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('agedReceivables error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate aged receivables' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Aged Payables with default buckets (30/60/90/120).
   * Query: as_of_date?, buckets? (comma-separated)
   */
  async agedPayables(req, res) {
    try {
      const { as_of_date, buckets } = req.query;
      const parsedBuckets = buckets ? buckets.split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x)) : undefined;
      const data = await ReportingService.getAgedPayables(req.companyId, { as_of_date, buckets: parsedBuckets });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('agedPayables error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate aged payables' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Budget vs Actuals baseline (supports missing budgets table).
   * Query: start_date, end_date
   */
  async budgetVsActual(req, res) {
    try {
      const { start_date, end_date } = req.query;
      const data = await ReportingService.getBudgetVsActual(req.companyId, { start_date, end_date });
      res.json({ status: 'success', data });
    } catch (e) {
      console.error('budgetVsActual error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate budget vs actual' });
    }
  }
}

module.exports = new AdvancedReportsController();
