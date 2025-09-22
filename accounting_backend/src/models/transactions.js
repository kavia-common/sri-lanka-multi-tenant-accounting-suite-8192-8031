const db = require('../config/database');

/**
 * Transactions model: double-entry transactions and journal entries with atomic posting.
 */

function sumAmounts(entries) {
  let debits = 0;
  let credits = 0;
  for (const e of entries) {
    debits += Number(e.debit_amount || 0);
    credits += Number(e.credit_amount || 0);
  }
  return { debits, credits };
}

// PUBLIC_INTERFACE
async function createTransaction(companyId, { date, description, reference, entries }, client) {
  const { debits, credits } = sumAmounts(entries);
  if (debits <= 0 || credits <= 0 || debits.toFixed(2) !== credits.toFixed(2)) {
    const err = new Error('Unbalanced transaction. Debits must equal credits.');
    err.status = 400;
    throw err;
  }

  // Insert transaction
  const txRes = await client.query(
    `INSERT INTO transactions (company_id, date, description, reference, total_amount, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, company_id, date, description, reference, total_amount, created_at`,
    [companyId, date, description, reference || null, debits]
  );
  const transaction = txRes.rows[0];

  // Insert journal entries and update account balances
  for (const e of entries) {
    // Ensure account belongs to company
    const acc = await client.query(
      'SELECT id, type FROM accounts WHERE id = $1 AND company_id = $2',
      [e.account_id, companyId]
    );
    if (!acc.rows[0]) {
      const err = new Error('Account not found in company.');
      err.status = 400;
      throw err;
    }

    await client.query(
      `INSERT INTO journal_entries
         (transaction_id, account_id, debit_amount, credit_amount, description, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [transaction.id, e.account_id, e.debit_amount || 0, e.credit_amount || 0, e.description || null]
    );

    // Balance update follows accounting type sign convention:
    // Assets/Expenses increase with debits, Liabilities/Equity/Revenue increase with credits.
    const debit = Number(e.debit_amount || 0);
    const credit = Number(e.credit_amount || 0);
    const type = acc.rows[0].type;
    let delta = 0;
    if (type === 'ASSET' || type === 'EXPENSE') {
      delta = debit - credit;
    } else {
      delta = credit - debit;
    }
    await client.query(
      'UPDATE accounts SET balance = balance + $2, updated_at = NOW() WHERE id = $1',
      [e.account_id, delta]
    );
  }

  return transaction;
}

// PUBLIC_INTERFACE
async function listTransactions(companyId, { page = 1, limit = 50, start_date, end_date }) {
  const offset = (page - 1) * limit;

  const where = ['company_id = $1'];
  const params = [companyId];
  if (start_date) {
    where.push(`date >= $${params.length + 1}`);
    params.push(start_date);
  }
  if (end_date) {
    where.push(`date <= $${params.length + 1}`);
    params.push(end_date);
  }
  const countSql = `SELECT COUNT(*)::int AS cnt FROM transactions WHERE ${where.join(' AND ')}`;
  const countRes = await db.query(countSql, params);
  const total = countRes.rows[0].cnt;

  const params2 = [...params, limit, offset];
  const sql = `
    SELECT id, company_id, date, description, reference, total_amount, created_at
      FROM transactions
     WHERE ${where.join(' AND ')}
     ORDER BY date DESC, created_at DESC
     LIMIT $${params2.length - 1} OFFSET $${params2.length}
  `;
  const txRes = await db.query(sql, params2);

  return {
    transactions: txRes.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// PUBLIC_INTERFACE
async function getTransaction(companyId, transactionId) {
  const { rows: txRows } = await db.query(
    `SELECT id, company_id, date, description, reference, total_amount, created_at
       FROM transactions
      WHERE id = $1 AND company_id = $2`,
    [transactionId, companyId]
  );
  if (!txRows[0]) return null;

  const { rows: entries } = await db.query(
    `SELECT je.id, je.transaction_id, je.account_id, je.debit_amount, je.credit_amount, je.description, je.created_at,
            a.code as account_code, a.name as account_name
       FROM journal_entries je
       JOIN accounts a ON a.id = je.account_id
      WHERE je.transaction_id = $1
      ORDER BY je.id ASC`,
    [transactionId]
  );

  return { ...txRows[0], entries };
}

module.exports = {
  createTransaction,
  listTransactions,
  getTransaction,
};
