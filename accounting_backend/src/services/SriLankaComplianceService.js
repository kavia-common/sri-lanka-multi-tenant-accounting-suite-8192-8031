'use strict';

/**
 * SriLankaComplianceService
 * Foundational logic for Sri Lanka-specific tax and statutory reporting.
 * - VAT Return (SVAT baseline not included yet)
 * - Income Tax computation schedule (corporate tax baseline)
 * - Withholding Tax (WHT) statements
 * - EPF/ETF employer remittance summary
 * - Annual financials mapping per Companies Act format (sections/groups)
 *
 * Notes:
 * - This is a baseline engine: account mapping relies primarily on account type and code/name heuristics.
 * - For production compliance, add explicit tax codes, VAT categories, supplier/customer tax profiles,
 *   and statutory mappings via configuration tables.
 * - All methods accept companyId and parameter object to support multi-tenant row scoping.
 * - All outputs are normalized and include Chart.js-ready data where applicable.
 */

const db = require('../config/database');

function n(v) {
  const num = Number(v || 0);
  return Number.isFinite(num) ? num : 0;
}

// PUBLIC_INTERFACE
class SriLankaComplianceService {
  /** PUBLIC_INTERFACE
   * getVatReturn(companyId, options)
   * options: { period_start, period_end, include_transactions?: boolean }
   * Returns: VAT return summary (Output tax, Input tax, Net VAT, zero-rated/exempt estimates)
   * Assumptions:
   *  - Output VAT approximated where revenue accounts have 'vat' or 'tax' in name/code or via transactions with description reference.
   *  - Input VAT approximated from expense/cost accounts with 'vat'/'tax' in description/code.
   * To fully comply, introduce explicit tax code tables (future enhancement).
   */
  static async getVatReturn(companyId, options = {}) {
    const { period_start, period_end, include_transactions = false } = options || {};
    if (!period_start || !period_end) {
      const err = new Error('period_start and period_end are required');
      err.status = 400;
      throw err;
    }

    // Output VAT: credit to VAT liability or revenue tax line
    const outputSql = `
      WITH tx AS (
        SELECT t.id, t.date, t.description, t.reference,
               je.debit_amount, je.credit_amount, a.id as account_id, a.code, a.name, a.type
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE t.company_id = $1
           AND t.date BETWEEN $2 AND $3
      )
      SELECT
        COALESCE(SUM(
          CASE
            WHEN (LOWER(tx.name) LIKE '%vat%' OR LOWER(tx.code) LIKE '%vat%' OR LOWER(tx.description) LIKE '%vat%')
                 AND tx.type IN ('LIABILITY','REVENUE')
              THEN (tx.credit_amount - tx.debit_amount)
            ELSE 0
          END
        ),0) AS output_vat,
        COALESCE(SUM(
          CASE
            WHEN tx.type = 'REVENUE' AND (LOWER(tx.name) LIKE '%zero%' OR LOWER(tx.name) LIKE '%export%')
              THEN (tx.credit_amount - tx.debit_amount)
            ELSE 0
          END
        ),0) AS zero_rated_sales,
        COALESCE(SUM(
          CASE
            WHEN tx.type = 'REVENUE' AND (LOWER(tx.name) LIKE '%exempt%')
              THEN (tx.credit_amount - tx.debit_amount)
            ELSE 0
          END
        ),0) AS exempt_sales
      FROM tx
    `;
    const { rows: orows } = await db.query(outputSql, [companyId, period_start, period_end]);
    const outputVAT = n(orows[0]?.output_vat);
    const zeroRated = n(orows[0]?.zero_rated_sales);
    const exemptSales = n(orows[0]?.exempt_sales);

    // Input VAT: debit to VAT asset/expense tax lines
    const inputSql = `
      WITH tx AS (
        SELECT t.id, t.date, t.description, t.reference,
               je.debit_amount, je.credit_amount, a.id as account_id, a.code, a.name, a.type
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE t.company_id = $1
           AND t.date BETWEEN $2 AND $3
      )
      SELECT
        COALESCE(SUM(
          CASE
            WHEN (LOWER(tx.name) LIKE '%vat%' OR LOWER(tx.code) LIKE '%vat%' OR LOWER(tx.description) LIKE '%vat%')
                 AND tx.type IN ('ASSET','EXPENSE')
              THEN (tx.debit_amount - tx.credit_amount)
            ELSE 0
          END
        ),0) AS input_vat,
        COALESCE(SUM(
          CASE
            WHEN tx.type = 'EXPENSE' AND (LOWER(tx.name) LIKE '%non-recoverable%' OR LOWER(tx.description) LIKE '%non-recoverable%')
              THEN (tx.debit_amount - tx.credit_amount)
            ELSE 0
          END
        ),0) AS non_recoverable_vat
      FROM tx
    `;
    const { rows: irows } = await db.query(inputSql, [companyId, period_start, period_end]);
    const inputVAT = n(irows[0]?.input_vat);
    const nonRecoverable = n(irows[0]?.non_recoverable_vat);

    const netVAT = outputVAT - inputVAT;

    let transactions = [];
    if (include_transactions) {
      const detailSql = `
        SELECT t.id as transaction_id, t.date, t.description, t.reference,
               a.code, a.name, a.type, je.debit_amount, je.credit_amount
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE t.company_id = $1
           AND t.date BETWEEN $2 AND $3
           AND (LOWER(a.name) LIKE '%vat%' OR LOWER(a.code) LIKE '%vat%' OR LOWER(t.description) LIKE '%vat%')
         ORDER BY t.date, t.id
      `;
      const { rows } = await db.query(detailSql, [companyId, period_start, period_end]);
      transactions = rows.map(r => ({
        transaction_id: r.transaction_id,
        date: r.date,
        description: r.description,
        reference: r.reference,
        account_code: r.code,
        account_name: r.name,
        debit: r.debit_amount,
        credit: r.credit_amount,
      }));
    }

    return {
      vatReturn: {
        period: { start: period_start, end: period_end },
        outputVAT: outputVAT.toFixed(2),
        inputVAT: inputVAT.toFixed(2),
        netVAT: netVAT.toFixed(2),
        zeroRatedSales: zeroRated.toFixed(2),
        exemptSales: exemptSales.toFixed(2),
        nonRecoverableVAT: nonRecoverable.toFixed(2),
        transactions
      },
      chart: {
        labels: ['Output VAT', 'Input VAT', 'Net VAT'],
        datasets: [{ label: 'VAT', data: [outputVAT, inputVAT, netVAT] }]
      }
    };
  }

