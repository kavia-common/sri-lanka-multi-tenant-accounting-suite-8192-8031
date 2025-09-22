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

/**
 * ========== Advanced helpers (module scope) ==========
 */
const toNum = (v) => {
  const num = Number(v || 0);
  return Number.isFinite(num) ? num : 0;
};

// Build parameterized WHERE for speed and index usage (t.company_id, t.date)
function whereForRange(companyId, range, startIndex = 1) {
  const clauses = [`t.company_id = $${startIndex}`];
  const params = [companyId];
  let idx = startIndex + 1;
  if (range.as_of_date) {
    clauses.push(`t.date <= $${idx++}`);
    params.push(range.as_of_date);
  } else {
    if (range.start_date) {
      clauses.push(`t.date >= $${idx++}`);
      params.push(range.start_date);
    }
    if (range.end_date) {
      clauses.push(`t.date <= $${idx++}`);
      params.push(range.end_date);
    }
  }
  return { where: clauses.join(' AND '), params, nextIndex: idx };
}

async function queryActualsByAccount(companyId, range, { accountTypes }) {
  const { where, params } = whereForRange(companyId, range);
  const sql = `
    SELECT a.id, a.code, a.name, a.type,
           COALESCE(SUM(
             CASE
               WHEN a.type = 'REVENUE' THEN je.credit_amount - je.debit_amount
               WHEN a.type = 'EXPENSE' THEN je.debit_amount - je.credit_amount
               WHEN a.type IN ('ASSET','EQUITY','LIABILITY')
                 THEN (CASE WHEN a.type IN ('ASSET','EXPENSE') THEN je.debit_amount - je.credit_amount
                       ELSE je.credit_amount - je.debit_amount END)
               ELSE 0
             END
           ),0)::numeric(18,2) AS amount
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.id = je.account_id
     WHERE ${where}
       ${accountTypes && accountTypes.length ? `AND a.type IN (${accountTypes.map((_, i) => '$' + (params.length + i + 1)).join(',')})` : ''}
     GROUP BY a.id, a.code, a.name, a.type
  `;
  const typesParams = accountTypes && accountTypes.length ? [...params, ...accountTypes] : params;
  const { rows } = await db.query(sql, typesParams);
  return rows;
}

async function queryBudgetByAccount(companyId, range, budget_source) {
  // Supports 'table:budgets' and fallback 'zero' or 'prior_year'
  if (budget_source === 'zero') return [];
  if (budget_source === 'prior_year') {
    // Move range back one year
    const adj = (d) => d ? new Date(new Date(d).setFullYear(new Date(d).getFullYear() - 1)).toISOString().slice(0, 10) : null;
    const prior = { start_date: adj(range.start_date), end_date: adj(range.end_date), as_of_date: adj(range.as_of_date) };
    // Return 'actuals' for prior period as budget
    const rows = await queryActualsByAccount(companyId, prior, { accountTypes: ['REVENUE', 'EXPENSE'] });
    return rows.map(r => ({ id: r.id, code: r.code, name: r.name, type: r.type, budget: r.amount }));
  }
  // Default: try budgets table
  try {
    // Use start/end; if not provided but as_of_date provided, we treat that as end with start at fiscal year start baseline
    let sd = range.start_date, ed = range.end_date;
    if (!sd && range.as_of_date) {
      sd = `${new Date(range.as_of_date).getFullYear()}-01-01`;
      ed = range.as_of_date;
    }
    const sql = `
      SELECT b.account_id AS id, a.code, a.name, a.type,
             COALESCE(SUM(b.amount),0)::numeric(18,2) AS budget
        FROM budgets b
        JOIN accounts a ON a.id = b.account_id
       WHERE b.company_id = $1 AND (b.period BETWEEN $2 AND $3)
       GROUP BY b.account_id, a.code, a.name, a.type
    `;
    const { rows } = await db.query(sql, [companyId, sd, ed]);
    return rows;
  } catch {
    return [];
  }
}

