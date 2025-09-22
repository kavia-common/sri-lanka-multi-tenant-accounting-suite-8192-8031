'use strict';

/**
 * DoubleEntryEngine.js
 * A comprehensive double-entry engine for multi-company accounting with PostgreSQL, robust validation, and logging.
 *
 * Responsibilities:
 * - processTransaction(singleEntry): Accept a single-entry transaction object and orchestrate mapping, validation, journal creation, and posting.
 * - validateTransaction(transaction): Validate debits=credits, existing accounts, positive amounts, valid company_id, user permission.
 * - determineAccountMapping(transactionType): Return debit/credit account mapping definitions per supported types.
 * - createJournalEntry(transaction, mapping): Translate a transaction + mapping into concrete journal entry lines.
 * - postToGeneralLedger(journalEntry): Persist transaction + lines atomically, update account balances.
 *
 * Assumptions:
 * - Database pool is provided by src/config/database.js (pg Pool).
 * - Existing tables (from 001_init.sql): companies, users, user_companies (user access), accounts, transactions, journal_entries, audit_log (or similar).
 * - Accounts table has id, company_id, code, name, type, balance, is_active.
 * - Transactions table contains id, company_id, date, description, reference, total_amount, created_by.
 * - Journal entries table contains id, transaction_id, account_id, debit_amount, credit_amount, description.
 *
 * Notes:
 * - This engine focuses on creating the underlying accounting entries and assumes controller routes call it with a user context.
 * - All environment configuration is read indirectly via config/database.js; do not read .env directly here.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const debugNs = 'services:DoubleEntryEngine';

// Simple logger shim to centralize logs. In real deployment, replace with Winston/Pino.
const log = {
  info: (...args) => console.log(`[INFO] [${debugNs}]`, ...args),
  warn: (...args) => console.warn(`[WARN] [${debugNs}]`, ...args),
  error: (...args) => console.error(`[ERROR] [${debugNs}]`, ...args),
};

/**
 * Helper to fetch single row.
 */
async function fetchOne(query, params, client) {
  const executor = client || db;
  const res = await executor.query(query, params);
  return res.rows[0] || null;
}

/**
 * Helper to fetch many rows.
 */
async function fetchMany(query, params, client) {
  const executor = client || db;
  const res = await executor.query(query, params);
  return res.rows || [];
}

/**
 * PUBLIC_INTERFACE
 * DoubleEntryEngine
 */
class DoubleEntryEngine {
  /**
   * PUBLIC_INTERFACE
   * processTransaction(singleEntry)
   * Orchestrates mapping, validation, journal entry creation and posting.
   * @param {Object} singleEntry - Input transaction with shape:
   *   {
   *     company_id: UUID,
   *     user_id: UUID, // actor performing transaction
   *     type: 'SALE' | 'CASH_SALE' | 'PURCHASE' | 'CASH_PURCHASE' | 'PAYMENT_RECEIVED' | 'PAYMENT_MADE',
   *     date: 'YYYY-MM-DD',
   *     description: string,
   *     reference?: string,
   *     amount: number, // positive decimal
   *     // optional hints for mapping: e.g., revenue_account_code, expense_account_code, ar_account_code, ap_account_code, cash_account_code, bank_account_code
   *     metadata?: object
   *   }
   * @returns {Promise<{status: 'success'|'error', message: string, data?: any, errors?: any[]}>}
   */
  static async processTransaction(singleEntry) {
    const startTs = Date.now();
    log.info('processTransaction: start', { company_id: singleEntry?.company_id, type: singleEntry?.type, reference: singleEntry?.reference });

    try {
      // Derive mapping for the transaction type
      const mapping = await this.determineAccountMapping(singleEntry);
      log.info('determineAccountMapping: mapping derived', mapping);

      // Build journal entry from mapping
      const journal = await this.createJournalEntry(singleEntry, mapping);
      log.info('createJournalEntry: journal created', { lines: journal?.entries?.length, debits: journal?.summary?.totalDebits, credits: journal?.summary?.totalCredits });

      // Validate constructed transaction
      const validation = await this.validateTransaction(journal);
      if (!validation.valid) {
        log.warn('validateTransaction: failed', validation);
        return {
          status: 'error',
          message: 'Validation failed',
          errors: validation.errors,
        };
      }

      // Persist transaction atomically
      const posted = await this.postToGeneralLedger(journal);
      log.info('postToGeneralLedger: success', { transaction_id: posted.transaction?.id });

      const elapsed = Date.now() - startTs;
      return {
        status: 'success',
        message: 'Transaction processed successfully',
        data: {
          transaction: posted.transaction,
          entries: posted.entries,
          elapsed_ms: elapsed,
        },
      };
    } catch (err) {
      log.error('processTransaction: unexpected error', { error: err?.message, stack: err?.stack });
      return {
        status: 'error',
        message: 'Unexpected processing error',
        errors: [{ code: 'ENGINE_ERROR', detail: err?.message || 'Unknown error' }],
      };
    }
  }

