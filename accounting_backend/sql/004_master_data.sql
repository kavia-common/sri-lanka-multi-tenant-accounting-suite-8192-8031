-- Master data tables for multi-tenancy. All are scoped by company_id.

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  code VARCHAR(32),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_number VARCHAR(64),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_customers_company (company_id),
  UNIQUE KEY uq_customers_company_code (company_id, code)
);

CREATE TABLE IF NOT EXISTS vendors (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  code VARCHAR(32),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_number VARCHAR(64),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_vendors_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_vendors_company (company_id),
  UNIQUE KEY uq_vendors_company_code (company_id, code)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(64) NOT NULL,
  currency_code VARCHAR(10),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_bank_accounts_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_bank_accounts_company (company_id),
  UNIQUE KEY uq_bank_accounts_company_number (company_id, account_number)
);

CREATE TABLE IF NOT EXISTS tax_rates (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  code VARCHAR(32),
  name VARCHAR(255) NOT NULL,
  rate DECIMAL(6,3) NOT NULL, -- percentage
  type VARCHAR(32) NOT NULL, -- VAT, NBT, WHT, etc.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_tax_rates_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_tax_rates_company (company_id),
  UNIQUE KEY uq_tax_rates_company_code (company_id, code)
);

CREATE TABLE IF NOT EXISTS currencies (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  code VARCHAR(10) NOT NULL, -- LKR, USD
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(10),
  decimal_places TINYINT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_currencies_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_currencies_company (company_id),
  UNIQUE KEY uq_currencies_company_code (company_id, code)
);
