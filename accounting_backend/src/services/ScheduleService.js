'use strict';

const db = require('../config/database');
const ReportingService = require('./ReportingService');
const ExcelService = require('./ExcelService');
const PdfService = require('./PdfService'); // used for PDF rendering into buffer via HTTP-like stream
const EmailService = require('./EmailService');

/**
 * Utilities to compute next run time based on schedule type and options
 */
function computeNextRun(schedule) {
  const now = new Date();
  const tz = schedule.timezone || 'UTC';
  // Note: For simplicity, we don't transform timezone here. In production use luxon.
  const base = schedule.next_run_at ? new Date(schedule.next_run_at) : now;

  const type = (schedule.schedule_type || '').toLowerCase();
  if (type === 'daily') {
    const n = new Date(base);
    n.setDate(n.getDate() + 1);
    return n;
  }
  if (type === 'weekly') {
    const n = new Date(base);
    n.setDate(n.getDate() + 7);
    return n;
  }
  if (type === 'monthly') {
    const n = new Date(base);
    n.setMonth(n.getMonth() + 1);
    return n;
  }
  // custom with cron_expression not fully parsed; default to +1 day as a safe baseline
  const n = new Date(base);
  n.setDate(n.getDate() + 1);
  return n;
}

/**
 * Render a report buffer based on type and format.
 * Returns { buffer, filename, mime }
 */
