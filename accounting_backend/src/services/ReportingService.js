'use strict';

/**
 * ReportingService
 * Provides financial reporting functions using PostgreSQL with parameterized queries.
 * Supports:
 *  - Multi-company scoping via companyId parameter.
 *  - Date filters and comparative period computation (current vs previous).
 *  - Drill-down options to include underlying transactions and journal entries.
 *  - Budget vs actuals hooks (assumes future budgets table; safe no-op when absent).
 *
 * All public methods return normalized data structures for easy export (PDF/Excel)
 * and charting (Chart.js).
 */

const db = require('../config/database');

// Utility: safe number conversion
function n(v) {
  const num = Number(v || 0);
  return Number.isFinite(num) ? num : 0;
}

// Utility: build common period filter SQL and params
function buildPeriodFilter({ start_date, end_date, as_of_date }, baseParams = []) {
  const filters = [];
  const params = [...baseParams];
  if (as_of_date) {
    params.push(as_of_date);
    filters.push(`t.date <= $${params.length}`);
  } else {
    if (start_date) {
      params.push(start_date);
      filters.push(`t.date >= $${params.length}`);
    }
    if (end_date) {
      params.push(end_date);
      filters.push(`t.date <= $${params.length}`);
    }
  }
  return { filters, params };
}

// PUBLIC_INTERFACE
class ReportingService {
  /** PUBLIC_INTERFACE
   * getTrialBalance(companyId, options)
   * options: { start_date?, end_date?, include_zero?: boolean, drilldown?: boolean }
   */
  static async getTrialBalance(companyId, options = {}) {
    const { start_date, end_date, include_zero = false, drilldown = false } = options || {};
    const baseParams = [companyId];
    const { filters, params } = buildPeriodFilter({ start_date, end_date }, baseParams);
    const where = ['t.company_id = $1', ...filters].join(' AND ');

    const sql = `
      SELECT a.id, a.code, a.name, a.type,
             COALESCE(SUM(je.debit_amount),0)::numeric(18,2) AS total_debits,
             COALESCE(SUM(je.credit_amount),0)::numeric(18,2) AS total_credits,
             (COALESCE(SUM(je.debit_amount),0) - COALESCE(SUM(je.credit_amount),0))::numeric(18,2) AS balance
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE ${where}
       GROUP BY a.id, a.code, a.name, a.type
       ${include_zero ? '' : 'HAVING COALESCE(SUM(je.debit_amount),0) != 0 OR COALESCE(SUM(je.credit_amount),0) != 0'}
       ORDER BY a.code ASC
    `;
    const { rows } = await db.query(sql, params);

    let totalDebits = 0;
    let totalCredits = 0;
    for (const r of rows) {
      totalDebits += n(r.total_debits);
      totalCredits += n(r.total_credits);
    }

    // Optional drill-down: fetch transactions per account
    let drill = {};
    if (drilldown && rows.length) {
      const accountIds = rows.map(r => r.id);
      const placeholders = accountIds.map((_, i) => `$${i + 2}`).join(', ');
      const dsql = `
        SELECT a.id as account_id, t.id as transaction_id, t.date, t.description, t.reference,
               je.debit_amount, je.credit_amount
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE t.company_id = $1 AND a.id IN (${placeholders})
           ${start_date ? 'AND t.date >= $' + (accountIds.length + 2) : ''}
           ${end_date ? 'AND t.date <= $' + (accountIds.length + (start_date ? 3 : 2)) : ''}
         ORDER BY a.id, t.date, t.id
      `;
      const drillParams = [companyId, ...accountIds];
      if (start_date) drillParams.push(start_date);
      if (end_date) drillParams.push(end_date);
      const { rows: drows } = await db.query(dsql, drillParams);
      drill = drows.reduce((acc, r) => {
        const list = acc[r.account_id] || [];
        list.push({
          transaction_id: r.transaction_id,
          date: r.date,
          description: r.description,
          reference: r.reference,
          debit: r.debit_amount,
          credit: r.credit_amount,
        });
        acc[r.account_id] = list;
        return acc;
      }, {});
    }

    return {
      trialBalance: rows.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        total_debits: r.total_debits?.toString() ?? '0.00',
        total_credits: r.total_credits?.toString() ?? '0.00',
        balance: r.balance?.toString() ?? '0.00',
        ...(drilldown ? { lines: drill[r.id] || [] } : {}),
      })),
      summary: {
        totalDebits: totalDebits.toFixed(2),
        totalCredits: totalCredits.toFixed(2),
        isBalanced: totalDebits.toFixed(2) === totalCredits.toFixed(2),
      },
      chart: {
        // Ready for Chart.js stacked bar/line
        labels: rows.map(r => r.code),
        datasets: [
          { label: 'Debits', data: rows.map(r => Number(r.total_debits || 0)) },
          { label: 'Credits', data: rows.map(r => Number(r.total_credits || 0)) },
        ],
      },
    };
  }

  /** PUBLIC_INTERFACE
   * getBalanceSheet(companyId, options)
   * options: { as_of_date?, comparative?: boolean, compare_as_of_date? }
   */
  static async getBalanceSheet(companyId, options = {}) {
    const { as_of_date, comparative = false, compare_as_of_date } = options || {};

    const compute = async (date) => {
      const params = [companyId];
      const { filters, params: pf } = buildPeriodFilter({ as_of_date: date }, params);
      const sql = `
        SELECT a.id, a.code, a.name, a.type,
               COALESCE(SUM(
                 CASE
                   WHEN a.type IN ('ASSET','EXPENSE') THEN je.debit_amount - je.credit_amount
                   ELSE je.credit_amount - je.debit_amount
                 END
               ),0)::numeric(18,2) AS amount
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE ${['t.company_id = $1', ...filters].join(' AND ')}
         GROUP BY a.id, a.code, a.name, a.type
      `;
      const { rows } = await db.query(sql, pf);

      const assets = [];
      const liabilities = [];
      const equity = [];
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;

      for (const r of rows) {
        const amt = n(r.amount);
        if (r.type === 'ASSET') {
          assets.push({ id: r.id, code: r.code, name: r.name, amount: amt.toFixed(2) });
          totalAssets += amt;
        } else if (r.type === 'LIABILITY') {
          liabilities.push({ id: r.id, code: r.code, name: r.name, amount: amt.toFixed(2) });
          totalLiabilities += amt;
        } else if (r.type === 'EQUITY') {
          equity.push({ id: r.id, code: r.code, name: r.name, amount: amt.toFixed(2) });
          totalEquity += amt;
        }
      }

      return {
        balanceSheet: { assets, liabilities, equity },
        summary: {
          totalAssets: totalAssets.toFixed(2),
          totalLiabilities: totalLiabilities.toFixed(2),
          totalEquity: totalEquity.toFixed(2),
          isBalanced: totalAssets.toFixed(2) === (totalLiabilities + totalEquity).toFixed(2),
        },
      };
    };

    const current = await compute(as_of_date);
    let comparativeData = null;
    if (comparative && compare_as_of_date) {
      comparativeData = await compute(compare_as_of_date);
    }

    return {
      ...current,
      comparative: comparativeData,
    };
  }

  /** PUBLIC_INTERFACE
   * getProfitLoss(companyId, options)
   * options: { start_date, end_date, comparative?: boolean, compare_start_date?, compare_end_date?, drilldown?: boolean }
   */
  static async getProfitLoss(companyId, options = {}) {
    const { start_date, end_date, comparative = false, compare_start_date, compare_end_date, drilldown = false } = options || {};
    if (!start_date || !end_date) {
      const err = new Error('Date range required');
      err.status = 400;
      throw err;
    }

    const compute = async (sd, ed) => {
      const sql = `
        SELECT a.id, a.code, a.name, a.type,
               COALESCE(SUM(
                 CASE
                   WHEN a.type = 'REVENUE' THEN je.credit_amount - je.debit_amount
                   WHEN a.type = 'EXPENSE' THEN je.debit_amount - je.credit_amount
                   ELSE 0
                 END
               ),0)::numeric(18,2) AS amount
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
         WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3
         GROUP BY a.id, a.code, a.name, a.type
      `;
      const { rows } = await db.query(sql, [companyId, sd, ed]);

      const revenue = [];
      const expenses = [];
      let totalRevenue = 0;
      let totalExpenses = 0;
      for (const r of rows) {
        const amt = n(r.amount);
        if (r.type === 'REVENUE') {
          revenue.push({ id: r.id, code: r.code, name: r.name, amount: amt.toFixed(2) });
          totalRevenue += amt;
        } else if (r.type === 'EXPENSE') {
          expenses.push({ id: r.id, code: r.code, name: r.name, amount: amt.toFixed(2) });
          totalExpenses += amt;
        }
      }
      const netIncome = totalRevenue - totalExpenses;

      let drill = {};
      if (drilldown && (revenue.length || expenses.length)) {
        const accountIds = [...revenue, ...expenses].map(a => a.id);
        if (accountIds.length) {
          const placeholders = accountIds.map((_, i) => `$${i + 2}`).join(', ');
          const dsql = `
            SELECT a.id as account_id, t.id as transaction_id, t.date, t.description, t.reference,
                   je.debit_amount, je.credit_amount
              FROM journal_entries je
              JOIN transactions t ON t.id = je.transaction_id
              JOIN accounts a ON a.id = je.account_id
             WHERE t.company_id = $1 AND a.id IN (${placeholders})
               AND t.date BETWEEN $${accountIds.length + 2} AND $${accountIds.length + 3}
             ORDER BY a.id, t.date, t.id
          `;
          const dparams = [companyId, ...accountIds, sd, ed];
          const { rows: drows } = await db.query(dsql, dparams);
          drill = drows.reduce((acc, r) => {
            const list = acc[r.account_id] || [];
            list.push({
              transaction_id: r.transaction_id,
              date: r.date,
              description: r.description,
              reference: r.reference,
              debit: r.debit_amount,
              credit: r.credit_amount,
            });
            acc[r.account_id] = list;
            return acc;
          }, {});
        }
      }

      return {
        profitLoss: {
          revenue: revenue.map(a => ({ ...a, ...(drilldown ? { lines: drill[a.id] || [] } : {}) })),
          expenses: expenses.map(a => ({ ...a, ...(drilldown ? { lines: drill[a.id] || [] } : {}) })),
        },
        summary: {
          totalRevenue: totalRevenue.toFixed(2),
          totalExpenses: totalExpenses.toFixed(2),
          netIncome: netIncome.toFixed(2),
          netIncomePercent: totalRevenue !== 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : '0.00',
        },
        chart: {
          labels: ['Revenue', 'Expenses', 'Net Income'],
          datasets: [{
            label: 'Amount',
            data: [totalRevenue, totalExpenses, netIncome],
          }],
        },
      };
    };

    const current = await compute(start_date, end_date);
    let comparativeData = null;
    if (comparative && compare_start_date && compare_end_date) {
      comparativeData = await compute(compare_start_date, compare_end_date);
    }
    return {
      ...current,
      comparative: comparativeData,
    };
  }

  /** PUBLIC_INTERFACE
   * getGeneralLedger(companyId, options)
   * options: { start_date?, end_date?, account_id?, account_code?, page?, limit? }
   */
  static async getGeneralLedger(companyId, options = {}) {
    const { start_date, end_date, account_id, account_code, page = 1, limit = 100 } = options || {};
    let params = [companyId];
    const filters = ['t.company_id = $1'];
    if (account_id) {
      params.push(account_id);
      filters.push(`je.account_id = $${params.length}`);
    } else if (account_code) {
      params.push(account_code);
      filters.push(`a.code = $${params.length}`);
    }
    if (start_date) {
      params.push(start_date);
      filters.push(`t.date >= $${params.length}`);
    }
    if (end_date) {
      params.push(end_date);
      filters.push(`t.date <= $${params.length}`);
    }
    const where = filters.join(' AND ');

    const offset = (Number(page) - 1) * Number(limit);

    const sql = `
      SELECT a.id as account_id, a.code, a.name, t.id as transaction_id, t.date, t.description, t.reference,
             je.debit_amount, je.credit_amount
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE ${where}
       ORDER BY a.code, t.date, t.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await db.query(sql, [...params, limit, offset]);

    // Build ledger grouped by account
    const ledger = {};
    for (const r of rows) {
      const key = `${r.account_id}|${r.code}`;
      if (!ledger[key]) {
        ledger[key] = {
          account_id: r.account_id,
          code: r.code,
          name: r.name,
          entries: [],
        };
      }
      ledger[key].entries.push({
        transaction_id: r.transaction_id,
        date: r.date,
        description: r.description,
        reference: r.reference,
        debit: r.debit_amount,
        credit: r.credit_amount,
      });
    }

    // Totals per account
    Object.values(ledger).forEach(acc => {
      let deb = 0; let cre = 0;
      acc.entries.forEach(e => {
        deb += n(e.debit);
        cre += n(e.credit);
      });
      acc.total_debits = deb.toFixed(2);
      acc.total_credits = cre.toFixed(2);
      acc.balance = (deb - cre).toFixed(2);
    });

    return { ledger: Object.values(ledger), pagination: { page: Number(page), limit: Number(limit) } };
  }

  /** PUBLIC_INTERFACE
   * getCashFlow(companyId, options)
   * options: { start_date, end_date }
   * Method: Indirect cash flow (Operating from P&L + working capital, Investing/Financing from account groupings).
   * Note: This is a simplified baseline. Companies can customize mappings later.
   */
  static async getCashFlow(companyId, options = {}) {
    const { start_date, end_date } = options || {};
    if (!start_date || !end_date) {
      const err = new Error('Date range required');
      err.status = 400;
      throw err;
    }

    // Operating: net income approximation from P&L
    const pnl = await ReportingService.getProfitLoss(companyId, { start_date, end_date });
    const netIncome = n(pnl.summary.netIncome);

    // Working capital change: approximate with delta of AR, AP, Inventory (by code hints)
    const workingSql = `
      WITH period AS (
        SELECT $2::date AS sd, $3::date AS ed
      ),
      balances AS (
        SELECT a.id, a.code, a.type,
               SUM(je.debit_amount - je.credit_amount) AS delta
          FROM journal_entries je
          JOIN transactions t ON t.id = je.transaction_id
          JOIN accounts a ON a.id = je.account_id
          JOIN period p ON TRUE
         WHERE t.company_id = $1 AND t.date BETWEEN p.sd AND p.ed
         GROUP BY a.id, a.code, a.type
      )
      SELECT
        COALESCE(SUM(CASE WHEN a.type = 'ASSET' AND (LOWER(a.code) LIKE '%receivable%' OR LOWER(a.code) LIKE '%ar%') THEN balances.delta END),0) AS change_ar,
        COALESCE(SUM(CASE WHEN a.type = 'ASSET' AND (LOWER(a.code) LIKE '%inventory%') THEN balances.delta END),0) AS change_inventory,
        COALESCE(SUM(CASE WHEN a.type = 'LIABILITY' AND (LOWER(a.code) LIKE '%payable%' OR LOWER(a.code) LIKE '%ap%') THEN balances.delta END),0) AS change_ap
      FROM balances
      JOIN accounts a ON a.id = balances.id
    `;
    const { rows: wr } = await db.query(workingSql, [companyId, start_date, end_date]);
    const changeAR = n(wr[0]?.change_ar);
    const changeInv = n(wr[0]?.change_inventory);
    const changeAP = n(wr[0]?.change_ap);

    // Operating cash flow (simplified): Net income - increase in AR - increase in Inventory + increase in AP
    const cashFromOps = netIncome - changeAR - changeInv + changeAP;

    // Investing: proxy using assets with 'fixed'/'investment' in code
    const investSql = `
      SELECT COALESCE(SUM(je.debit_amount - je.credit_amount),0) AS delta
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3 AND a.type = 'ASSET'
         AND (LOWER(a.code) LIKE '%fixed%' OR LOWER(a.code) LIKE '%investment%')
    `;
    const { rows: invr } = await db.query(investSql, [companyId, start_date, end_date]);
    const cashFromInvesting = -n(invr[0]?.delta); // purchases reduce cash

    // Financing: proxy using liability/equity changes (excluding AP)
    const financeSql = `
      SELECT
        COALESCE(SUM(CASE WHEN a.type = 'LIABILITY' AND (LOWER(a.code) NOT LIKE '%ap%' AND LOWER(a.code) NOT LIKE '%payable%')
          THEN (je.credit_amount - je.debit_amount) END),0) AS inc_liab,
        COALESCE(SUM(CASE WHEN a.type = 'EQUITY' THEN (je.credit_amount - je.debit_amount) END),0) AS inc_equity
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3
    `;
    const { rows: finr } = await db.query(financeSql, [companyId, start_date, end_date]);
    const cashFromFinancing = n(finr[0]?.inc_liab) + n(finr[0]?.inc_equity);

    return {
      cashFlow: {
        operating: cashFromOps.toFixed(2),
        investing: cashFromInvesting.toFixed(2),
        financing: cashFromFinancing.toFixed(2),
      },
      summary: {
        netChangeInCash: (cashFromOps + cashFromInvesting + cashFromFinancing).toFixed(2),
      },
      chart: {
        labels: ['Operating', 'Investing', 'Financing'],
        datasets: [{ label: 'Cash Flow', data: [cashFromOps, cashFromInvesting, cashFromFinancing] }],
      },
    };
  }

  /** PUBLIC_INTERFACE
   * getChangesInEquity(companyId, options)
   * options: { start_date, end_date }
   */
  static async getChangesInEquity(companyId, options = {}) {
    const { start_date, end_date } = options || {};
    if (!start_date || !end_date) {
      const err = new Error('Date range required');
      err.status = 400;
      throw err;
    }
    const sql = `
      SELECT a.id, a.code, a.name,
             COALESCE(SUM(je.credit_amount - je.debit_amount),0)::numeric(18,2) AS amount
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3 AND a.type = 'EQUITY'
       GROUP BY a.id, a.code, a.name
       ORDER BY a.code
    `;
    const { rows } = await db.query(sql, [companyId, start_date, end_date]);
    const total = rows.reduce((s, r) => s + n(r.amount), 0);
    return {
      changesInEquity: rows.map(r => ({ id: r.id, code: r.code, name: r.name, amount: n(r.amount).toFixed(2) })),
      summary: { total: total.toFixed(2) },
    };
  }

  /** PUBLIC_INTERFACE
   * getAgedReceivables(companyId, options)
   * options: { as_of_date, buckets?: [30,60,90,120] }
   */
  static async getAgedReceivables(companyId, options = {}) {
    const { as_of_date, buckets = [30, 60, 90, 120] } = options || {};
    const cutoff = as_of_date || new Date().toISOString().slice(0, 10);

    // We approximate receivables by accounts with code keywords.
    const sql = `
      SELECT t.id as transaction_id, t.date, t.description, t.reference,
             (je.debit_amount - je.credit_amount) AS amount
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date <= $2
         AND a.type = 'ASSET' AND (LOWER(a.code) LIKE '%receivable%' OR LOWER(a.code) LIKE '%ar%')
    `;
    const { rows } = await db.query(sql, [companyId, cutoff]);

    const today = new Date(cutoff);
    const aging = { current: 0, [`${buckets[0]}d`]: 0, [`${buckets[1]}d`]: 0, [`${buckets[2]}d`]: 0, over: 0 };
    for (const r of rows) {
      const d = new Date(r.date);
      const days = Math.floor((today - d) / (1000 * 60 * 60 * 24));
      const amt = n(r.amount);
      if (days <= buckets[0]) aging.current += amt;
      else if (days <= buckets[1]) aging[`${buckets[0]}d`] += amt;
      else if (days <= buckets[2]) aging[`${buckets[1]}d`] += amt;
      else aging.over += amt;
    }

    return {
      agedReceivables: aging,
      chart: {
        labels: ['Current', `${buckets[0]}d`, `${buckets[1]}d`, `${buckets[2]}d`, 'Over'],
        datasets: [{ label: 'Receivables', data: [aging.current, aging[`${buckets[0]}d`], aging[`${buckets[1]}d`], aging[`${buckets[2]}d`], aging.over] }],
      },
    };
  }

  /** PUBLIC_INTERFACE
   * getAgedPayables(companyId, options)
   * options: { as_of_date, buckets?: [30,60,90,120] }
   */
  static async getAgedPayables(companyId, options = {}) {
    const { as_of_date, buckets = [30, 60, 90, 120] } = options || {};
    const cutoff = as_of_date || new Date().toISOString().slice(0, 10);

    const sql = `
      SELECT t.id as transaction_id, t.date, t.description, t.reference,
             (je.credit_amount - je.debit_amount) AS amount
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date <= $2
         AND a.type = 'LIABILITY' AND (LOWER(a.code) LIKE '%payable%' OR LOWER(a.code) LIKE '%ap%')
    `;
    const { rows } = await db.query(sql, [companyId, cutoff]);

    const today = new Date(cutoff);
    const aging = { current: 0, [`${buckets[0]}d`]: 0, [`${buckets[1]}d`]: 0, [`${buckets[2]}d`]: 0, over: 0 };
    for (const r of rows) {
      const d = new Date(r.date);
      const days = Math.floor((today - d) / (1000 * 60 * 60 * 24));
      const amt = n(r.amount);
      if (days <= buckets[0]) aging.current += amt;
      else if (days <= buckets[1]) aging[`${buckets[0]}d`] += amt;
      else if (days <= buckets[2]) aging[`${buckets[1]}d`] += amt;
      else aging.over += amt;
    }

    return {
      agedPayables: aging,
      chart: {
        labels: ['Current', `${buckets[0]}d`, `${buckets[1]}d`, `${buckets[2]}d`, 'Over'],
        datasets: [{ label: 'Payables', data: [aging.current, aging[`${buckets[0]}d`], aging[`${buckets[1]}d`], aging[`${buckets[2]}d`], aging.over] }],
      },
    };
  }

  /** PUBLIC_INTERFACE
   * getBudgetVsActual(companyId, options)
   * options: { start_date, end_date }
   * If budgets table is not present, returns zeros for budget; app can still render.
   * Expected budgets table (future): budgets(company_id, account_id, period, amount)
   */
  static async getBudgetVsActual(companyId, options = {}) {
    const { start_date, end_date } = options || {};
    if (!start_date || !end_date) {
      const err = new Error('Date range required');
      err.status = 400;
      throw err;
    }

    // Actuals by account (P&L accounts)
    const actualSql = `
      SELECT a.id, a.code, a.name, a.type,
             COALESCE(SUM(
               CASE
                 WHEN a.type = 'REVENUE' THEN je.credit_amount - je.debit_amount
                 WHEN a.type = 'EXPENSE' THEN je.debit_amount - je.credit_amount
                 ELSE 0
               END
             ),0)::numeric(18,2) AS actual
        FROM journal_entries je
        JOIN transactions t ON t.id = je.transaction_id
        JOIN accounts a ON a.id = je.account_id
       WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3 AND a.type IN ('REVENUE','EXPENSE')
       GROUP BY a.id, a.code, a.name, a.type
    `;
    const { rows: actuals } = await db.query(actualSql, [companyId, start_date, end_date]);

    // Budgets (try-catch in case table doesn't exist)
    let budgets = [];
    try {
      const budgetSql = `
        SELECT b.account_id as id, a.code, a.name, a.type,
               COALESCE(SUM(b.amount),0)::numeric(18,2) AS budget
          FROM budgets b
          JOIN accounts a ON a.id = b.account_id
         WHERE b.company_id = $1 AND b.period BETWEEN $2 AND $3
         GROUP BY b.account_id, a.code, a.name, a.type
      `;
      const { rows } = await db.query(budgetSql, [companyId, start_date, end_date]);
      budgets = rows;
    } catch {
      // budgets table not present; proceed with zeros
      budgets = [];
    }

    const budgetMap = budgets.reduce((acc, b) => {
      acc[b.id] = n(b.budget);
      return acc;
    }, {});

    const lines = actuals.map(a => {
      const budget = budgetMap[a.id] || 0;
      const actual = n(a.actual);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        budget: budget.toFixed(2),
        actual: actual.toFixed(2),
        variance: (actual - budget).toFixed(2),
        variancePercent: budget !== 0 ? (((actual - budget) / budget) * 100).toFixed(2) : '0.00',
      };
    });

    return {
      budgetVsActual: lines,
      chart: {
        labels: lines.map(l => l.code),
        datasets: [
          { label: 'Budget', data: lines.map(l => Number(l.budget)) },
          { label: 'Actual', data: lines.map(l => Number(l.actual)) },
        ],
      },
    };
  }
}

module.exports = ReportingService;
