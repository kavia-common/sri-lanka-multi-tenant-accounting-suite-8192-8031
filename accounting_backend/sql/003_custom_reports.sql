-- Custom Reports schema providing storage for reusable report templates with fields, filters, periods, and layout.
-- This file introduces three tables:
--  - custom_report_templates: template metadata and current revision linkage
--  - custom_report_template_revisions: versioned JSON structure for template spec
--  - custom_report_template_fields: optional normalized field definitions for search/indexing

-- Note: This project uses UUID primary keys elsewhere; following same convention.
-- Use JSON for flexible template specification to accommodate evolving builder features.

CREATE TABLE IF NOT EXISTS custom_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- e.g., 'FINANCIAL', 'MANAGEMENT'
  is_favorite BOOLEAN DEFAULT FALSE,
  current_revision_id UUID,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_report_templates_company ON custom_report_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_company_name ON custom_report_templates(company_id, name);

CREATE TABLE IF NOT EXISTS custom_report_template_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES custom_report_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, -- monotonically increasing
  spec JSONB NOT NULL,      -- canonical template spec (fields, columns, periods, filters, layout)
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_template_version ON custom_report_template_revisions(template_id, version);

-- Optional denormalized fields to allow searching and simple lists without parsing JSON
CREATE TABLE IF NOT EXISTS custom_report_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES custom_report_templates(id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,   -- e.g., 'account.code', 'account.name', 'amount', 'period'
  field_label VARCHAR(150),          -- Display
  data_type VARCHAR(30),             -- string|number|date|boolean
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backfill trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_report_templates_updated_at ON custom_report_templates;
CREATE TRIGGER trg_custom_report_templates_updated_at
BEFORE UPDATE ON custom_report_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
