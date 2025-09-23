process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_ISSUER = 'sl-accounting-suite';
process.env.JWT_AUDIENCE = 'sl-accounting-frontend';
process.env.LK_VAT_STANDARD_RATE = '0.15';

// Mock the postgres repository with an in-memory adapter that mirrors methods used by services.
// This prevents the need for actual PG connection and required PG_* env vars.
const memory = (() => {
  // Very simple in-memory structures, keyed by tenant
  const tenants = new Map();

  function ensureTenant(tenantId) {
    if (!tenants.has(tenantId)) {
      tenants.set(tenantId, {
        users: new Map(),
        companies: new Map(),
        chart_of_accounts: new Map(),
        journal_entries: new Map(),
        customers: new Map(),
        vendors: new Map(),
        bank_accounts: new Map(),
        tax_rates: new Map(),
        currencies: new Map(),
        ledger_balances: new Map(), // keyed by id composite
        _seq: { users: 0, companies: 0, chart_of_accounts: 0, journal_entries: 0, customers: 0, vendors: 0, bank_accounts: 0, tax_rates: 0, currencies: 0 },
      });
    }
    return tenants.get(tenantId);
  }

  function nextId(t, table) {
    const current = t._seq[table] || 0;
    const next = current + 1;
    t._seq[table] = next;
    return String(next);
  }

  function tableMap(t, table) {
    if (!t[table]) throw new Error(`Unknown table: ${table}`);
    return t[table];
  }

  async function insert(table, data, { tenantId, actorUserId }) {
    const t = ensureTenant(tenantId);
    const store = tableMap(t, table);
    const id = nextId(t, table);
    const row = {
      id: Number.isNaN(Number(id)) ? id : Number(id),
      ...data,
      tenant_id: data.tenant_id ?? tenantId,
      created_by: actorUserId ?? null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    store.set(String(row.id), row);
    return row;
  }

  async function update(table, id, patch, { tenantId, actorUserId }) {
    const t = ensureTenant(tenantId);
    const store = tableMap(t, table);
    const key = String(id);
    const existed = store.get(key);
    if (!existed) return null;
    const updated = {
      ...existed,
      ...patch,
      id: existed.id,
      tenant_id: tenantId,
      updated_by: actorUserId ?? existed.updated_by ?? null,
      updated_at: new Date().toISOString(),
    };
    store.set(key, updated);
    return updated;
  }

  async function remove(table, id, { tenantId }) {
    const t = ensureTenant(tenantId);
    const store = tableMap(t, table);
    const key = String(id);
    if (!store.has(key)) return false;
    store.delete(key);
    return true;
  }

  async function getById(table, id, { tenantId }) {
    const t = ensureTenant(tenantId);
    const store = tableMap(t, table);
    return store.get(String(id)) || null;
  }

  function matchFilter(row, filter) {
    return Object.entries(filter).every(([k, v]) => {
      return row[k] === v;
    });
  }

  async function list(table, filter = {}, { tenantId } = {}) {
    const t = ensureTenant(tenantId);
    const store = tableMap(t, table);
    return Array.from(store.values()).filter((r) => matchFilter(r, filter)).sort((a, b) => Number(a.id) - Number(b.id));
  }

  async function upsert(table, where, data, { tenantId, actorUserId }) {
    const items = await list(table, where, { tenantId });
    if (items.length > 0) {
      return update(table, items[0].id, data, { tenantId, actorUserId });
    }
    return insert(table, data, { tenantId, actorUserId });
  }

  async function upsertLedgerBalance({ tenantId, companyId, accountId, entry }) {
    const t = ensureTenant(tenantId);
    const store = tableMap(t, 'ledger_balances');
    const composite = `${companyId}:${accountId}`;
    const existing = store.get(composite);
    let balance = 0;
    let entries = [];
    if (existing) {
      balance = Number(existing.balance || 0);
      entries = existing.entries || [];
    }
    const nextBal = Number((balance + Number(entry.debit || 0) - Number(entry.credit || 0)).toFixed(2));
    const nextEntries = [...entries, { ...entry, balance: nextBal }];
    const row = {
      id: composite,
      tenant_id: tenantId,
      company_id: companyId,
      account_id: accountId,
      balance: nextBal,
      entries: nextEntries,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.set(composite, row);
    return { balance: nextBal, entries: nextEntries };
  }

  return { insert, update, remove, getById, list, upsert, upsertLedgerBalance };
})();

// Provide a minimal pool stub for health service which does pool.query('SELECT 1')
const pool = {
  async query(sql) {
    if (typeof sql === 'string' && sql.toUpperCase().includes('SELECT 1')) {
      return { rows: [{ '?column?': 1 }] };
    }
    // Not used in tests due to repository mocking
    return { rows: [] };
  },
};

// Mock the entire postgres.js module
jest.mock('./src/repositories/postgres', () => ({
  __esModule: true,
  ...memory,
  pool,
}));

// Avoid running real DB schema init during app import by mocking bootstrap.initSchema to a no-op
jest.mock('./src/repositories/bootstrap', () => ({
  __esModule: true,
  initSchema: async () => {},
}));
