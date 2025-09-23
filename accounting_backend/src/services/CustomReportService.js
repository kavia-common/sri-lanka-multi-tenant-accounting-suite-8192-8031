'use strict';

/**
 * CustomReportService
 * Encapsulates CRUD of custom report templates and execution of templates to produce data and exports.
 * Integrates with existing ReportingService, PdfService, and ExcelService to render outputs.
 */
const db = require('../config/database');
const ReportingService = require('./ReportingService');
const PdfService = require('./PdfService');
const { renderCustomReportToBuffer } = require('./PdfCustomRender');
const ExcelService = require('./ExcelService');

/**
 * Helper to parse safe integers for revisioning.
 */
function toInt(val, def = 1) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : def;
}

class CustomReportService {
  /**
   * PUBLIC_INTERFACE
   * Create a new custom report template and its first revision.
   * @param {string} companyId Company context (tenant)
   * @param {object} payload { name, description, category, spec, fields[] }
   * @param {string} userId creator id
   * @returns {Promise<object>} created template with current revision
   */
  static async createTemplate(companyId, payload, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { name, description, category, spec, fields = [] } = payload;
      if (!name || !spec) {
        throw new Error('name and spec are required');
      }

      const insertTemplateRes = await client.query(
        `
        INSERT INTO custom_report_templates (company_id, name, description, category, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id, name, description, category, is_favorite, current_revision_id, created_at, updated_at
        `,
        [companyId, name, description || null, category || null, userId || null]
      );
      const template = insertTemplateRes.rows[0];

      const insertRevisionRes = await client.query(
        `
        INSERT INTO custom_report_template_revisions (template_id, version, spec, notes, created_by)
        VALUES ($1, $2, $3::jsonb, $4, $5)
        RETURNING id, version, spec, notes, created_at
        `,
        [template.id, 1, JSON.stringify(spec), null, userId || null]
      );
      const revision = insertRevisionRes.rows[0];

      await client.query(
        'UPDATE custom_report_templates SET current_revision_id = $1 WHERE id = $2',
        [revision.id, template.id]
      );

      // Insert optional field definitions
      for (const f of fields) {
        await client.query(
          `
          INSERT INTO custom_report_template_fields (template_id, field_key, field_label, data_type)
          VALUES ($1, $2, $3, $4)
          `,
          [template.id, f.field_key, f.field_label || null, f.data_type || null]
        );
      }

      await client.query('COMMIT');

      return {
        ...template,
        current_revision: revision,
        fields,
      };
    } catch (err) {
      await db.safeRollback(client);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * PUBLIC_INTERFACE
   * List templates for a company with optional search.
   * @param {string} companyId
   * @param {object} opts { q, limit, offset, favorites }
   * @returns {Promise<object[]>}
   */
  static async listTemplates(companyId, opts = {}) {
    const { q, limit = 50, offset = 0, favorites = false } = opts;
    const params = [companyId];
    let where = 'company_id = $1';
    if (favorites) {
      params.push(true);
      where += ` AND is_favorite = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (LOWER(name) LIKE LOWER($${params.length}) OR LOWER(description) LIKE LOWER($${params.length}))`;
    }
    params.push(limit);
    params.push(offset);
    const res = await db.query(
      `
      SELECT id, name, description, category, is_favorite, created_at, updated_at
      FROM custom_report_templates
      WHERE ${where}
      ORDER BY updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );
    return res.rows;
  }

  /**
   * PUBLIC_INTERFACE
   * Get a single template including current revision and fields.
   * @param {string} companyId
   * @param {string} templateId
   */
  static async getTemplate(companyId, templateId) {
    const res = await db.query(
      `
      SELECT t.id, t.name, t.description, t.category, t.is_favorite, t.current_revision_id, t.created_at, t.updated_at
      FROM custom_report_templates t
      WHERE t.company_id = $1 AND t.id = $2
      `,
      [companyId, templateId]
    );
    if (res.rowCount === 0) return null;

    const template = res.rows[0];

    const revRes = await db.query(
      `
      SELECT id, version, spec, notes, created_at
      FROM custom_report_template_revisions
      WHERE template_id = $1
      ORDER BY version DESC
      LIMIT 1
      `,
      [template.id]
    );
    const fieldsRes = await db.query(
      `
      SELECT id, field_key, field_label, data_type, created_at
      FROM custom_report_template_fields
      WHERE template_id = $1
      ORDER BY created_at ASC
      `,
      [template.id]
    );

    return {
      ...template,
      current_revision: revRes.rows[0] || null,
      fields: fieldsRes.rows,
    };
  }

  /**
   * PUBLIC_INTERFACE
   * Update template metadata and optionally create a new revision for spec changes.
   * If payload.spec is provided, a new revision is created with version+1.
   * @param {string} companyId
   * @param {string} templateId
   * @param {object} payload { name, description, category, is_favorite, spec, notes, fields }
   * @param {string} userId
   */
  static async updateTemplate(companyId, templateId, payload, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Ensure template belongs to company
      const checkRes = await client.query(
        'SELECT id, name FROM custom_report_templates WHERE id = $1 AND company_id = $2',
        [templateId, companyId]
      );
      if (checkRes.rowCount === 0) {
        throw new Error('Template not found');
      }

      const { name, description, category, is_favorite, spec, notes, fields } = payload;

      // Update metadata
      const sets = [];
      const params = [];
      let idx = 1;
      if (name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(name);
      }
      if (description !== undefined) {
        sets.push(`description = $${idx++}`);
        params.push(description);
      }
      if (category !== undefined) {
        sets.push(`category = $${idx++}`);
        params.push(category);
      }
      if (is_favorite !== undefined) {
        sets.push(`is_favorite = $${idx++}`);
        params.push(!!is_favorite);
      }
      if (userId) {
        sets.push(`updated_by = $${idx++}`);
        params.push(userId);
      }
      if (sets.length > 0) {
        params.push(templateId);
        await client.query(
          `UPDATE custom_report_templates SET ${sets.join(', ')} WHERE id = $${idx}`,
          params
        );
      }

      // Manage fields if provided: replace all
      if (Array.isArray(fields)) {
        await client.query(
          'DELETE FROM custom_report_template_fields WHERE template_id = $1',
          [templateId]
        );
        for (const f of fields) {
          await client.query(
            'INSERT INTO custom_report_template_fields (template_id, field_key, field_label, data_type) VALUES ($1, $2, $3, $4)',
            [templateId, f.field_key, f.field_label || null, f.data_type || null]
          );
        }
      }

      // New revision if spec is provided
      if (spec !== undefined && spec !== null) {
        const lastVerRes = await client.query(
          'SELECT COALESCE(MAX(version), 0) AS v FROM custom_report_template_revisions WHERE template_id = $1',
          [templateId]
        );
        const nextVersion = toInt(lastVerRes.rows[0].v, 0) + 1;
        const revRes = await client.query(
          `
          INSERT INTO custom_report_template_revisions (template_id, version, spec, notes, created_by)
          VALUES ($1, $2, $3::jsonb, $4, $5)
          RETURNING id
          `,
          [templateId, nextVersion, JSON.stringify(spec), notes || null, userId || null]
        );
        await client.query(
          'UPDATE custom_report_templates SET current_revision_id = $1 WHERE id = $2',
          [revRes.rows[0].id, templateId]
        );
      }

      await client.query('COMMIT');
      return await CustomReportService.getTemplate(companyId, templateId);
    } catch (e) {
      await db.safeRollback(client);
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Delete a template (cascades to revisions, fields).
   * @param {string} companyId
   * @param {string} templateId
   */
  static async deleteTemplate(companyId, templateId) {
    const res = await db.query(
      'DELETE FROM custom_report_templates WHERE id = $1 AND company_id = $2',
      [templateId, companyId]
    );
    return res.rowCount > 0;
  }

  /**
   * PUBLIC_INTERFACE
   * Execute a template to generate results. Uses ReportingService as the computation engine.
   * Supports output formats: json (default), xlsx, pdf
   * @param {string} companyId
   * @param {string} templateId
   * @param {object} params runtime params (e.g., date ranges, filters override)
   * @param {("json"|"xlsx"|"pdf")} format
   * @returns Promise<{type: 'json', data} | {type:'buffer', contentType, filename, buffer}>
   */
  static async executeTemplate(companyId, templateId, params = {}, format = 'json') {
    const template = await this.getTemplate(companyId, templateId);
    if (!template || !template.current_revision) {
      throw new Error('Template or revision not found');
    }

    const spec = template.current_revision.spec;

    // Map custom template spec to ReportingService inputs
    // Expecting spec to include:
    //  - base_report: 'trial_balance' | 'balance_sheet' | 'profit_loss' | 'general_ledger' | 'cash_flow' | ...
    //  - periods: [ "YYYY-MM-DD..YYYY-MM-DD" | "YYYY-MM-DD" ]
    //  - columns: [ { key, label, source } ]
    //  - filters: { account_type?, account_code?, min_amount?, max_amount?, ... }
    //  - layout: grouping / sorting info
    const baseReport = (spec.base_report || '').toLowerCase();

    let result;
    // Delegate to existing ReportingService which already supports core reports
    switch (baseReport) {
      case 'trial_balance':
        result = await ReportingService.getTrialBalance(companyId, {
          period: spec.periods || params.period || [],
          compare_to: spec.compare_to || params.compare_to || [],
          budget_source: spec.budget_source || params.budget_source,
          fiscal_year: spec.fiscal_year || params.fiscal_year,
        });
        break;
      case 'balance_sheet':
        result = await ReportingService.getBalanceSheet(companyId, {
          period: spec.periods || params.period || [],
          compare_to: spec.compare_to || params.compare_to || [],
          budget_source: spec.budget_source || params.budget_source,
          fiscal_year: spec.fiscal_year || params.fiscal_year,
        });
        break;
      case 'profit_loss':
      case 'profit-and-loss':
      case 'income_statement':
        result = await ReportingService.getProfitAndLoss(companyId, {
          period: spec.periods || params.period || [],
          compare_to: spec.compare_to || params.compare_to || [],
          budget_source: spec.budget_source || params.budget_source,
          fiscal_year: spec.fiscal_year || params.fiscal_year,
        });
        break;
      case 'general_ledger':
        result = await ReportingService.getGeneralLedger(companyId, {
          period: spec.periods || params.period || [],
          account_id: params.account_id || null,
          account_code: params.account_code || null,
          compare_to: spec.compare_to || params.compare_to || [],
          page: params.page || 1,
          limit: params.limit || 100,
        });
        break;
      case 'cash_flow':
        result = await ReportingService.getCashFlow(companyId, {
          period: spec.periods || params.period || [],
          compare_to: spec.compare_to || params.compare_to || [],
        });
        break;
      default:
        // Fallback: return empty structure with info
        result = { data: [], summary: {}, message: 'Unsupported base_report in spec' };
        break;
    }

    // Apply custom transformations based on columns/filters/layout if needed in future.
    // For now, we pass through results. Hooks could be added here to shape result per spec.

    if (format === 'xlsx') {
      const workbookBuffer = await ExcelService.renderCustomReport(template.name, result, {
        columns: spec.columns,
        periods: spec.periods,
        layout: spec.layout,
      });
      return {
        type: 'buffer',
        contentType: 'application/vnd.openxmlformats-officedocument.officedocument.spreadsheetml.sheet',
        filename: `${template.name}.xlsx`,
        buffer: workbookBuffer,
      };
    }

    if (format === 'pdf') {
      const pdfBuffer = await renderCustomReportToBuffer(template.name, result, {
        columns: spec.columns,
        periods: spec.periods,
        layout: spec.layout,
      });
      return {
        type: 'buffer',
        contentType: 'application/pdf',
        filename: `${template.name}.pdf`,
        buffer: pdfBuffer,
      };
    }

    // Default: json
    return {
      type: 'json',
      data: {
        template: {
          id: template.id,
          name: template.name,
          category: template.category,
          version: template.current_revision.version,
        },
        result,
      },
    };
  }
}

module.exports = CustomReportService;
