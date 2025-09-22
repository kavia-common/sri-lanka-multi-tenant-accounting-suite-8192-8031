'use strict';

const PDFDocument = require('pdfkit');

/**
 * PUBLIC_INTERFACE
 * renderCustomReportToBuffer
 * Generate a simple tabular PDF from custom report result/spec and return Buffer.
 */
async function renderCustomReportToBuffer(title, result, spec = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).fillColor('#111827').text(title || 'Custom Report', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#6B7280').text(`Generated at: ${new Date().toLocaleString()}`);
      doc.moveDown();

      const columns = (spec.columns || []).map((c) => c.label || c.key);
      const dataRows = Array.isArray(result?.data) ? result.data : (Array.isArray(result?.rows) ? result.rows : []);

      if (columns.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(columns.join(' | '));
        doc.moveDown(0.4);
        doc.font('Helvetica');
      }

      if (Array.isArray(dataRows) && dataRows.length > 0) {
        dataRows.forEach((row) => {
          if (columns.length > 0) {
            const values = (spec.columns || []).map((c) => {
              const key = c.key || c.source || c.field;
              return key ? String(row[key] ?? '') : '';
            });
            doc.fontSize(9).text(values.join(' | '));
          } else {
            doc.fontSize(9).text(JSON.stringify(row));
          }
        });
      } else {
        doc.text('No data');
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { renderCustomReportToBuffer };
