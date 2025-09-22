'use strict';

const ReportingService = require('../services/ReportingService');
const ExcelService = require('../services/ExcelService');

/**
 * AdvancedReportsController
 * Adds comparative analysis and budget vs actual across all reports.
 * Query params:
 *  - period[]: array of ISO dates or start..end ranges for primary period(s)
 *  - compare_to[]: array of ISO dates or ranges for comparative period(s)
 *  - fiscal_year: string e.g., 2024 (used when period is not specified) - service will map to start/end based on company fiscal setup (baseline: Jan-Dec)
 *  - budget_source: string e.g., 'table:budgets' or 'zero' or 'prior_year'
 *  - format: json|xlsx
 * For each report, emits actual, budget, variance, variancePercent columns in lines or summaries when applicable.
 */
class AdvancedReportsController {
  // PUBLIC_INTERFACE
  async trialBalance(req, res) {
    try {
      const { period, compare_to, budget_source, fiscal_year, format } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year),
        comparePeriods: normalizePeriods(compare_to, null),
        budget_source: budget_source || 'table:budgets',
      };
      const data = await ReportingService.getTrialBalanceAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        const buffer = await ExcelService.buildTrialBalanceWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date: data.meta?.base?.start_date, end_date: data.meta?.base?.end_date },
          data: data.payload,
        });
        const fileName = `trial-balance-adv_${data.meta?.base?.start_date || 'start'}_${data.meta?.base?.end_date || 'end'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced TB error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced trial balance', code: 'ADV_TB_ERROR' });
    }
  }

  // PUBLIC_INTERFACE
  async balanceSheet(req, res) {
    try {
      const { period, compare_to, budget_source, fiscal_year, format } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year, { balanceSheet: true }),
        comparePeriods: normalizePeriods(compare_to, null, { balanceSheet: true }),
        budget_source: budget_source || 'table:budgets',
      };
      const data = await ReportingService.getBalanceSheetAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        const buffer = await ExcelService.buildBalanceSheetWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { as_of_date: data.meta?.base?.as_of_date },
          data: data.payload,
        });
        const fileName = `balance-sheet-adv_${data.meta?.base?.as_of_date || 'as-of-today'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced BS error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced balance sheet', code: 'ADV_BS_ERROR' });
    }
  }

  // PUBLIC_INTERFACE
  async profitLoss(req, res) {
    try {
      const { period, compare_to, budget_source, fiscal_year, format } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year),
        comparePeriods: normalizePeriods(compare_to, null),
        budget_source: budget_source || 'table:budgets',
      };
      const data = await ReportingService.getProfitLossAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        const base = data.meta?.base || {};
        const buffer = await ExcelService.buildProfitLossWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date: base.start_date, end_date: base.end_date },
          data: data.payload,
        });
        const fileName = `profit-loss-adv_${base.start_date || 'start'}_${base.end_date || 'end'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced P&L error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced profit & loss', code: 'ADV_PL_ERROR' });
    }
  }

  // PUBLIC_INTERFACE
  async generalLedger(req, res) {
    try {
      const { period, compare_to, fiscal_year, format, account_id, account_code, page, limit } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year),
        comparePeriods: normalizePeriods(compare_to, null),
        paging: { page, limit },
        account_id,
        account_code,
      };
      const data = await ReportingService.getGeneralLedgerAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        const base = data.meta?.base || {};
        const buffer = await ExcelService.buildLedgerWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date: base.start_date, end_date: base.end_date },
          data: data.payload,
        });
        const fileName = `general-ledger-adv_${base.start_date || 'start'}_${base.end_date || 'end'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced GL error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced general ledger', code: 'ADV_GL_ERROR' });
    }
  }

  // PUBLIC_INTERFACE
  async cashFlow(req, res) {
    try {
      const { period, compare_to, fiscal_year, format } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year),
        comparePeriods: normalizePeriods(compare_to, null),
      };
      const data = await ReportingService.getCashFlowAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        const base = data.meta?.base || {};
        const buffer = await ExcelService.buildCashFlowWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date: base.start_date, end_date: base.end_date },
          data: data.payload,
        });
        const fileName = `cash-flow-adv_${base.start_date || 'start'}_${base.end_date || 'end'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced CF error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced cash flow', code: 'ADV_CF_ERROR' });
    }
  }

  // PUBLIC_INTERFACE
  async agedReceivables(req, res) {
    try {
      const { period, fiscal_year, buckets, format } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year, { balanceSheet: true }),
        buckets: parseBuckets(buckets),
      };
      const data = await ReportingService.getAgedReceivablesAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        const rows = [['Current', data.payload.agedReceivables.current], [`${data.meta.bucketLabels[0]}`, data.payload.agedReceivables[data.meta.bucketLabels[0]]], [`${data.meta.bucketLabels[1]}`, data.payload.agedReceivables[data.meta.bucketLabels[1]]], [`${data.meta.bucketLabels[2]}`, data.payload.agedReceivables[data.meta.bucketLabels[2]]], ['Over', data.payload.agedReceivables.over]];
        const buffer = await ExcelService.buildSimpleKeyAmountWorkbook({
          title: 'Aged Receivables',
          company: req.company || { name: req.companyName || 'Company' },
          headers: ['Bucket', 'Amount'],
          rows,
          numberIndexes: [2],
          params: { as_of_date: data.meta?.base?.as_of_date },
        });
        const fileName = `aged-receivables-adv_${data.meta?.base?.as_of_date || 'as-of-today'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced AR error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced aged receivables', code: 'ADV_AR_ERROR' });
    }
  }

  // PUBLIC_INTERFACE
  async agedPayables(req, res) {
    try {
      const { period, fiscal_year, buckets, format } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year, { balanceSheet: true }),
        buckets: parseBuckets(buckets),
      };
      const data = await ReportingService.getAgedPayablesAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        const rows = [['Current', data.payload.agedPayables.current], [`${data.meta.bucketLabels[0]}`, data.payload.agedPayables[data.meta.bucketLabels[0]]], [`${data.meta.bucketLabels[1]}`, data.payload.agedPayables[data.meta.bucketLabels[1]]], [`${data.meta.bucketLabels[2]}`, data.payload.agedPayables[data.meta.bucketLabels[2]]], ['Over', data.payload.agedPayables.over]];
        const buffer = await ExcelService.buildSimpleKeyAmountWorkbook({
          title: 'Aged Payables',
          company: req.company || { name: req.companyName || 'Company' },
          headers: ['Bucket', 'Amount'],
          rows,
          numberIndexes: [2],
          params: { as_of_date: data.meta?.base?.as_of_date },
        });
        const fileName = `aged-payables-adv_${data.meta?.base?.as_of_date || 'as-of-today'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced AP error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced aged payables', code: 'ADV_AP_ERROR' });
    }
  }

  // PUBLIC_INTERFACE
  async budgetVsActual(req, res) {
    try {
      const { period, fiscal_year, budget_source, format } = req.query;
      const params = {
        periods: normalizePeriods(period, fiscal_year),
        budget_source: budget_source || 'table:budgets',
      };
      const data = await ReportingService.getBudgetVsActualAdvanced(req.companyId, params);

      if ((format || '').toLowerCase() === 'xlsx') {
        // Reuse P&L workbook for structure
        const base = data.meta?.base || {};
        const payload = {
          profitLoss: {
            revenue: data.payload.lines.filter(l => l.type === 'REVENUE').map(l => ({ code: l.code, name: l.name, amount: l.actual })),
            expenses: data.payload.lines.filter(l => l.type === 'EXPENSE').map(l => ({ code: l.code, name: l.name, amount: l.actual })),
          },
          summary: {
            totalRevenue: data.payload.summary.totalActualRevenue,
            totalExpenses: data.payload.summary.totalActualExpenses,
            netIncome: data.payload.summary.netActualIncome,
          },
        };
        const buffer = await ExcelService.buildProfitLossWorkbook({
          company: req.company || { name: req.companyName || 'Company' },
          params: { start_date: base.start_date, end_date: base.end_date },
          data: payload,
        });
        const fileName = `budget-vs-actual-adv_${base.start_date || 'start'}_${base.end_date || 'end'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(buffer));
      }

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Advanced BvA error:', err);
      res.status(err.status || 500).json({ status: 'error', message: 'Failed to generate advanced budget vs actual', code: 'ADV_BVA_ERROR' });
    }
  }
}