function mergeActualBudget(actuals, budgets) {
  const bmap = (budgets || []).reduce((acc, b) => { acc[b.id] = toNum(b.budget); return acc; }, {});
  return (actuals || []).map(a => {
    const actual = toNum(a.amount ?? a.actual);
    const budget = bmap[a.id] || 0;
    const variance = actual - budget;
    return {
      id: a.id, code: a.code, name: a.name, type: a.type,
      actual: actual.toFixed(2),
      budget: budget.toFixed(2),
      variance: variance.toFixed(2),
      variancePercent: budget !== 0 ? ((variance / budget) * 100).toFixed(2) : '0.00',
    };
  });
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

  /** PUBLIC_INTERFACE
   * getProfitLossAdvanced(companyId, {periods, comparePeriods, budget_source})
   */
  static async getProfitLossAdvanced(companyId, { periods = [], comparePeriods = [], budget_source = 'table:budgets' } = {}) {
    const base = periods[0] || {};
    if (!(base.start_date && base.end_date)) {
      const err = new Error('Primary period range (start..end) required');
      err.status = 400;
      throw err;
    }
    const [actuals, budgets] = await Promise.all([
      queryActualsByAccount(companyId, base, { accountTypes: ['REVENUE', 'EXPENSE'] }),
      queryBudgetByAccount(companyId, base, budget_source),
    ]);
    const lines = mergeActualBudget(actuals, budgets);

    const tot = lines.reduce((acc, l) => {
      const a = toNum(l.actual), b = toNum(l.budget);
      if (l.type === 'REVENUE') { acc.actRev += a; acc.budRev += b; }
      else if (l.type === 'EXPENSE') { acc.actExp += a; acc.budExp += b; }
      return acc;
    }, { actRev: 0, actExp: 0, budRev: 0, budExp: 0 });
    const summary = {
      totalActualRevenue: tot.actRev.toFixed(2),
      totalActualExpenses: tot.actExp.toFixed(2),
      netActualIncome: (tot.actRev - tot.actExp).toFixed(2),
      totalBudgetRevenue: tot.budRev.toFixed(2),
      totalBudgetExpenses: tot.budExp.toFixed(2),
      netBudgetIncome: (tot.budRev - tot.budExp).toFixed(2),
      variance: ((tot.actRev - tot.actExp) - (tot.budRev - tot.budExp)).toFixed(2),
    };

    const comparative = [];
    for (const cmp of comparePeriods) {
      if (!(cmp.start_date && cmp.end_date)) continue;
      const [a2, b2] = await Promise.all([
        queryActualsByAccount(companyId, cmp, { accountTypes: ['REVENUE', 'EXPENSE'] }),
        queryBudgetByAccount(companyId, cmp, budget_source),
      ]);
      comparative.push({
        period: cmp,
        lines: mergeActualBudget(a2, b2),
      });
    }

    return {
      meta: { base },
      payload: { profitLoss: { lines }, summary },
      comparative,
    };
  }

  /** PUBLIC_INTERFACE
   * getBalanceSheetAdvanced(companyId, {periods, comparePeriods, budget_source})
   * For BS, periods array should contain objects with as_of_date.
   */
  static async getBalanceSheetAdvanced(companyId, { periods = [], comparePeriods = [], budget_source = 'table:budgets' } = {}) {
    const base = periods[0] || {};
    const asOf = base.as_of_date;
    const rows = await queryActualsByAccount(companyId, { as_of_date: asOf }, { accountTypes: ['ASSET', 'LIABILITY', 'EQUITY'] });
    const budgets = budget_source === 'zero' ? [] : await queryBudgetByAccount(companyId, { as_of_date: asOf }, budget_source);
    const merged = mergeActualBudget(rows, budgets);

    const assets = []; const liabilities = []; const equity = [];
    let ta = 0, tl = 0, te = 0;
    for (const r of merged) {
      const actual = toNum(r.actual);
      if (r.type === 'ASSET') { assets.push({ code: r.code, name: r.name, amount: r.actual }); ta += actual; }
      if (r.type === 'LIABILITY') { liabilities.push({ code: r.code, name: r.name, amount: r.actual }); tl += actual; }
      if (r.type === 'EQUITY') { equity.push({ code: r.code, name: r.name, amount: r.actual }); te += actual; }
    }
    const payload = {
      balanceSheet: { assets, liabilities, equity },
      summary: {
        totalAssets: ta.toFixed(2),
        totalLiabilities: tl.toFixed(2),
        totalEquity: te.toFixed(2),
        isBalanced: ta.toFixed(2) === (tl + te).toFixed(2),
      },
    };

    const comparative = [];
    for (const cmp of comparePeriods) {
      if (!cmp.as_of_date) continue;
      const crow = await queryActualsByAccount(companyId, { as_of_date: cmp.as_of_date }, { accountTypes: ['ASSET', 'LIABILITY', 'EQUITY'] });
      comparative.push({ period: cmp, lines: crow });
    }

    return { meta: { base }, payload, comparative };
  }

  /** PUBLIC_INTERFACE
   * getTrialBalanceAdvanced(companyId, {periods, comparePeriods, budget_source})
   */
  static async getTrialBalanceAdvanced(companyId, { periods = [], comparePeriods = [], budget_source = 'table:budgets' } = {}) {
    const base = periods[0] || {};
    const range = base.as_of_date ? { as_of_date: base.as_of_date } : { start_date: base.start_date, end_date: base.end_date };
    const actuals = await queryActualsByAccount(companyId, range, { accountTypes: [] }); // all types
    const budgets = await queryBudgetByAccount(companyId, range, budget_source);
    const lines = mergeActualBudget(actuals, budgets);

    let totalDebits = 0, totalCredits = 0;
    actuals.forEach(r => {
      const type = r.type;
      const amt = toNum(r.amount);
      // Derive debits/credits orientation
      if (type === 'REVENUE' || type === 'LIABILITY' || type === 'EQUITY') {
        if (amt < 0) totalDebits += Math.abs(amt); else totalCredits += amt;
      } else {
        if (amt >= 0) totalDebits += amt; else totalCredits += Math.abs(amt);
      }
    });

    const payload = {
      trialBalance: lines.map(l => ({
        code: l.code,
        name: l.name,
        type: l.type,
        balance: (toNum(l.actual)).toFixed(2),
        total_debits: totalDebits.toFixed(2), // overall totals; per-account totals require further sums
        total_credits: totalCredits.toFixed(2),
        budget: l.budget, actual: l.actual, variance: l.variance, variancePercent: l.variancePercent,
      })),
    };

    const comparative = [];
    for (const cmp of comparePeriods) {
      const crange = cmp.as_of_date ? { as_of_date: cmp.as_of_date } : { start_date: cmp.start_date, end_date: cmp.end_date };
      const a2 = await queryActualsByAccount(companyId, crange, { accountTypes: [] });
      comparative.push({ period: cmp, lines: a2 });
    }

    const summary = { totalDebits: totalDebits.toFixed(2), totalCredits: totalCredits.toFixed(2), isBalanced: totalDebits.toFixed(2) === totalCredits.toFixed(2) };
    return { meta: { base }, payload: { ...payload, summary }, comparative };
  }

  /** PUBLIC_INTERFACE
   * getGeneralLedgerAdvanced(companyId, {periods, comparePeriods, paging, account_id, account_code})
   */
  static async getGeneralLedgerAdvanced(companyId, { periods = [], paging = {}, account_id, account_code } = {}) {
    const base = periods[0] || {};
    const start_date = base.start_date, end_date = base.end_date;
    const payload = await ReportingService.getGeneralLedger(companyId, { start_date, end_date, account_id, account_code, page: paging.page || 1, limit: paging.limit || 100 });
    return { meta: { base: { start_date, end_date } }, payload };
  }

  /** PUBLIC_INTERFACE
   * getCashFlowAdvanced(companyId, {periods})
   */
  static async getCashFlowAdvanced(companyId, { periods = [] } = {}) {
    const base = periods[0] || {};
    const start_date = base.start_date, end_date = base.end_date;
    const payload = await ReportingService.getCashFlow(companyId, { start_date, end_date });
    return { meta: { base: { start_date, end_date } }, payload };
  }

  /** PUBLIC_INTERFACE
   * getAgedReceivablesAdvanced(companyId, { periods, buckets })
   */
  static async getAgedReceivablesAdvanced(companyId, { periods = [], buckets = [30,60,90,120] } = {}) {
    const base = periods[0] || {};
    const as_of_date = base.as_of_date || new Date().toISOString().slice(0,10);
    const payload = await ReportingService.getAgedReceivables(companyId, { as_of_date, buckets });
    const bucketLabels = ['current', `${buckets[0]}d`, `${buckets[1]}d`, `${buckets[2]}d`, 'over'];
    return { meta: { base: { as_of_date }, bucketLabels }, payload };
  }

  /** PUBLIC_INTERFACE
   * getAgedPayablesAdvanced(companyId, { periods, buckets })
   */
  static async getAgedPayablesAdvanced(companyId, { periods = [], buckets = [30,60,90,120] } = {}) {
    const base = periods[0] || {};
    const as_of_date = base.as_of_date || new Date().toISOString().slice(0,10);
    const payload = await ReportingService.getAgedPayables(companyId, { as_of_date, buckets });
    const bucketLabels = ['current', `${buckets[0]}d`, `${buckets[1]}d`, `${buckets[2]}d`, 'over'];
    return { meta: { base: { as_of_date }, bucketLabels }, payload };
  }

  /** PUBLIC_INTERFACE
   * getBudgetVsActualAdvanced(companyId, { periods, budget_source })
   */
  static async getBudgetVsActualAdvanced(companyId, { periods = [], budget_source = 'table:budgets' } = {}) {
    const base = periods[0] || {};
    if (!(base.start_date && base.end_date)) {
      const err = new Error('Primary period range (start..end) required');
      err.status = 400;
      throw err;
    }
    const [actuals, budgets] = await Promise.all([
      queryActualsByAccount(companyId, base, { accountTypes: ['REVENUE', 'EXPENSE'] }),
      queryBudgetByAccount(companyId, base, budget_source),
    ]);
    const lines = mergeActualBudget(actuals, budgets);
    const summary = lines.reduce((acc, l) => {
      const a = toNum(l.actual), b = toNum(l.budget);
      if (l.type === 'REVENUE') { acc.totalActualRevenue += a; acc.totalBudgetRevenue += b; }
      else if (l.type === 'EXPENSE') { acc.totalActualExpenses += a; acc.totalBudgetExpenses += b; }
      return acc;
    }, { totalActualRevenue: 0, totalActualExpenses: 0, totalBudgetRevenue: 0, totalBudgetExpenses: 0 });
    summary.netActualIncome = (summary.totalActualRevenue - summary.totalActualExpenses).toFixed(2);
    summary.netBudgetIncome = (summary.totalBudgetRevenue - summary.totalBudgetExpenses).toFixed(2);

    return { meta: { base }, payload: { lines, summary: Object.fromEntries(Object.entries(summary).map(([k,v]) => [k, typeof v === 'number' ? v.toFixed(2) : v])) } };
  }
}

module.exports = ReportingService;
