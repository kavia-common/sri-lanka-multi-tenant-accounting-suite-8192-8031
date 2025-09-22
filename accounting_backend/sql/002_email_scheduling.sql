-- Email scheduling and delivery logs

CREATE TYPE report_format_enum AS ENUM ('PDF','XLSX');
CREATE TYPE report_type_enum AS ENUM (
  'TRIAL_BALANCE',
  'BALANCE_SHEET',
  'PROFIT_LOSS',
  'GENERAL_LEDGER',
  'CASH_FLOW',
  'CHANGES_IN_EQUITY',
  'AGED_RECEIVABLES',
  'AGED_PAYABLES',
  'BUDGET_VS_ACTUAL'
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  report_type report_type_enum NOT NULL,
  format report_format_enum NOT NULL DEFAULT 'PDF',
  recipients TEXT[] NOT NULL, -- array of emails
  notes TEXT,
  options JSONB, -- report params (date ranges, filters)
  schedule_type TEXT NOT NULL, -- daily|weekly|monthly|custom
  cron_expression TEXT, -- for custom, also used internally
  timezone TEXT NOT NULL DEFAULT 'UTC',
  next_run_at TIMESTAMPTZ, -- computed next run
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_company ON report_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS report_delivery_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_type report_type_enum NOT NULL,
  format report_format_enum NOT NULL,
  recipients TEXT[] NOT NULL,
  status TEXT NOT NULL, -- SENT|FAILED
  error_message TEXT,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL, -- null if automatic
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_delivery_logs_company ON report_delivery_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_report_delivery_logs_schedule ON report_delivery_logs(schedule_id);

-- trigger to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_schedules_updated_at ON report_schedules;
CREATE TRIGGER trg_report_schedules_updated_at
BEFORE UPDATE ON report_schedules
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