  /**
   * PUBLIC_INTERFACE
   * validateTransaction(transaction)
   * Validate the composite transaction (includes entries array).
   * @param {Object} transaction - { company_id, user_id, date, description, reference, entries: [{account_id, debit_amount, credit_amount, description}] }
   * @returns {Promise<{valid: boolean, errors: Array<{code:string, detail:string}>}>}
   */
  static async validateTransaction(transaction) {
    const errors = [];
    try {
      const { company_id, user_id, entries } = transaction || {};

      // 4) transaction has valid company_id
      if (!company_id) {
        errors.push({ code: 'INVALID_COMPANY', detail: 'company_id is required' });
      } else {
        const company = await fetchOne('SELECT id FROM companies WHERE id = $1', [company_id]);
        if (!company) {
          errors.push({ code: 'COMPANY_NOT_FOUND', detail: 'Company does not exist' });
        }
      }

      // 5) user permission for company
      if (!user_id) {
        errors.push({ code: 'INVALID_USER', detail: 'user_id is required' });
      } else if (company_id) {
        const access = await fetchOne(
          'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2 AND is_active = TRUE',
          [user_id, company_id]
        );
        if (!access) {
          errors.push({ code: 'ACCESS_DENIED', detail: 'User does not have permission for the specified company' });
        }
      }

      // Entries must exist
      if (!Array.isArray(entries) || entries.length < 2) {
        errors.push({ code: 'INVALID_ENTRIES', detail: 'At least two entries are required' });
      } else {
        // 1) debits equal credits, 2) accounts exist, 3) amounts are positive
        let totalDebits = 0;
        let totalCredits = 0;

        // Fetch accounts existence in batch for same company
        const accountIds = entries.map(e => e.account_id).filter(Boolean);
        const placeholders = accountIds.map((_, i) => `$${i + 2}`).join(', ');
        let accountsIndex = {};
        if (accountIds.length > 0) {
          const rows = await fetchMany(
            `SELECT id, company_id, code, name, type, is_active FROM accounts WHERE company_id = $1 AND id IN (${placeholders})`,
            [company_id, ...accountIds]
          );
          accountsIndex = rows.reduce((acc, r) => {
            acc[r.id] = r;
            return acc;
          }, {});
        }

        for (const [idx, entry] of entries.entries()) {
          const d = Number(entry.debit_amount || 0);
          const c = Number(entry.credit_amount || 0);

          if (d < 0 || c < 0) {
            errors.push({ code: 'NEGATIVE_AMOUNT', detail: `Entry ${idx + 1}: amounts must be non-negative` });
          }
          if (d === 0 && c === 0) {
            errors.push({ code: 'ZERO_ENTRY', detail: `Entry ${idx + 1}: either debit or credit must be > 0` });
          }
          if (d > 0 && c > 0) {
            errors.push({ code: 'BOTH_SIDES_SET', detail: `Entry ${idx + 1}: cannot set both debit and credit` });
          }

          totalDebits += d;
          totalCredits += c;

          const acct = accountsIndex[entry.account_id];
          if (!acct) {
            errors.push({ code: 'ACCOUNT_NOT_FOUND', detail: `Entry ${idx + 1}: account does not exist in company or is inactive` });
          } else if (acct.is_active === false) {
            errors.push({ code: 'ACCOUNT_INACTIVE', detail: `Entry ${idx + 1}: account is inactive` });
          }
        }

        if (Number(totalDebits.toFixed(2)) !== Number(totalCredits.toFixed(2))) {
          errors.push({
            code: 'UNBALANCED',
            detail: `Debits (${totalDebits.toFixed(2)}) do not equal Credits (${totalCredits.toFixed(2)})`,
          });
        }
      }
    } catch (e) {
      log.error('validateTransaction: error', { error: e.message, stack: e.stack });
      errors.push({ code: 'VALIDATION_EXCEPTION', detail: e.message });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * PUBLIC_INTERFACE
   * determineAccountMapping(transaction)
   * Resolves logical debit/credit mapping for supported transaction types.
   * Supported types:
   *  - SALE: Dr Accounts Receivable, Cr Revenue
   *  - CASH_SALE: Dr Cash/Bank, Cr Revenue
   *  - PURCHASE: Dr Expense/Inventory, Cr Accounts Payable
   *  - CASH_PURCHASE: Dr Expense/Inventory, Cr Cash/Bank
   *  - PAYMENT_RECEIVED: Dr Cash/Bank, Cr Accounts Receivable
   *  - PAYMENT_MADE: Dr Accounts Payable, Cr Cash/Bank
   *
   * The function uses optional hints on transaction to pick specific account codes/ids.
   * @param {Object} transaction
   * @returns {Promise<{type: string, legs: Array<{side: 'DR'|'CR', role: string, source: 'hint'|'config', required: boolean}>}>}
   */
  static async determineAccountMapping(transaction) {
    const { type } = transaction || {};
    if (!type) {
      throw new Error('Transaction type is required');
    }

    // Define mapping legs; roles are later resolved to concrete accounts using hints or defaults in company COA.
    switch (type) {
      case 'SALE':
        return { type, legs: [{ side: 'DR', role: 'AR' }, { side: 'CR', role: 'REVENUE' }] };
      case 'CASH_SALE':
        return { type, legs: [{ side: 'DR', role: 'CASH' }, { side: 'CR', role: 'REVENUE' }] };
      case 'PURCHASE':
        return { type, legs: [{ side: 'DR', role: 'EXPENSE' }, { side: 'CR', role: 'AP' }] };
      case 'CASH_PURCHASE':
        return { type, legs: [{ side: 'DR', role: 'EXPENSE' }, { side: 'CR', role: 'CASH' }] };
      case 'PAYMENT_RECEIVED':
        return { type, legs: [{ side: 'DR', role: 'CASH' }, { side: 'CR', role: 'AR' }] };
      case 'PAYMENT_MADE':
        return { type, legs: [{ side: 'DR', role: 'AP' }, { side: 'CR', role: 'CASH' }] };
      default:
        throw new Error(`Unsupported transaction type: ${type}`);
    }
  }

  /**
   * Resolve a role to an actual account_id for a company.
   * Tries hints on transaction first (e.g., cash_account_code, ar_account_code), falls back to defaults by account type.
   * @param {Object} tx
   * @param {'CASH'|'REVENUE'|'EXPENSE'|'AR'|'AP'} role
   * @returns {Promise<{id: string, code: string, name: string, type: string}>}
   */
  static async resolveRoleToAccount(tx, role) {
    const { company_id } = tx;
    const mapHintToField = {
      CASH: ['cash_account_code', 'bank_account_code', 'cash_account_id'],
      REVENUE: ['revenue_account_code', 'revenue_account_id'],
      EXPENSE: ['expense_account_code', 'expense_account_id', 'inventory_account_code', 'inventory_account_id'],
      AR: ['ar_account_code', 'ar_account_id'],
      AP: ['ap_account_code', 'ap_account_id'],
    };

    // Helper: find by code or id
    const findAccountBy = async (fieldName, value) => {
      if (!value) return null;
      if (fieldName.endsWith('_id')) {
        return await fetchOne(
          'SELECT id, code, name, type FROM accounts WHERE company_id = $1 AND id = $2 AND is_active = TRUE',
          [company_id, value]
        );
      }
      // by code
      return await fetchOne(
        'SELECT id, code, name, type FROM accounts WHERE company_id = $1 AND code = $2 AND is_active = TRUE',
        [company_id, value]
      );
    };

    // Try hints
    for (const field of mapHintToField[role] || []) {
      const acct = await findAccountBy(field, tx[field]);
      if (acct) return acct;
    }

    // Fallback by type role
    switch (role) {
      case 'CASH': {
        // Prefer account with type ASSET and code like CASH or BANK
        const row = await fetchOne(
          'SELECT id, code, name, type FROM accounts WHERE company_id = $1 AND is_active = TRUE AND type = \'ASSET\' AND (LOWER(code) LIKE \'%cash%\' OR LOWER(code) LIKE \'%bank%\') ORDER BY code LIMIT 1',
          [company_id]
        );
        if (row) return row;
        break;
      }
      case 'REVENUE': {
        const row = await fetchOne(
          'SELECT id, code, name, type FROM accounts WHERE company_id = $1 AND is_active = TRUE AND type = \'REVENUE\' ORDER BY code LIMIT 1',
          [company_id]
        );
        if (row) return row;
        break;
      }
      case 'EXPENSE': {
        const row = await fetchOne(
          'SELECT id, code, name, type FROM accounts WHERE company_id = $1 AND is_active = TRUE AND type = \'EXPENSE\' ORDER BY code LIMIT 1',
          [company_id]
        );
        if (row) return row;
        break;
      }
      case 'AR': {
        // Accounts Receivable typically ASSET; look for code like AR/RECEIVABLES
        const row = await fetchOne(
          'SELECT id, code, name, type FROM accounts WHERE company_id = $1 AND is_active = TRUE AND type = \'ASSET\' AND (LOWER(code) LIKE \'%ar%\' OR LOWER(code) LIKE \'%receivable%\') ORDER BY code LIMIT 1',
          [company_id]
        );
        if (row) return row;
        break;
      }
      case 'AP': {
        // Accounts Payable typically LIABILITY
        const row = await fetchOne(
          'SELECT id, code, name, type FROM accounts WHERE company_id = $1 AND is_active = TRUE AND type = \'LIABILITY\' AND (LOWER(code) LIKE \'%ap%\' OR LOWER(code) LIKE \'%payable%\') ORDER BY code LIMIT 1',
          [company_id]
        );
        if (row) return row;
        break;
      }
      default:
        break;
    }

    throw new Error(`Unable to resolve account for role ${role}. Provide an explicit account hint for the company.`);
  }

  /**
   * PUBLIC_INTERFACE
   * createJournalEntry(transaction, mapping)
   * Construct a concrete transaction with journal lines based on mapping and amount.
   * @param {Object} transaction
   * @param {Object} mapping - result of determineAccountMapping
   * @returns {Promise<{company_id, user_id, type, date, description, reference, total_amount, entries: [], summary:{totalDebits,totalCredits}}>}
   */
  static async createJournalEntry(transaction, mapping) {
    const { company_id, user_id, date, description, reference, amount } = transaction || {};
    if (!company_id) throw new Error('company_id is required');
    if (!user_id) throw new Error('user_id is required');
    if (!date) throw new Error('date is required');
    if (!description) throw new Error('description is required');
    const amt = Number(amount);
    if (!(amt > 0)) throw new Error('amount must be a positive number');

    const entries = [];
    for (const leg of mapping.legs) {
      const acct = await this.resolveRoleToAccount(transaction, leg.role);
      const entry = {
        id: uuidv4(),
        account_id: acct.id,
        account_code: acct.code,
        account_name: acct.name,
        description: `${mapping.type} - ${leg.role}`,
        debit_amount: leg.side === 'DR' ? amt : 0,
        credit_amount: leg.side === 'CR' ? amt : 0,
      };
      entries.push(entry);
    }

    const totalDebits = entries.reduce((s, e) => s + Number(e.debit_amount || 0), 0);
    const totalCredits = entries.reduce((s, e) => s + Number(e.credit_amount || 0), 0);

    return {
      id: uuidv4(),
      company_id,
      user_id,
      type: mapping.type,
      date,
      description,
      reference: reference || null,
      total_amount: amt,
      entries,
      summary: {
        totalDebits: Number(totalDebits.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
      },
    };
  }

  /**
   * PUBLIC_INTERFACE
   * postToGeneralLedger(journalEntry)
   * Persist transaction and lines; update balances atomically.
   * @param {Object} journalEntry
   * @returns {Promise<{transaction: any, entries: any[]}>}
   */
  static async postToGeneralLedger(journalEntry) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Insert transaction
      const txId = uuidv4();
      const insertTxQ = `
        INSERT INTO transactions (id, company_id, date, description, reference, total_amount, type, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, company_id, date, description, reference, total_amount, type, created_at
      `;
      const txRes = await client.query(insertTxQ, [
        txId,
        journalEntry.company_id,
        journalEntry.date,
        journalEntry.description,
        journalEntry.reference,
        journalEntry.total_amount,
        journalEntry.type || null,
        journalEntry.user_id,
      ]);
      const persistedTx = txRes.rows[0];

      // Insert journal entries
      const entriesOut = [];
      for (const line of journalEntry.entries) {
        const jeId = line.id || uuidv4();
        const insertJeQ = `
          INSERT INTO journal_entries (id, transaction_id, account_id, debit_amount, credit_amount, description)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, transaction_id, account_id, debit_amount, credit_amount, description
        `;
        const jeRes = await client.query(insertJeQ, [
          jeId,
          persistedTx.id,
          line.account_id,
          Number(line.debit_amount || 0),
          Number(line.credit_amount || 0),
          line.description || persistedTx.description,
        ]);
        const row = jeRes.rows[0];
        // Update account balance (Assets/Expenses: debit increases; Liabilities/Equity/Revenue: credit increases)
        const acct = await fetchOne('SELECT id, type, balance FROM accounts WHERE id = $1 FOR UPDATE', [line.account_id], client);
        if (!acct) {
          throw new Error(`Account ${line.account_id} not found during posting`);
        }

        const debit = Number(line.debit_amount || 0);
        const credit = Number(line.credit_amount || 0);

        // For balance direction:
        // - ASSET, EXPENSE: balance = balance + debit - credit
        // - LIABILITY, EQUITY, REVENUE: balance = balance - debit + credit
        let newBalance = Number(acct.balance || 0);
        if (acct.type === 'ASSET' || acct.type === 'EXPENSE') {
          newBalance = newBalance + debit - credit;
        } else {
          newBalance = newBalance - debit + credit;
        }

        await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, acct.id]);
        entriesOut.push({
          ...row,
          account_code: line.account_code,
          account_name: line.account_name,
          new_balance: newBalance,
        });
      }

      // Optional: audit log
      try {
        await client.query(
          `INSERT INTO audit_log (id, company_id, entity_type, entity_id, action, performed_by, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            persistedTx.company_id,
            'TRANSACTION',
            persistedTx.id,
            'CREATE',
            journalEntry.user_id,
            JSON.stringify({ description: persistedTx.description, reference: persistedTx.reference, type: persistedTx.type }),
          ]
        );
      } catch (e) {
        // If audit table not present, do not fail posting
        log.warn('audit_log insert failed (non-critical)', { error: e.message });
      }

      await client.query('COMMIT');
      return { transaction: persistedTx, entries: entriesOut };
    } catch (e) {
      await client.query('ROLLBACK');
      log.error('postToGeneralLedger: failed, rolled back', { error: e.message, stack: e.stack });
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = DoubleEntryEngine;
