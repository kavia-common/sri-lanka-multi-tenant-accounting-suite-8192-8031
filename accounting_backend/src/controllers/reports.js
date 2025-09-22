const ReportingService = require('../services/ReportingService');
const ExcelService = require('../services/ExcelService');

function normalizeLegacyToAdvancedPeriods(periodArr, legacy, fiscal_year, balanceSheet) {
  const arr = Array.isArray(periodArr) ? periodArr : (periodArr ? [periodArr] : []);
  if (arr.length === 0) {
    if (balanceSheet) {
      if (legacy?.as_of_date) return [{ as_of_date: legacy.as_of_date }];
      if (fiscal_year) return [{ as_of_date: `${fiscal_year}-12-31` }];
    } else {
      if (legacy?.start_date && legacy?.end_date) return [{ start_date: legacy.start_date, end_date: legacy.end_date }];
      if (fiscal_year) return [{ start_date: `${fiscal_year}-01-01`, end_date: `${fiscal_year}-12-31` }];
    }
    return [];
  }
  return arr.map(p => {
    if (String(p).includes('..')) {
      const [sd, ed] = String(p).split('..');
      if (balanceSheet) return { as_of_date: ed || sd };
      return { start_date: sd, end_date: ed };
    }
    if (balanceSheet) return { as_of_date: p };
    return { start_date: p, end_date: p };
  });
}

class ReportsController {
  /**
   * Generate trial balance report (basic) with optional Excel export
   * Query: start_date?, end_date?, format?=json|xlsx
   */
  // PUBLIC_INTERFACE
  async getTrialBalance(req, res) {
    try {
      const { start_date, end_date, format, 'period[]': periodArr, 'compare_to[]': compareArr, budget_source, fiscal_year } = req.query;

      // Use advanced path when new params are present
      if (periodArr || compareArr || budget_source || fiscal_year) {
        const periods = normalizeLegacyToAdvancedPeriods(periodArr, { start_date, end_date }, fiscal_year, false);
        const comparePeriods = normalizeLegacyToAdvancedPeriods(compareArr, {}, null, false);
        const adv = await ReportingService.getTrialBalanceAdvanced(req.companyId, {
          periods, comparePeriods, budget_source: budget_source || 'table:budgets'
        });

        if ((format || '').toLowerCase() === 'xlsx') {
          const buffer = await ExcelService.buildTrialBalanceWorkbook({
            company: req.company || { name: req.companyName || 'Company' },
            params: { start_date: adv.meta?.base?.start_date, end_date: adv.meta?.base?.end_date },
            data: adv.payload,
          });
          const fileName = `trial-balance_${adv.meta?.base?.start_date || 'start'}_${adv.meta?.base?.end_date || 'end'}.xlsx`;
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          return res.send(Buffer.from(buffer));
        }
        return res.json({ status: 'success', data: adv });
      }

      // Fallback to legacy behavior
      const data = await ReportingService.getTrialBalance(req.companyId, { start_date, end_date });

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
   * Generate balance sheet report (basic) with optional Excel export
   * Query: as_of_date?, format?=json|xlsx
   */
  // PUBLIC_INTERFACE
  async getBalanceSheet(req, res) {
    try {
      const { as_of_date, format, 'period[]': periodArr, 'compare_to[]': compareArr, budget_source, fiscal_year } = req.query;

      if (periodArr || compareArr || budget_source || fiscal_year) {
        const periods = normalizeLegacyToAdvancedPeriods(periodArr, { as_of_date }, fiscal_year, true);
        const comparePeriods = normalizeLegacyToAdvancedPeriods(compareArr, {}, null, true);
        const adv = await ReportingService.getBalanceSheetAdvanced(req.companyId, {
          periods, comparePeriods, budget_source: budget_source || 'table:budgets'
        });

        if ((format || '').toLowerCase() === 'xlsx') {
          const buffer = await ExcelService.buildBalanceSheetWorkbook({
            company: req.company || { name: req.companyName || 'Company' },
            params: { as_of_date: adv.meta?.base?.as_of_date },
            data: adv.payload,
          });
          const fileName = `balance-sheet_${adv.meta?.base?.as_of_date || 'as-of-today'}.xlsx`;
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          return res.send(Buffer.from(buffer));
        }
        return res.json({ status: 'success', data: adv });
      }

      const data = await ReportingService.getBalanceSheet(req.companyId, { as_of_date });

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
   * Generate profit and loss report (basic) with optional Excel export
   * Query: start_date, end_date, format?=json|xlsx
   */
  // PUBLIC_INTERFACE
  async getProfitLoss(req, res) {
    try {
      const { start_date, end_date, format, 'period[]': periodArr, 'compare_to[]': compareArr, budget_source, fiscal_year } = req.query;

      if (periodArr || compareArr || budget_source || fiscal_year) {
        const periods = normalizeLegacyToAdvancedPeriods(periodArr, { start_date, end_date }, fiscal_year, false);
        const comparePeriods = normalizeLegacyToAdvancedPeriods(compareArr, {}, null, false);
        const adv = await ReportingService.getProfitLossAdvanced(req.companyId, {
          periods, comparePeriods, budget_source: budget_source || 'table:budgets'
        });

        if ((format || '').toLowerCase() === 'xlsx') {
          const base = adv.meta?.base || {};
          const buffer = await ExcelService.buildProfitLossWorkbook({
            company: req.company || { name: req.companyName || 'Company' },
            params: { start_date: base.start_date, end_date: base.end_date },
            data: adv.payload,
          });
          const fileName = `profit-loss_${base.start_date}_${base.end_date}.xlsx`;
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          return res.send(Buffer.from(buffer));
        }

        return res.json({ status: 'success', data: adv });
      }

      const data = await ReportingService.getProfitLoss(req.companyId, { start_date, end_date });

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