async function renderReportBuffer({ company, companyId, report_type, format, options }) {
  const fmt = (format || 'PDF').toUpperCase();
  const type = (report_type || '').toUpperCase();

  const companyMeta = company || { name: company?.name || 'Company' };
  let filename = 'report';
  let mime = 'application/pdf';

  if (fmt === 'XLSX') {
    mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  // Choose reporting service call
  switch (type) {
    case 'TRIAL_BALANCE': {
      const data = await ReportingService.getTrialBalance(companyId, options || {});
      if (fmt === 'XLSX') {
        const buffer = await ExcelService.buildTrialBalanceWorkbook({ company: companyMeta, params: options, data });
        filename = 'trial-balance.xlsx';
        return { buffer: Buffer.from(buffer), filename, mime };
      } else {
        // Build a simple PDF using PdfService helpers (render to buffer via memory stream)
        const { buffer, name } = await buildSimplePdf('Trial Balance', companyMeta, async (doc) => {
          PdfService.section(doc, 'Summary');
          PdfService.keyValues(doc, [
            { label: 'Total Debits', value: data.summary.totalDebits },
            { label: 'Total Credits', value: data.summary.totalCredits },
            { label: 'Balanced', value: data.summary.isBalanced ? 'Yes' : 'No' },
          ]);
          PdfService.section(doc, 'Lines');
          PdfService.table(doc, {
            columns: [
              { key: 'code', title: 'Code', width: 80 },
              { key: 'name', title: 'Name', width: 220 },
              { key: 'type', title: 'Type', width: 80 },
              { key: 'total_debits', title: 'Debits', width: 90, align: 'right' },
              { key: 'total_credits', title: 'Credits', width: 90, align: 'right' },
              { key: 'balance', title: 'Balance', width: 90, align: 'right' },
            ],
            data: (data.trialBalance || []),
          });
        }, { reportTitle: 'Trial Balance' }, options);
        filename = name;
        return { buffer, filename, mime };
      }
    }
    case 'BALANCE_SHEET': {
      const data = await ReportingService.getBalanceSheet(companyId, options || {});
      if (fmt === 'XLSX') {
        const buffer = await ExcelService.buildBalanceSheetWorkbook({ company: companyMeta, params: options, data });
        return { buffer: Buffer.from(buffer), filename: 'balance-sheet.xlsx', mime };
      } else {
        const { buffer, name } = await buildSimplePdf('Balance Sheet', companyMeta, async (doc) => {
          PdfService.section(doc, 'Summary');
          PdfService.keyValues(doc, [
            { label: 'Total Assets', value: data.summary.totalAssets },
            { label: 'Total Liabilities', value: data.summary.totalLiabilities },
            { label: 'Total Equity', value: data.summary.totalEquity },
            { label: 'Balanced', value: data.summary.isBalanced ? 'Yes' : 'No' },
          ]);
        }, { reportTitle: 'Balance Sheet' }, options);
        return { buffer, filename: name, mime };
      }
    }
    case 'PROFIT_LOSS': {
      const data = await ReportingService.getProfitLoss(companyId, options || {});
      if (fmt === 'XLSX') {
        const buffer = await ExcelService.buildProfitLossWorkbook({ company: companyMeta, params: options, data });
        return { buffer: Buffer.from(buffer), filename: 'profit-loss.xlsx', mime };
      } else {
        const { buffer, name } = await buildSimplePdf('Profit & Loss', companyMeta, async (doc) => {
          PdfService.section(doc, 'Summary');
          PdfService.keyValues(doc, [
            { label: 'Total Revenue', value: data.summary.totalRevenue },
            { label: 'Total Expenses', value: data.summary.totalExpenses },
            { label: 'Net Income', value: data.summary.netIncome },
          ]);
        }, { reportTitle: 'Profit & Loss' }, options);
        return { buffer, filename: name, mime };
      }
    }
    case 'GENERAL_LEDGER': {
      const data = await ReportingService.getGeneralLedger(companyId, options || {});
      if (fmt === 'XLSX') {
        const buffer = await ExcelService.buildLedgerWorkbook({ company: companyMeta, params: options, data });
        return { buffer: Buffer.from(buffer), filename: 'general-ledger.xlsx', mime };
      } else {
        const { buffer, name } = await buildSimplePdf('General Ledger', companyMeta, async (doc) => {
          PdfService.section(doc, 'Info');
          PdfService.keyValues(doc, [
            { label: 'Accounts', value: String((data.ledger || []).length) },
          ]);
        }, { reportTitle: 'General Ledger' }, options);
        return { buffer, filename: name, mime };
      }
    }
    case 'CASH_FLOW': {
      const data = await ReportingService.getCashFlow(companyId, options || {});
      if (fmt === 'XLSX') {
        const buffer = await ExcelService.buildCashFlowWorkbook({ company: companyMeta, params: options, data });
        return { buffer: Buffer.from(buffer), filename: 'cash-flow.xlsx', mime };
      } else {
        const { buffer, name } = await buildSimplePdf('Cash Flow (Indirect)', companyMeta, async (doc) => {
          PdfService.section(doc, 'Summary');
          PdfService.keyValues(doc, [
            { label: 'Operating', value: data.cashFlow.operating },
            { label: 'Investing', value: data.cashFlow.investing },
            { label: 'Financing', value: data.cashFlow.financing },
            { label: 'Net Change', value: data.summary.netChangeInCash },
          ]);
        }, { reportTitle: 'Cash Flow Statement' }, options);
        return { buffer, filename: name, mime };
      }
    }
    case 'CHANGES_IN_EQUITY':
    case 'AGED_RECEIVABLES':
    case 'AGED_PAYABLES':
    case 'BUDGET_VS_ACTUAL': {
      // For brevity, send XLSX only for these; PDFs can be extended later.
      const map = {
        'CHANGES_IN_EQUITY': async () => {
          const data = await ReportingService.getChangesInEquity(companyId, options || {});
          return ExcelService.buildSimpleKeyAmountWorkbook({
            title: 'Statement of Changes in Equity',
            company: companyMeta,
            headers: ['Code', 'Name', 'Amount'],
            rows: (data.changesInEquity || []).map(l => [l.code, l.name, Number(l.amount || 0)]),
            numberIndexes: [3],
            params: options
          });
        },
        'AGED_RECEIVABLES': async () => {
          const data = await ReportingService.getAgedReceivables(companyId, options || {});
          const ar = data.agedReceivables || {};
          const buckets = options?.buckets || [30,60,90,120];
          return ExcelService.buildSimpleKeyAmountWorkbook({
            title: 'Aged Receivables',
            company: companyMeta,
            headers: ['Bucket', 'Amount'],
            rows: [
              ['Current', Number(ar.current || 0)],
              [`${buckets[0]}d`, Number(ar[`${buckets[0]}d`] || 0)],
              [`${buckets[1]}d`, Number(ar[`${buckets[1]}d`] || 0)],
              [`${buckets[2]}d`, Number(ar[`${buckets[2]}d`] || 0)],
              ['Over', Number(ar.over || 0)],
            ],
            numberIndexes: [2],
            params: options
          });
        },
        'AGED_PAYABLES': async () => {
          const data = await ReportingService.getAgedPayables(companyId, options || {});
          const ap = data.agedPayables || {};
          const buckets = options?.buckets || [30,60,90,120];
          return ExcelService.buildSimpleKeyAmountWorkbook({
            title: 'Aged Payables',
            company: companyMeta,
            headers: ['Bucket', 'Amount'],
            rows: [
              ['Current', Number(ap.current || 0)],
              [`${buckets[0]}d`, Number(ap[`${buckets[0]}d`] || 0)],
              [`${buckets[1]}d`, Number(ap[`${buckets[1]}d`] || 0)],
              [`${buckets[2]}d`, Number(ap[`${buckets[2]}d`] || 0)],
              ['Over', Number(ap.over || 0)],
            ],
            numberIndexes: [2],
            params: options
          });
        },
        'BUDGET_VS_ACTUAL': async () => {
          const data = await ReportingService.getBudgetVsActual(companyId, options || {});
          return ExcelService.buildSimpleKeyAmountWorkbook({
            title: 'Budget vs Actuals',
            company: companyMeta,
            headers: ['Code', 'Name', 'Type', 'Budget', 'Actual', 'Variance', 'Variance %'],
            rows: (data?.budgetVsActual || []).map(l => [
              l.code, l.name, l.type,
              Number(l.budget || 0), Number(l.actual || 0),
              Number(l.variance || 0),
              l.variancePercent ? Number(l.variancePercent) / 100 : 0,
            ]),
            numberIndexes: [4,5,6,7],
            params: options
          });
        }
      };
      const builder = map[type];
      const buffer = await builder();
      return { buffer: Buffer.from(buffer), filename: `${type.toLowerCase().replace(/_/g,'-')}.xlsx`, mime };
    }
    default:
      throw new Error(`Unsupported report type: ${type}`);
  }
}

/**
 * Helper for creating a PDF in-memory buffer using PdfService with a temp stream sink.
 */
function buildSimplePdf(defaultName, company, drawCb, headerMeta, params) {
  return new Promise((resolve, reject) => {
    // use a PassThrough-like mechanism by writing to buffers
    const chunks = [];
    const res = {
      setHeader: () => {},
      send: (buf) => chunks.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf)),
      write: (buf) => chunks.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf)),
      end: () => {},
    };
    const fileName = `${(defaultName || 'report').toLowerCase().replace(/\s+/g,'-')}.pdf`;
    const doc = PdfService.createDocument(res, { fileName });
    PdfService.drawHeader(doc, company, { reportTitle: headerMeta?.reportTitle, periodText: derivePeriodText(params) });
    Promise.resolve()
      .then(() => drawCb(doc))
      .then(() => {
        doc.end();
        setTimeout(() => {
          const buffer = Buffer.concat(chunks);
          resolve({ buffer, name: fileName });
        }, 10);
      })
      .catch((e) => reject(e));
  });
}

