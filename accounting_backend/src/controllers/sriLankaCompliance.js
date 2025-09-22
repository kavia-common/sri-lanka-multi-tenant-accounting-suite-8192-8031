const SriLankaComplianceService = require('../services/SriLankaComplianceService');
const PdfService = require('../services/PdfService');
const db = require('../config/database');

/**
 * Controller for Sri Lanka-specific compliance reports.
 */
// PUBLIC_INTERFACE
class SriLankaComplianceController {
  /** PUBLIC_INTERFACE
   * VAT Return
   * Query: period_start (date), period_end (date), include_transactions? (boolean), format?=pdf|json
   */
  async vatReturn(req, res) {
    try {
      const { period_start, period_end, include_transactions, format } = req.query;
      const result = await SriLankaComplianceService.getVatReturn(req.companyId, {
        period_start, period_end, include_transactions: include_transactions === 'true'
      });

      if (format === 'pdf') {
        const company = await this._getCompany(req.companyId);
        const doc = PdfService.createDocument(res, { fileName: `VAT-Return_${period_start}_${period_end}.pdf` });
        PdfService.drawHeader(doc, company, {
          reportTitle: 'VAT Return - Sri Lanka',
          periodText: `Period: ${period_start} to ${period_end}`
        });

        const vr = result.vatReturn;
        PdfService.section(doc, 'Summary');
        PdfService.keyValues(doc, [
          { label: 'Output VAT', value: vr.outputVAT },
          { label: 'Input VAT', value: vr.inputVAT },
          { label: 'Net VAT', value: vr.netVAT },
          { label: 'Zero-rated Sales (est.)', value: vr.zeroRatedSales },
          { label: 'Exempt Sales (est.)', value: vr.exemptSales },
          { label: 'Non-recoverable VAT (est.)', value: vr.nonRecoverableVAT },
        ]);

        if (Array.isArray(vr.transactions) && vr.transactions.length) {
          PdfService.section(doc, 'VAT Transactions');
          PdfService.table(doc, {
            columns: [
              { key: 'date', title: 'Date', width: 80 },
              { key: 'transaction_id', title: 'Txn', width: 70 },
              { key: 'account_code', title: 'Account', width: 120 },
              { key: 'description', title: 'Description', width: 180 },
              { key: 'debit', title: 'Debit', width: 80, align: 'right' },
              { key: 'credit', title: 'Credit', width: 80, align: 'right' },
            ],
            data: vr.transactions
          });
        }

        doc.end();
        return;
      }

      res.json({ status: 'success', data: result, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('VAT Return error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate VAT return' });
    }
  }

  /** PUBLIC_INTERFACE
   * Income Tax computation schedule
   * Query: period_start (date), period_end (date), format?=pdf|json
   */
  async incomeTax(req, res) {
    try {
      const { period_start, period_end, format } = req.query;
      const result = await SriLankaComplianceService.getIncomeTaxSchedule(req.companyId, { period_start, period_end });

      if (format === 'pdf') {
        const company = await this._getCompany(req.companyId);
        const doc = PdfService.createDocument(res, { fileName: `Income-Tax_${period_start}_${period_end}.pdf` });
        PdfService.drawHeader(doc, company, {
          reportTitle: 'Income Tax Computation - Sri Lanka',
          periodText: `Period: ${period_start} to ${period_end}`
        });

        const s = result.incomeTaxSchedule;
        PdfService.section(doc, 'Computation');
        PdfService.keyValues(doc, [
          { label: 'Revenue', value: s.revenue },
          { label: 'Expenses', value: s.expenses },
          { label: 'Profit Before Tax', value: s.profitBeforeTax },
          { label: 'Addbacks', value: s.addbacks },
          { label: 'Allowances', value: s.allowances },
          { label: 'Taxable Income', value: s.taxableIncome },
          { label: 'Corporate Tax Rate', value: `${(Number(s.corpTaxRate) * 100).toFixed(2)}%` },
          { label: 'Tax Due', value: s.taxDue },
        ]);

        doc.end();
        return;
      }

      res.json({ status: 'success', data: result, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('Income Tax error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate income tax schedule' });
    }
  }

  /** PUBLIC_INTERFACE
   * Withholding Tax Statement
   * Query: period_start (date), period_end (date), include_transactions? (boolean), format?=pdf|json
   */
  async whtStatement(req, res) {
    try {
      const { period_start, period_end, include_transactions, format } = req.query;
      const result = await SriLankaComplianceService.getWHTStatement(req.companyId, {
        period_start, period_end, include_transactions: include_transactions === 'true'
      });

      if (format === 'pdf') {
        const company = await this._getCompany(req.companyId);
        const doc = PdfService.createDocument(res, { fileName: `WHT_${period_start}_${period_end}.pdf` });
        PdfService.drawHeader(doc, company, {
          reportTitle: 'Withholding Tax Statement - Sri Lanka',
          periodText: `Period: ${period_start} to ${period_end}`
        });

        const w = result.whtStatement;
        PdfService.section(doc, 'Summary by Type');
        (w.summary || []).forEach(row => {
          PdfService.totalsRow(doc, { label: row.type, values: [{ amount: row.withheld }] });
        });
        PdfService.totalsRow(doc, { label: 'Total', values: [{ amount: w.total }] });

        if (Array.isArray(w.details) && w.details.length) {
          PdfService.section(doc, 'Details');
          PdfService.table(doc, {
            columns: [
              { key: 'date', title: 'Date', width: 80 },
              { key: 'transaction_id', title: 'Txn', width: 70 },
              { key: 'account_code', title: 'Account', width: 120 },
              { key: 'description', title: 'Description', width: 200 },
              { key: 'debit', title: 'Debit', width: 80, align: 'right' },
              { key: 'credit', title: 'Credit', width: 80, align: 'right' },
            ],
            data: w.details
          });
        }

        doc.end();
        return;
      }

      res.json({ status: 'success', data: result, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('WHT error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate WHT statement' });
    }
  }

  /** PUBLIC_INTERFACE
   * EPF/ETF Remittance Summary
   * Query: period_start (date), period_end (date), format?=pdf|json
   */
  async epfEtf(req, res) {
    try {
      const { period_start, period_end, format } = req.query;
      const result = await SriLankaComplianceService.getEPFETFReport(req.companyId, { period_start, period_end });

      if (format === 'pdf') {
        const company = await this._getCompany(req.companyId);
        const doc = PdfService.createDocument(res, { fileName: `EPF-ETF_${period_start}_${period_end}.pdf` });
        PdfService.drawHeader(doc, company, {
          reportTitle: 'EPF/ETF Remittance Summary - Sri Lanka',
          periodText: `Period: ${period_start} to ${period_end}`
        });

        const r = result.epfEtf;
        PdfService.section(doc, 'Ledger Amounts');
        PdfService.keyValues(doc, [
          { label: 'Gross Pay', value: r.grossPay },
          { label: 'EPF Withheld (ledger)', value: r.epfWithheldLedger },
          { label: 'ETF Employer (ledger)', value: r.etfEmployerLedger },
        ]);

        PdfService.section(doc, 'Estimated Contributions');
        PdfService.keyValues(doc, [
          { label: 'EPF Employee (8%)', value: r.estimated?.epfEmployee },
          { label: 'EPF Employer (12%)', value: r.estimated?.epfEmployer },
          { label: 'ETF Employer (3%)', value: r.estimated?.etfEmployer },
        ]);

        doc.end();
        return;
      }

      res.json({ status: 'success', data: result, reportParams: { companyId: req.companyId, period_start, period_end } });
    } catch (e) {
      console.error('EPF/ETF error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate EPF/ETF report' });
    }
  }

  /** PUBLIC_INTERFACE
   * Annual Financials (Companies Act style mapping)
   * Query: as_of_date (date), include_previous_year? (boolean), format?=pdf|json
   */
  async annualFinancials(req, res) {
    try {
      const { as_of_date, include_previous_year, format } = req.query;
      const result = await SriLankaComplianceService.getAnnualFinancials(req.companyId, {
        as_of_date, include_previous_year: include_previous_year === 'true'
      });

      if (format === 'pdf') {
        const company = await this._getCompany(req.companyId);
        const doc = PdfService.createDocument(res, { fileName: `Annual-Financials_${as_of_date || 'as-of-today'}.pdf` });
        const compareText = result.annualFinancials.previousYear ? 'Comparative: Previous year included' : '';
        PdfService.drawHeader(doc, company, {
          reportTitle: 'Annual Financial Statements (Companies Act baseline)',
          periodText: `As of: ${result.annualFinancials.asOfDate}`,
          comparativeText: compareText
        });

        const cur = result.annualFinancials.currentYear || [];
        const prev = result.annualFinancials.previousYear || [];

        PdfService.section(doc, 'Statement Summary');
        if (cur.length) {
          PdfService.section(doc, 'Current Year');
          PdfService.table(doc, {
            columns: [
              { key: 'category', title: 'Category', width: 300 },
              { key: 'amount', title: 'Amount', width: 200, align: 'right' },
            ],
            data: cur
          });
        }
        if (prev.length) {
          PdfService.section(doc, 'Previous Year');
          PdfService.table(doc, {
            columns: [
              { key: 'category', title: 'Category', width: 300 },
              { key: 'amount', title: 'Amount', width: 200, align: 'right' },
            ],
            data: prev
          });
        }

        doc.end();
        return;
      }

      res.json({ status: 'success', data: result, reportParams: { companyId: req.companyId, as_of_date } });
    } catch (e) {
      console.error('Annual financials error', e);
      res.status(e.status || 500).json({ status: 'error', message: e.message || 'Failed to generate annual financials' });
    }
  }

  /**
   * Internal helper to get company profile for header branding.
   */
  async _getCompany(companyId) {
    const { rows } = await db.query(
      'SELECT id, name, address, email, phone, tax_number FROM companies WHERE id = $1 LIMIT 1',
      [companyId]
    );
    return rows?.[0] || { name: 'Company' };
  }
}

module.exports = new SriLankaComplianceController();
