'use strict';

const repo = require('../repositories/memory');
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
      const acc = repo.getById(tenantId, 'chartOfAccounts', l.accountId);
      if (!acc || acc.companyId !== companyId) throw notFound('Account not found for company');
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw conflict('Each line must have either debit or credit, not both or none');
      }
      totalDebit += debit;
      totalCredit += credit;
      normalized.push({
        accountId: l.accountId,
        debit,
        credit,
        description: l.description || '',
      });
    }
    // Double-entry rule
    if (Number(totalDebit.toFixed(2)) !== Number(totalCredit.toFixed(2))) {
      throw conflict('Debits and credits must be equal');
    }

    const je = repo.create(tenantId, 'journalEntries', {
      companyId,
      date: date || new Date().toISOString().slice(0, 10),
      reference: reference || null,
      memo: memo || null,
      lines: normalized,
      status: 'posted',
      _actorUserId: actorUserId,
    });

    // Post to ledger: create or update per-account running balances
    for (const line of normalized) {
      const key = `${companyId}:${line.accountId}`;
      const current = repo.getById(tenantId, 'ledger', key) || { id: key, companyId, accountId: line.accountId, balance: 0, entries: [] };
      const nextBal = Number((current.balance + line.debit - line.credit).toFixed(2));
      current.balance = nextBal;
      current.entries.push({
        journalId: je.id,
        date: je.date,
        reference: je.reference,
        memo: line.description,
        debit: line.debit,
        credit: line.credit,
        balance: nextBal,
      });
      // store ledger keyed by composite id
      // since our generic repo expects numeric ids, we simulate by upsert on id
      repo.upsert(tenantId, 'ledger', { id: key }, { ...current, _actorUserId: actorUserId });
    }

    return je;
  }

  /**
   * PUBLIC_INTERFACE
   * List journal entries for a company
   */
  async list(tenantId, companyId, { from, to } = {}) {
    /** This is a public function. */
    let arr = repo.list(tenantId, 'journalEntries', { companyId });
    if (from) arr = arr.filter((j) => j.date >= from);
    if (to) arr = arr.filter((j) => j.date <= to);
    return arr;
  }

  /**
   * PUBLIC_INTERFACE
   * Get a journal entry
   */
  async get(tenantId, id) {
    /** This is a public function. */
    const je = repo.getById(tenantId, 'journalEntries', id);
    if (!je) throw notFound('Journal entry not found');
    return je;
  }
}

module.exports = new JournalService();