function derivePeriodText(params) {
  if (!params) return '';
  if (params.start_date || params.end_date) {
    return `Period: ${params.start_date || 'Beginning'} to ${params.end_date || 'Today'}`;
  }
  if (params.as_of_date) return `As of ${params.as_of_date}`;
  return '';
}

class ScheduleService {
  // PUBLIC_INTERFACE
  /**
   * Create a schedule
   */
  static async createSchedule({ companyId, userId, payload }) {
    const {
      name, report_type, format, recipients, notes, options,
      schedule_type, cron_expression, timezone, next_run_at,
    } = payload;

    const sql = `
      INSERT INTO report_schedules
        (company_id, created_by, name, report_type, format, recipients, notes, options, schedule_type, cron_expression, timezone, next_run_at, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
      RETURNING *
    `;
    const params = [
      companyId, userId, name, report_type, format, recipients, notes || null, options || {}, schedule_type,
      cron_expression || null, timezone || 'UTC', next_run_at || new Date()
    ];
    const { rows } = await db.query(sql, params);
    return rows[0];
  }

  // PUBLIC_INTERFACE
  static async updateSchedule({ companyId, scheduleId, payload }) {
    // Simple patch update
    const fields = ['name','report_type','format','recipients','notes','options','schedule_type','cron_expression','timezone','next_run_at','is_active'];
    const sets = [];
    const values = [];
    let idx = 1;
    fields.forEach((f) => {
      if (payload[f] !== undefined) {
        sets.push(`${f} = $${idx++}`);
        values.push(payload[f]);
      }
    });
    if (!sets.length) {
      const { rows } = await db.query('SELECT * FROM report_schedules WHERE id=$1 AND company_id=$2', [scheduleId, companyId]);
      return rows[0];
    }
    const sql = `UPDATE report_schedules SET ${sets.join(', ')} WHERE id = $${idx} AND company_id = $${idx+1} RETURNING *`;
    values.push(scheduleId, companyId);
    const { rows } = await db.query(sql, values);
    return rows[0];
  }

