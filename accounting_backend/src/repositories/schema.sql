-- Minimal schema for multi-tenant accounting (PostgreSQL)
-- Note: For production, convert to a proper migration system (e.g., Knex, Prisma, Sequelize)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_uidx ON users(tenant_id, email);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_number TEXT,
  currency TEXT DEFAULT 'LKR',
  country TEXT DEFAULT 'LK',
  address JSONB,
  fiscal_year_start TEXT DEFAULT '04-01',
  settings JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS companies_tenant_idx ON companies(tenant_id);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  tax_rate_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS coa_tenant_company_code_uidx ON chart_of_accounts(tenant_id, company_id, code);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  lines JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS journal_tenant_company_idx ON journal_entries(tenant_id, company_id, date);

-- Masters
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB,
  tax_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS customers_tenant_company_idx ON customers(tenant_id, company_id);

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB,
  tax_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS vendors_tenant_company_idx ON vendors(tenant_id, company_id);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  bank TEXT,
  branch TEXT,
  currency TEXT DEFAULT 'LKR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS bank_accounts_tenant_company_idx ON bank_accounts(tenant_id, company_id);

CREATE TABLE IF NOT EXISTS tax_rates (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  rate NUMERIC(10,4) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS tax_rates_tenant_company_name_uidx ON tax_rates(tenant_id, company_id, name);

CREATE TABLE IF NOT EXISTS currencies (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT,
  symbol TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS currencies_tenant_company_code_uidx ON currencies(tenant_id, company_id, code);

-- Ledger balances (materialized balance + entries journal)
CREATE TABLE IF NOT EXISTS ledger_balances (
  id TEXT PRIMARY KEY, -- composite companyId:accountId
  tenant_id TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ledger_balances_tenant_company_idx ON ledger_balances(tenant_id, company_id);
