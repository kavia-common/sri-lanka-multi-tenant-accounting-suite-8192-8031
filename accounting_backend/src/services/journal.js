'use strict';

const db = require('../repositories/postgres');
const { notFound, conflict } = require('../utils/errors');

class JournalService {
  /**
   * PUBLIC_INTERFACE
   * Create a journal entry with lines; validates double-entry and posts to ledger.
   */
  async create(tenantId, actorUserId, companyId, { date, reference, memo, lines }) {
    /** This is a public function. */
    if (!Array.isArray(lines) || lines.length < 2) {
      throw conflict('Journal entry must have at least two lines');
    }
    // Validate accounts exist and compute totals
    let totalDebit = 0;
    let totalCredit = 0;
    const normalized = [];
    for (const l of lines) {
      const acc = await db.getById('chart_of_accounts', l.accountId, { tenantId });
      if (!acc || Number(acc.company_id) !== Number(companyId)) throw notFound('Account not found for company');
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw conflict('Each line must have either debit or credit, not both or none');
      }
      totalDebit += debit;
      totalCredit += credit;
      normalized.push({
        accountId: Number(l.accountId),
        debit,
        credit,
        description: l.description || '',
      });
    }
    // Double-entry rule
    if (Number(totalDebit.toFixed(2)) !== Number(totalCredit.toFixed(2))) {
      throw conflict('Debits and credits must be equal');
    }

    const je = await db.insert('journal_entries', {
      company_id: companyId,
      date: date || new Date().toISOString().slice(0, 10),
      reference: reference || null,
      memo: memo || null,
      lines: normalized,
      status: 'posted',
    }, { tenantId, actorUserId });

    // Post to ledger: create/update per-account running balances (materialized)
    for (const line of normalized) {
      await db.upsertLedgerBalance({
        tenantId,
        companyId,
        accountId: line.accountId,
        entry: {
          journalId: je.id,
          date: je.date,
          reference: je.reference,
          memo: line.description,
          debit: line.debit,
          credit: line.credit,
        },
      });
    }

    return je;
  }

  /**
   * PUBLIC_INTERFACE
   * List journal entries for a company
   */
  async list(tenantId, companyId, { from, to } = {}) {
    /** This is a public function. */
    const filter = { company_id: companyId };
    let rows = await db.list('journal_entries', filter, { tenantId });
    if (from) rows = rows.filter((j) => String(j.date) >= String(from));
    if (to) rows = rows.filter((j) => String(j.date) <= String(to));
    return rows;
  }

  /**
   * PUBLIC_INTERFACE
   * Get a journal entry
   */
  async get(tenantId, id) {
    /** This is a public function. */
    const je = await db.getById('journal_entries', id, { tenantId });
    if (!je) throw notFound('Journal entry not found');
    return je;
  }
}

module.exports = new JournalService();