  /** PUBLIC_INTERFACE
   * getIncomeTaxSchedule(companyId, options)
   * options: { period_start, period_end }
   * Returns: Income tax computation baseline (Profit before tax approximation, adjustments placeholders, taxable income, tax due)
   * Note: Corporate tax rate not hard-coded; require env var SL_CORP_TAX_RATE or use default 30%.
   */
  static async getIncomeTaxSchedule(companyId, options = {}) {
    const { period_start, period_end } = options || {};
    if (!period_start || !period_end) {
      const err = new Error('period_start and period_end are required');
      err.status = 400;
      throw err;
    }

    // Approximate Profit Before Tax from P&L
    const pnlSql = `
      SELECT
        COALESCE(SUM(CASE WHEN a.type='REVENUE' THEN (je.credit_amount - je.debit_amount) ELSE 0 END),0) AS revenue,
        COALESCE(SUM(CASE WHEN a.type='EXPENSE' THEN (je.debit_amount - je.credit_amount) ELSE 0 END),0) AS expenses
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.id = je.account_id
     WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3
    `;
    const { rows: pnlr } = await db.query(pnlSql, [companyId, period_start, period_end]);
    const revenue = n(pnlr[0]?.revenue);
    const expenses = n(pnlr[0]?.expenses);
    const profitBeforeTax = revenue - expenses;

    // Addbacks/allowances placeholders from keywords (baseline)
    const addbackSql = `
      SELECT COALESCE(SUM(je.debit_amount - je.credit_amount),0) AS addbacks
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3
         AND a.type = 'EXPENSE'
         AND (LOWER(a.name) LIKE '%non-deductible%' OR LOWER(a.description) LIKE '%non-deductible%')
    `;
    const { rows: addb } = await db.query(addbackSql, [companyId, period_start, period_end]);
    const addbacks = n(addb[0]?.addbacks);

    const allowancesSql = `
      SELECT COALESCE(SUM(je.credit_amount - je.debit_amount),0) AS allowances
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3
         AND (LOWER(a.name) LIKE '%capital allowance%' OR LOWER(a.description) LIKE '%capital allowance%')
    `;
    const { rows: allw } = await db.query(allowancesSql, [companyId, period_start, period_end]);
    const allowances = n(allw[0]?.allowances);

    const taxableIncome = profitBeforeTax + addbacks - allowances;
    const corpTaxRate = Number(process.env.SL_CORP_TAX_RATE || 0.30);
    const taxDue = Math.max(0, taxableIncome * corpTaxRate);

    return {
      incomeTaxSchedule: {
        period: { start: period_start, end: period_end },
        revenue: revenue.toFixed(2),
        expenses: expenses.toFixed(2),
        profitBeforeTax: profitBeforeTax.toFixed(2),
        addbacks: addbacks.toFixed(2),
        allowances: allowances.toFixed(2),
        taxableIncome: taxableIncome.toFixed(2),
        corpTaxRate,
        taxDue: taxDue.toFixed(2),
      },
      chart: {
        labels: ['PBT', 'Addbacks', 'Allowances', 'Tax Due'],
        datasets: [{ label: 'Income Tax', data: [profitBeforeTax, addbacks, allowances, taxDue] }]
      }
    };
  }

