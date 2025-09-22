const db = require('../config/database');

/**
 * Reports model: trial balance, balance sheet, profit & loss.
 * These aggregations use journal entries ensuring company scoping.
 */

// PUBLIC_INTERFACE
async function getTrialBalance(companyId, { start_date, end_date }) {
  const params = [companyId];
  const filters = ['t.company_id = $1'];
  if (start_date) {
    params.push(start_date);
    filters.push(`t.date >= $${params.length}`);
  }
  if (end_date) {
    params.push(end_date);
    filters.push(`t.date <= $${params.length}`);
  }

  const sql = `
    SELECT a.code, a.name, a.type,
           SUM(je.debit_amount)::numeric(18,2) AS total_debits,
           SUM(je.credit_amount)::numeric(18,2) AS total_credits,
           (COALESCE(SUM(je.debit_amount),0) - COALESCE(SUM(je.credit_amount),0))::numeric(18,2) AS balance
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.id = je.account_id
     WHERE ${filters.join(' AND ')}
     GROUP BY a.code, a.name, a.type
     ORDER BY a.code ASC
  `;

  const { rows } = await db.query(sql, params);

  let totalDebits = 0;
  let totalCredits = 0;
  for (const r of rows) {
    totalDebits += Number(r.total_debits || 0);
    totalCredits += Number(r.total_credits || 0);
  }
  return {
    trialBalance: rows.map((r) => ({
      code: r.code,
      name: r.name,
      type: r.type,
      total_debits: r.total_debits?.toString() ?? '0.00',
      total_credits: r.total_credits?.toString() ?? '0.00',
      balance: r.balance?.toString() ?? '0.00',
    })),
    summary: {
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced: totalDebits.toFixed(2) === totalCredits.toFixed(2),
    },
  };
}

// PUBLIC_INTERFACE
async function getBalanceSheet(companyId, { as_of_date }) {
  const params = [companyId];
  const filters = ['t.company_id = $1'];
  if (as_of_date) {
    params.push(as_of_date);
    filters.push(`t.date <= $${params.length}`);
  }

  const sql = `
    SELECT a.code, a.name, a.type,
           COALESCE(SUM(je.debit_amount - je.credit_amount),0)::numeric(18,2) AS net
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.id = je.account_id
     WHERE ${filters.join(' AND ')}
     GROUP BY a.code, a.name, a.type
  `;

  const { rows } = await db.query(sql, params);

  const assets = [];
  const liabilities = [];
  const equity = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const r of rows) {
    const net = Number(r.net || 0);
    if (r.type === 'ASSET') {
      assets.push({ code: r.code, name: r.name, amount: net.toFixed(2) });
      totalAssets += net;
    } else if (r.type === 'LIABILITY') {
      const amount = (-net).toFixed(2);
      liabilities.push({ code: r.code, name: r.name, amount });
      totalLiabilities += -net;
    } else if (r.type === 'EQUITY') {
      const amount = (-net).toFixed(2);
      equity.push({ code: r.code, name: r.name, amount });
      totalEquity += -net;
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
}

// PUBLIC_INTERFACE
async function getProfitLoss(companyId, { start_date, end_date }) {
  if (!start_date || !end_date) {
    const err = new Error('Date range required');
    err.status = 400;
    throw err;
  }
  const params = [companyId, start_date, end_date];

  const sql = `
    SELECT a.code, a.name, a.type,
           COALESCE(SUM(je.debit_amount - je.credit_amount),0)::numeric(18,2) AS net
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.id = je.account_id
     WHERE t.company_id = $1 AND t.date BETWEEN $2 AND $3
     GROUP BY a.code, a.name, a.type
  `;

  const { rows } = await db.query(sql, params);

  const revenue = [];
  const expenses = [];
  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const r of rows) {
    const net = Number(r.net || 0);
    if (r.type === 'REVENUE') {
      const amount = (-net);
      revenue.push({ code: r.code, name: r.name, amount: amount.toFixed(2) });
      totalRevenue += amount;
    } else if (r.type === 'EXPENSE') {
      const amount = net;
      expenses.push({ code: r.code, name: r.name, amount: amount.toFixed(2) });
      totalExpenses += amount;
    }
  }

  const netIncome = totalRevenue - totalExpenses;
  const netIncomePercent = totalRevenue !== 0 ? (netIncome / totalRevenue) * 100 : 0;

  return {
    profitLoss: { revenue, expenses },
    summary: {
      totalRevenue: totalRevenue.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netIncome: netIncome.toFixed(2),
      netIncomePercent: `${netIncomePercent.toFixed(2)}%`,
    },
  };
}

module.exports = {
  getTrialBalance,
  getBalanceSheet,
  getProfitLoss,
};
