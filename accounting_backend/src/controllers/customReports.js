'use strict';

/**
 * Custom Reports Controller
 * CRUD + execution endpoints for custom financial report templates.
 */
const CustomReportService = require('../services/CustomReportService');

/**
 * Extract companyId from header (x-company-id) enforced by middleware in routes.
 */
function getCompanyId(req) {
  return req.headers['x-company-id'];
}

// PUBLIC_INTERFACE
async function createTemplate(req, res, next) {
  /**
   * Create a new custom report template.
   * Body: { name, description, category, spec: {...}, fields: [{field_key, field_label, data_type}] }
   * Returns: 201 with created template and current revision.
   */
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id || null;
    const created = await CustomReportService.createTemplate(companyId, req.body, userId);
    return res.status(201).json({ status: 'success', data: { template: created } });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function listTemplates(req, res, next) {
  /**
   * List templates for the company.
   * Query: q, limit, offset, favorites
   */
  try {
    const companyId = getCompanyId(req);
    const { q, limit, offset, favorites } = req.query;
    const items = await CustomReportService.listTemplates(companyId, {
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      favorites: favorites === 'true',
    });
    return res.json({ status: 'success', data: { templates: items } });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function getTemplate(req, res, next) {
  /**
   * Get a template by id including current revision and fields.
   * Params: id
   */
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const tpl = await CustomReportService.getTemplate(companyId, id);
    if (!tpl) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    return res.json({ status: 'success', data: { template: tpl } });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function updateTemplate(req, res, next) {
  /**
   * Update a template and optionally create a new revision when spec is provided.
   * Params: id
   * Body: { name?, description?, category?, is_favorite?, spec?, notes?, fields? }
   */
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?.id || null;
    const { id } = req.params;
    const updated = await CustomReportService.updateTemplate(companyId, id, req.body, userId);
    return res.json({ status: 'success', data: { template: updated } });
  } catch (err) {
    if (err && /not found/i.test(err.message)) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    next(err);
  }
}

// PUBLIC_INTERFACE
async function deleteTemplate(req, res, next) {
  /**
   * Delete a template by id.
   * Params: id
   */
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const ok = await CustomReportService.deleteTemplate(companyId, id);
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    return res.json({ status: 'success', message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

// PUBLIC_INTERFACE
async function executeTemplate(req, res, next) {
  /**
   * Execute a template by id.
   * Params: id
   * Query: format=json|xlsx|pdf
   * Body: runtime params to override spec parts, ex: { period, compare_to, account_id, account_code, fiscal_year, budget_source }
   */
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const format = (req.query.format || 'json').toLowerCase();
    const execResult = await CustomReportService.executeTemplate(companyId, id, req.body || {}, format);

    if (execResult.type === 'buffer') {
      res.setHeader('Content-Type', execResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${execResult.filename}"`);
      return res.send(execResult.buffer);
    }
    return res.json({ status: 'success', data: execResult.data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  executeTemplate,
};