  // PUBLIC_INTERFACE
  static async deleteSchedule({ companyId, scheduleId }) {
    await db.query('DELETE FROM report_schedules WHERE id=$1 AND company_id=$2', [scheduleId, companyId]);
    return { deleted: true };
  }

  // PUBLIC_INTERFACE
  static async getSchedule({ companyId, scheduleId }) {
    const { rows } = await db.query('SELECT * FROM report_schedules WHERE id=$1 AND company_id=$2', [scheduleId, companyId]);
    return rows[0];
  }

  // PUBLIC_INTERFACE
  static async listSchedules({ companyId, page = 1, limit = 50 }) {
    const offset = (Number(page) - 1) * Number(limit);
    const { rows } = await db.query('SELECT * FROM report_schedules WHERE company_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [companyId, limit, offset]);
    return rows;
  }

  // PUBLIC_INTERFACE
  static async listLogs({ companyId, scheduleId, page = 1, limit = 50 }) {
    const offset = (Number(page) - 1) * Number(limit);
    const params = [companyId];
    let where = 'company_id=$1';
    if (scheduleId) {
      params.push(scheduleId);
      where += ` AND schedule_id=$${params.length}`;
    }
    params.push(limit, offset);
    const { rows } = await db.query(`SELECT * FROM report_delivery_logs WHERE ${where} ORDER BY started_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    return rows;
  }

  /**
   * Execute a schedule once: generate report, send email, log result, update next_run_at
   */
  static async runSchedule({ scheduleId, triggerUserId = null }) {
    const { rows } = await db.query('SELECT rs.*, c.name as company_name FROM report_schedules rs JOIN companies c ON c.id = rs.company_id WHERE rs.id=$1', [scheduleId]);
    if (!rows.length) throw new Error('Schedule not found');
    const s = rows[0];

    const logStart = await db.query(
      `INSERT INTO report_delivery_logs(schedule_id, company_id, report_type, format, recipients, status, triggered_by, started_at)
       VALUES ($1,$2,$3,$4,$5,'SENT',$6, now()) RETURNING id`,
      [s.id, s.company_id, s.report_type, s.format, s.recipients, triggerUserId]
    );
    const logId = logStart.rows[0].id;

    try {
      const { buffer, filename, mime } = await renderReportBuffer({
        company: { name: s.company_name },
        companyId: s.company_id,
        report_type: s.report_type,
        format: s.format === 'XLSX' ? 'XLSX' : 'PDF',
        options: s.options || {},
      });

      const subject = `[${s.company_name}] ${humanizeReportType(s.report_type)} Report`;
      const text = s.notes ? s.notes : `Please find attached ${humanizeReportType(s.report_type)} report.`;
      const html = `<p>${s.notes || ''}</p>`;

      await EmailService.sendReportEmail({
        to: s.recipients || [],
        subject,
        text,
        html,
        attachment: buffer,
        filename,
        mimeType: mime,
      });

      await db.query('UPDATE report_delivery_logs SET completed_at = now() WHERE id = $1', [logId]);

      const next = computeNextRun(s);
      await db.query('UPDATE report_schedules SET last_run_at=now(), next_run_at=$1 WHERE id=$2', [next, s.id]);

      return { ok: true, logId };
    } catch (err) {
      await db.query('UPDATE report_delivery_logs SET status=$1, error_message=$2, completed_at=now() WHERE id=$3', ['FAILED', err.message || String(err), logId]);
      throw err;
    }
  }
}

function humanizeReportType(t) {
  return (t || '').toString().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = ScheduleService;
