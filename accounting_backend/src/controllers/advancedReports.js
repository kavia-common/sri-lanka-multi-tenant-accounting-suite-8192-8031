const ReportingService = require('../services/ReportingService');
const ExcelService = require('../services/ExcelService');

class AdvancedReportsController {
  /**
   * PUBLIC_INTERFACE
   * Generate Trial Balance with optional drill-down and zero-balance inclusion.
   * Query: start_date?, end_date?, include_zero?, drilldown?, format?=json|xlsx
   */
  async trialBalance(req, res) {
    try {
      const { start_date, end_date, include_zero, drilldown, format } = req.query;
      const data = await ReportingService.getTrialBalance(req.companyId, {
        start_date,
        end_date,
        include_zero: include_zero === 'true',
        drilldown: drilldown === 'true',
      });

      if ((format || '').toLowerCase() === 'xlsx') {
        const buffer = await ExcelService.buildTrialBalanceWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date, end_date },
          data,
        });
        const fileName = `trial-balance_${start_date || 'start'}_${end_date || 'end'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('trialBalance error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate trial balance' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Generate Balance Sheet with optional comparative period.
   * Query: as_of_date?, comparative?, compare_as_of_date?, format?=json|xlsx
   */
  async balanceSheet(req, res) {
    try {
      const { as_of_date, comparative, compare_as_of_date, format } = req.query;
      const data = await ReportingService.getBalanceSheet(req.companyId, {
        as_of_date,
        comparative: comparative === 'true',
        compare_as_of_date,
      });

      if ((format || '').toLowerCase() === 'xlsx') {
        const buffer = await ExcelService.buildBalanceSheetWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { as_of_date },
          data,
        });
        const fileName = `balance-sheet_${as_of_date || 'as-of-today'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('balanceSheet error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate balance sheet' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Generate Profit & Loss with optional comparative and drilldown.
   * Query: start_date, end_date, comparative?, compare_start_date?, compare_end_date?, drilldown?, format?=json|xlsx
   */
  async profitLoss(req, res) {
    try {
      const { start_date, end_date, comparative, compare_start_date, compare_end_date, drilldown, format } = req.query;
      const data = await ReportingService.getProfitLoss(req.companyId, {
        start_date,
        end_date,
        comparative: comparative === 'true',
        compare_start_date,
        compare_end_date,
        drilldown: drilldown === 'true',
      });

      if ((format || '').toLowerCase() === 'xlsx') {
        const buffer = await ExcelService.buildProfitLossWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date, end_date },
          data,
        });
        const fileName = `profit-loss_${start_date}_${end_date}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('profitLoss error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate profit & loss' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * General Ledger view with pagination and filters.
   * Query: start_date?, end_date?, account_id?, account_code?, page?, limit?, format?=json|xlsx
   */
  async generalLedger(req, res) {
    try {
      const { start_date, end_date, account_id, account_code, page, limit, format } = req.query;
      const data = await ReportingService.getGeneralLedger(req.companyId, {
        start_date,
        end_date,
        account_id,
        account_code,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      if ((format || '').toLowerCase() === 'xlsx') {
        const buffer = await ExcelService.buildLedgerWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date, end_date, account_id, account_code },
          data,
        });
        const fileName = `general-ledger_${start_date || 'all'}_${end_date || 'all'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('generalLedger error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate general ledger' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Cash Flow Statement (indirect method).
   * Query: start_date, end_date, format?=json|xlsx
   */
  async cashFlow(req, res) {
    try {
      const { start_date, end_date, format } = req.query;
      const data = await ReportingService.getCashFlow(req.companyId, { start_date, end_date });

      if ((format || '').toLowerCase() === 'xlsx') {
        const buffer = await ExcelService.buildCashFlowWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date, end_date },
          data,
        });
        const fileName = `cash-flow_${start_date}_${end_date}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('cashFlow error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate cash flow' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Statement of Changes in Equity.
   * Query: start_date, end_date, format?=json|xlsx
   */
  async changesInEquity(req, res) {
    try {
      const { start_date, end_date, format } = req.query;
      const data = await ReportingService.getChangesInEquity(req.companyId, { start_date, end_date });

      if ((format || '').toLowerCase() === 'xlsx') {
        const headers = ['Code', 'Name', 'Amount'];
        const rows = (data?.changesInEquity || []).map(l => [l.code, l.name, Number(l.amount || 0)]);
        const buffer = await ExcelService.buildSimpleKeyAmountWorkbook({
          title: 'Statement of Changes in Equity',
          company: req.company || { name: req.companyName || 'Company' },
          headers,
          rows,
          numberIndexes: [3],
          params: { start_date, end_date },
        });
        const fileName = `changes-in-equity_${start_date}_${end_date}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('changesInEquity error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate changes in equity' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Aged Receivables with default buckets (30/60/90/120).
   * Query: as_of_date?, buckets? (comma-separated), format?=json|xlsx
   */
  async agedReceivables(req, res) {
    try {
      const { as_of_date, buckets, format } = req.query;
      const parsedBuckets = buckets ? buckets.split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x)) : undefined;
      const data = await ReportingService.getAgedReceivables(req.companyId, { as_of_date, buckets: parsedBuckets });

      if ((format || '').toLowerCase() === 'xlsx') {
        const headers = ['Bucket', 'Amount'];
        const ar = data?.agedReceivables || {};
        const rows = [
          ['Current', Number(ar.current || 0)],
          [`${(parsedBuckets || [30])[0]}d`, Number(ar[`${(parsedBuckets || [30, 60, 90])[0]}d`] || 0)],
          [`${(parsedBuckets || [30, 60])[1] || 60}d`, Number(ar[`${(parsedBuckets || [30, 60])[1] || 60}d`] || 0)],
          [`${(parsedBuckets || [30, 60, 90])[2] || 90}d`, Number(ar[`${(parsedBuckets || [30, 60, 90])[2] || 90}d`] || 0)],
          ['Over', Number(ar.over || 0)],
        ];
        const buffer = await ExcelService.buildSimpleKeyAmountWorkbook({
          title: 'Aged Receivables',
          company: req.company || { name: req.companyName || 'Company' },
          headers,
          rows,
          numberIndexes: [2],
          params: { as_of_date },
        });
        const fileName = `aged-receivables_${as_of_date || 'as-of-today'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('agedReceivables error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate aged receivables' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Aged Payables with default buckets (30/60/90/120).
   * Query: as_of_date?, buckets? (comma-separated), format?=json|xlsx
   */
  async agedPayables(req, res) {
    try {
      const { as_of_date, buckets, format } = req.query;
      const parsedBuckets = buckets ? buckets.split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x)) : undefined;
      const data = await ReportingService.getAgedPayables(req.companyId, { as_of_date, buckets: parsedBuckets });

      if ((format || '').toLowerCase() === 'xlsx') {
        const headers = ['Bucket', 'Amount'];
        const ap = data?.agedPayables || {};
        const rows = [
          ['Current', Number(ap.current || 0)],
          [`${(parsedBuckets || [30])[0]}d`, Number(ap[`${(parsedBuckets || [30, 60, 90])[0]}d`] || 0)],
          [`${(parsedBuckets || [30, 60])[1] || 60}d`, Number(ap[`${(parsedBuckets || [30, 60])[1] || 60}d`] || 0)],
          [`${(parsedBuckets || [30, 60, 90])[2] || 90}d`, Number(ap[`${(parsedBuckets || [30, 60, 90])[2] || 90}d`] || 0)],
          ['Over', Number(ap.over || 0)],
        ];
        const buffer = await ExcelService.buildSimpleKeyAmountWorkbook({
          title: 'Aged Payables',
          company: req.company || { name: req.companyName || 'Company' },
          headers,
          rows,
          numberIndexes: [2],
          params: { as_of_date },
        });
        const fileName = `aged-payables_${as_of_date || 'as-of-today'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('agedPayables error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate aged payables' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Budget vs Actuals baseline (supports missing budgets table).
   * Query: start_date, end_date, format?=json|xlsx
   */
  async budgetVsActual(req, res) {
    try {
      const { start_date, end_date, format } = req.query;
      const data = await ReportingService.getBudgetVsActual(req.companyId, { start_date, end_date });

      if ((format || '').toLowerCase() === 'xlsx') {
        const headers = ['Code', 'Name', 'Type', 'Budget', 'Actual', 'Variance', 'Variance %'];
        const rows = (data?.budgetVsActual || []).map(l => [
          l.code, l.name, l.type,
          Number(l.budget || 0), Number(l.actual || 0),
          Number(l.variance || 0),
          l.variancePercent ? Number(l.variancePercent) / 100 : 0,
        ]);
        const buffer = await ExcelService.buildSimpleKeyAmountWorkbook({
          title: 'Budget vs Actuals',
          company: req.company || { name: req.companyName || 'Company' },
          headers,
          rows,
          numberIndexes: [4, 5, 6, 7],
          params: { start_date, end_date },
        });
        const fileName = `budget-vs-actual_${start_date}_${end_date}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (e) {
      console.error('budgetVsActual error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate budget vs actual' });
    }
  }
}

module.exports = new AdvancedReportsController();
