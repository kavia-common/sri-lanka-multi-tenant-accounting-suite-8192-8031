'use strict';

const PDFDocument = require('pdfkit');

/**
 * PdfService
 * Utility helpers to generate consistently branded PDFs for reports using PDFKit.
 * - Streams directly to the HTTP response.
 * - Adds company branding header, report title, period, and generated timestamp.
 * - Provides helpers for simple two-column key-value rows and section headers.
 *
 * Note: This is a baseline layout; can be extended with table rendering if needed later.
 */
class PdfService {
  /**
   * Build a PDF document and pipe it to the HTTP response.
   * Returns the created PDFDocument instance to allow further drawing by the caller.
   */
  // PUBLIC_INTERFACE
  static createDocument(res, { fileName = 'report.pdf' } = {}) {
    /** Create and configure a PDFDocument and pipe to response. */
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: { Title: fileName },
    });
    doc.pipe(res);
    return doc;
  }

  /**
   * Draw a branded header with company info and report title.
   * company: { name, address?, email?, phone?, tax_number? }
   * meta: { reportTitle, periodText?, comparativeText? }
   */
  // PUBLIC_INTERFACE
  static drawHeader(doc, company, meta) {
    /** Draw a consistent header area for reports. */
    const title = meta?.reportTitle || 'Report';
    const period = meta?.periodText || '';
    const compare = meta?.comparativeText || '';
    const generatedAt = new Date().toLocaleString();

    // Company branding/letterhead
    doc
      .fontSize(18)
      .fillColor('#111827')
      .text(company?.name || 'Company', { align: 'left' });

    const rightX = 300;
    doc
      .fontSize(9)
      .fillColor('#374151')
      .text(company?.address || '', rightX, doc.y - 16, { align: 'right' })
      .text(company?.email ? `Email: ${company.email}` : '', rightX, undefined, { align: 'right' })
      .text(company?.phone ? `Phone: ${company.phone}` : '', rightX, undefined, { align: 'right' })
      .text(company?.tax_number ? `Tax No: ${company.tax_number}` : '', rightX, undefined, { align: 'right' });

    doc.moveDown(0.5);
    // Title and meta
    doc
      .moveDown(0.5)
      .fontSize(14)
      .fillColor('#2563EB')
      .text(title, { align: 'left' });

    if (period) {
      doc.fontSize(10).fillColor('#111827').text(period, { align: 'left' });
    }
    if (compare) {
      doc.fontSize(10).fillColor('#6B7280').text(compare, { align: 'left' });
    }
    doc
      .fontSize(8)
      .fillColor('#6B7280')
      .text(`Generated at: ${generatedAt}`, { align: 'left' });

    // Separator line
    const y = doc.y + 10;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .lineWidth(1)
      .strokeColor('#E5E7EB')
      .stroke();

    doc.moveDown(1.2);
  }

  /**
   * Draw a section header.
   */
  // PUBLIC_INTERFACE
  static section(doc, title) {
    /** Draw a section heading with subtle separator. */
    doc
      .moveDown(0.6)
      .fontSize(12)
      .fillColor('#111827')
      .text(title, { continued: false });
    const y = doc.y + 2;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .lineWidth(0.5)
      .strokeColor('#E5E7EB')
      .stroke();
    doc.moveDown(0.4);
  }

  /**
   * Draw key-value pairs in two columns.
   * rows: [{ label, value }]
   */
  // PUBLIC_INTERFACE
  static keyValues(doc, rows) {
    /** Render simple key-value lines in two columns. */
    const leftX = doc.page.margins.left;
    const rightX = doc.page.width - doc.page.margins.right;
    const labelWidth = 180;
    const valueWidth = rightX - leftX - labelWidth;

    rows.forEach((r) => {
      doc.fontSize(10).fillColor('#374151').text(r.label || '', leftX, undefined, {
        width: labelWidth,
        continued: true,
      });
      doc.fontSize(10).fillColor('#111827').text(r.value ?? '', leftX + labelWidth + 12, undefined, {
        width: valueWidth - 12,
      });
    });
  }

  /**
   * Draw a simple totals row as three columns: left label and two numeric columns.
   */
  // PUBLIC_INTERFACE
  static totalsRow(doc, { label, values = [] }) {
    /** Render a totals row. values = array of { label?: string, amount: string|number } */
    const cols = [label, ...values.map(v => v.amount)];
    const widths = [230, 100, 100, 100, 100];
    let x = doc.page.margins.left;
    doc.fontSize(10).fillColor('#111827');
    cols.forEach((c, i) => {
      doc.text(String(c ?? ''), x, undefined, { width: widths[i] || 100, align: i === 0 ? 'left' : 'right' });
      x += widths[i] || 100;
    });
  }

  /**
   * Draw a simple tabular listing (up to 5 columns) for details.
   * columns: [{ key, title, width, align? }]
   * data: array of objects
   */
  // PUBLIC_INTERFACE
  static table(doc, { columns, data }) {
    /** Render a simple table with header row and body. */
    // Header
    let x = doc.page.margins.left;
    const startY = doc.y + 4;

    doc.fontSize(9).fillColor('#111827');
    columns.forEach(col => {
      doc.font('Helvetica-Bold');
      doc.text(col.title || '', x, startY, { width: col.width, align: col.align || 'left' });
      x += col.width;
    });

    // Separator
    doc.moveTo(doc.page.margins.left, startY + 14)
      .lineTo(doc.page.width - doc.page.margins.right, startY + 14)
      .lineWidth(0.5)
      .strokeColor('#E5E7EB')
      .stroke();

    // Body
    let y = startY + 20;
    doc.font('Helvetica');
    data.forEach(row => {
      x = doc.page.margins.left;
      columns.forEach(col => {
        const val = row[col.key];
        doc.fontSize(9).fillColor('#111827').text(val !== undefined && val !== null ? String(val) : '', x, y, {
          width: col.width,
          align: col.align || 'left'
        });
        x += col.width;
      });
      y = doc.y + 6;

      // New page if near bottom
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = doc.y;
      }
    });
    doc.moveDown(1);
  }
}

module.exports = PdfService;
