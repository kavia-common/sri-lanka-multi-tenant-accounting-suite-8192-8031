const SriLankaComplianceService = require('../services/SriLankaComplianceService');

/**
 * Controller for Sri Lanka-specific compliance reports.
 */
// PUBLIC_INTERFACE
class SriLankaComplianceController {
  /** PUBLIC_INTERFACE
   * VAT Return
   * Query: period_start (date), period_end (date), include_transactions? (boolean)
   */
  async vatReturn(req, res) {
    try {
      const { period_start, period_end, include_transactions } = req.query;
      const data = await SriLankaComplianceService.getVatReturn(req.companyId, {
        period_start, period_end, include_transactions: include_transactions === 'true'
      });
      res.json({ status: 'success', data, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('VAT Return error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate VAT return' });
    }
  }

  /** PUBLIC_INTERFACE
   * Income Tax computation schedule
   * Query: period_start (date), period_end (date)
   */
  async incomeTax(req, res) {
    try {
      const { period_start, period_end } = req.query;
      const data = await SriLankaComplianceService.getIncomeTaxSchedule(req.companyId, { period_start, period_end });
      res.json({ status: 'success', data, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('Income Tax error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate income tax schedule' });
    }
  }

  /** PUBLIC_INTERFACE
   * Withholding Tax Statement
   * Query: period_start (date), period_end (date), include_transactions? (boolean)
   */
  async whtStatement(req, res) {
    try {
      const { period_start, period_end, include_transactions } = req.query;
      const data = await SriLankaComplianceService.getWHTStatement(req.companyId, {
        period_start, period_end, include_transactions: include_transactions === 'true'
      });
      res.json({ status: 'success', data, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('WHT error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate WHT statement' });
    }
  }

  /** PUBLIC_INTERFACE
   * EPF/ETF Remittance Summary
   * Query: period_start (date), period_end (date)
   */
  async epfEtf(req, res) {
    try {
      const { period_start, period_end } = req.query;
      const data = await SriLankaComplianceService.getEPFETFReport(req.companyId, { period_start, period_end });
      res.json({ status: 'success', data, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('EPF/ETF error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate EPF/ETF report' });
    }
  }

  /** PUBLIC_INTERFACE
   * Annual Financials (Companies Act style mapping)
   * Query: as_of_date (date), include_previous_year? (boolean)
   */
  async annualFinancials(req, res) {
    try {
      const { as_of_date, include_previous_year } = req.query;
      const data = await SriLankaComplianceService.getAnnualFinancials(req.companyId, {
        as_of_date, include_previous_year: include_previous_year === 'true'
      });
      res.json({ status: 'success', data, reportParams: { companyId: req.companyId, as_of_date } });
    } catch (e) {
      console.error('Annual financials error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate annual financials' });
    }
  }
}

module.exports = new SriLankaComplianceController();