function normalizePeriods(period, fiscal_year, opts = {}) {
  // Accepts:
  //  - period[]=YYYY-MM-DD..YYYY-MM-DD or single YYYY-MM-DD (as_of)
  //  - If not provided and fiscal_year provided: map to Jan 1..Dec 31 of that year (baseline)
  const arr = Array.isArray(period) ? period : (period ? [period] : []);
  if (arr.length === 0 && fiscal_year) {
    if (opts.balanceSheet) {
      return [{ as_of_date: `${fiscal_year}-12-31` }];
    }
    return [{ start_date: `${fiscal_year}-01-01`, end_date: `${fiscal_year}-12-31` }];
  }
  return arr.map(p => {
    if (String(p).includes('..')) {
      const [sd, ed] = String(p).split('..');
      if (opts.balanceSheet) {
        return { as_of_date: ed || sd };
      }
      return { start_date: sd, end_date: ed };
    }
    // single date -> as_of for BS or map to one-day window for PL/GL
    if (opts.balanceSheet) {
      return { as_of_date: p };
    }
    return { start_date: p, end_date: p };
  });
}

function parseBuckets(b) {
  if (!b) return [30, 60, 90, 120];
  if (Array.isArray(b)) return b.map(x => Number(x)).filter(x => Number.isFinite(x)).sort((a, z) => a - z);
  return String(b).split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x)).sort((a, z) => a - z);
}

module.exports = new AdvancedReportsController();