  /** PUBLIC_INTERFACE
   * getWHTStatement(companyId, options)
   * options: { period_start, period_end, include_transactions?: boolean }
   * Returns: WHT summary by type (baseline derives from account names containing 'withholding' or 'wht')
   */
  static async getWHTStatement(companyId, options = {}) {
    const { period_start, period_end, include_transactions = false } = options || {};
    if (!period_start || !period_end) {
      const err = new Error('period_start and period_end are required');
      err.status = 400;
      throw err;
    }

    const whtSql = `
      SELECT
        CASE
          WHEN LOWER(a.name) LIKE '%interest%' THEN 'Interest'
          WHEN LOWER(a.name) LIKE '%dividend%' THEN 'Dividend'
          WHEN LOWER(a.name) LIKE '%service%' THEN 'Services'
          ELSE 'Other'
        END AS wht_type,
        COALESCE(SUM(je.credit_amount - je.debit_amount),0) AS withheld
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.id = je.account_id
     WHERE t.company_id = $1
       AND t.date BETWEEN $2 AND $3
       AND (LOWER(a.name) LIKE '%withholding%' OR LOWER(a.name) LIKE '%wht%')
     GROUP BY 1
     ORDER BY 1
    `;
    const { rows } = await db.query(whtSql, [companyId, period_start, period_end]);

    let details = [];
    if (include_transactions) {
      const dsql = `
        SELECT t.id as transaction_id, t.date, t.description, t.reference,
               a.code, a.name, je.debit_amount, je.credit_amount
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE t.company_id = $1
           AND t.date BETWEEN $2 AND $3
           AND (LOWER(a.name) LIKE '%withholding%' OR LOWER(a.name) LIKE '%wht%')
         ORDER BY t.date, t.id
      `;
      const { rows: drows } = await db.query(dsql, [companyId, period_start, period_end]);
      details = drows.map(r => ({
        transaction_id: r.transaction_id,
        date: r.date,
        description: r.description,
        reference: r.reference,
        account_code: r.code,
        account_name: r.name,
        debit: r.debit_amount,
        credit: r.credit_amount,
      }));
    }

    const summary = rows.map(r => ({ type: r.wht_type, withheld: n(r.withheld).toFixed(2) }));
    const total = rows.reduce((s, r) => s + n(r.withheld), 0);

    return {
      whtStatement: {
        period: { start: period_start, end: period_end },
        summary,
        total: total.toFixed(2),
        details,
      },
      chart: {
        labels: summary.map(s => s.type),
        datasets: [{ label: 'WHT', data: summary.map(s => Number(s.withheld)) }]
      }
    };
  }

  /** PUBLIC_INTERFACE
   * getEPFETFReport(companyId, options)
   * options: { period_start, period_end }
   * Returns: Employer contribution summary based on payroll expense heuristics.
   * Heuristic: accounts with names like 'salary', 'wage', 'staff', 'epf', 'etf'
   * Note: For accurate reporting, integrate with payroll module and employee master data.
   */
  static async getEPFETFReport(companyId, options = {}) {
    const { period_start, period_end } = options || {};
    if (!period_start || !period_end) {
      const err = new Error('period_start and period_end are required');
      err.status = 400;
      throw err;
    }

    const payrollSql = `
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(a.name) LIKE '%salary%' OR LOWER(a.name) LIKE '%wage%' OR LOWER(a.name) LIKE '%staff%'
          THEN (je.debit_amount - je.credit_amount) END),0) AS gross_pay,
        COALESCE(SUM(CASE WHEN LOWER(a.name) LIKE '%epf%' THEN (je.credit_amount - je.debit_amount) END),0) AS epf_withheld,
        COALESCE(SUM(CASE WHEN LOWER(a.name) LIKE '%etf%' THEN (je.credit_amount - je.debit_amount) END),0) AS etf_employer
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.id = je.account_id
     WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3
    `;
    const { rows } = await db.query(payrollSql, [companyId, period_start, period_end]);
    const grossPay = n(rows[0]?.gross_pay);
    const epfWithheld = n(rows[0]?.epf_withheld);
    const etfEmployer = n(rows[0]?.etf_employer);

    // If EPF/ETF not clearly posted, estimate using common SL rates:
    // EPF employee 8%, employer 12%; ETF employer 3% (these are not hard-coded to ledger)
    const estimatedEPFEmployee = grossPay * 0.08;
    const estimatedEPFEmployer = grossPay * 0.12;
    const estimatedETFEmployer = grossPay * 0.03;

    return {
      epfEtf: {
        period: { start: period_start, end: period_end },
        grossPay: grossPay.toFixed(2),
        epfWithheldLedger: epfWithheld.toFixed(2),
        etfEmployerLedger: etfEmployer.toFixed(2),
        estimated: {
          epfEmployee: estimatedEPFEmployee.toFixed(2),
          epfEmployer: estimatedEPFEmployer.toFixed(2),
          etfEmployer: estimatedETFEmployer.toFixed(2),
        }
      },
      chart: {
        labels: ['EPF Employee (est.)', 'EPF Employer (est.)', 'ETF Employer (est.)'],
        datasets: [{ label: 'Contributions', data: [estimatedEPFEmployee, estimatedEPFEmployer, estimatedETFEmployer] }]
      }
    };
  }

  /** PUBLIC_INTERFACE
   * getAnnualFinancials(companyId, options)
   * options: { as_of_date, include_previous_year?: boolean }
   * Returns: Annual financials mapped to Companies Act style categories (baseline)
   * Mapping heuristic uses account types and code/name hints.
   */
  static async getAnnualFinancials(companyId, options = {}) {
    const { as_of_date, include_previous_year = false } = options || {};
    const asOf = as_of_date || new Date().toISOString().slice(0, 10);

    const computeAsOf = async (date) => {
      const sql = `
        SELECT a.id, a.code, a.name, a.type,
               COALESCE(SUM(
                 CASE
                   WHEN a.type IN ('ASSET','EXPENSE') THEN (je.debit_amount - je.credit_amount)
                   ELSE (je.credit_amount - je.debit_amount)
                 END
               ),0) AS amount
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE t.company_id = $1 AND t.date <= $2
         GROUP BY a.id, a.code, a.name, a.type
      `;
      const { rows } = await db.query(sql, [companyId, date]);
      // Group to Companies Act style categories
      const mapCat = (r) => {
        const name = (r.name || '').toLowerCase();
        const code = (r.code || '').toLowerCase();
        if (r.type === 'ASSET') {
          if (name.includes('fixed') || code.includes('fixed') || name.includes('ppe')) return 'Property, Plant and Equipment';
          if (name.includes('inventory')) return 'Inventories';
          if (name.includes('receivable') || code.includes('ar')) return 'Trade and Other Receivables';
          if (name.includes('cash') || name.includes('bank')) return 'Cash and Cash Equivalents';
          return 'Other Assets';
        }
        if (r.type === 'LIABILITY') {
          if (name.includes('loan') || name.includes('borrowing')) return 'Borrowings';
          if (name.includes('payable') || code.includes('ap')) return 'Trade and Other Payables';
          if (name.includes('tax')) return 'Tax Liabilities';
          return 'Other Liabilities';
        }
        if (r.type === 'EQUITY') {
          if (name.includes('share capital') || name.includes('stated capital') || name.includes('capital')) return 'Stated Capital';
          if (name.includes('retained')) return 'Retained Earnings';
          return 'Other Equity';
        }
        if (r.type === 'REVENUE') return 'Revenue';
        if (r.type === 'EXPENSE') return 'Expenses';
        return 'Uncategorized';
      };

      const byCat = {};
      rows.forEach(r => {
        const cat = mapCat(r);
        const amt = n(r.amount);
        byCat[cat] = (byCat[cat] || 0) + amt;
      });

      return Object.entries(byCat).map(([k, v]) => ({ category: k, amount: v.toFixed(2) }));
    };

    const current = await computeAsOf(asOf);
    let previous = null;
    if (include_previous_year) {
      const prevDate = new Date(asOf);
      prevDate.setFullYear(prevDate.getFullYear() - 1);
      const prevStr = prevDate.toISOString().slice(0, 10);
      previous = await computeAsOf(prevStr);
    }

    return {
      annualFinancials: {
        asOfDate: asOf,
        currentYear: current,
        previousYear: previous
      },
      chart: {
        labels: current.map(c => c.category),
        datasets: [{
          label: 'Current',
          data: current.map(c => Number(c.amount))
        }, ...(previous ? [{
          label: 'Previous',
          data: previous.map(c => Number(c.amount))
        }] : [])]
      }
    };
  }
}

module.exports = SriLankaComplianceService;
