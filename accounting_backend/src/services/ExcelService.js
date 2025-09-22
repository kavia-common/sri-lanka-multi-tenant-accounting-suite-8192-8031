'use strict';

/**
 * ExcelService
 * Utility to generate branded Excel workbooks for financial reports using ExcelJS.
 * - Public methods return a Buffer to be streamed to HTTP response.
 * - Provides helpers to add company header, style tables, numeric formats, and totals with formulas.
 */

const ExcelJS = require('exceljs');

// Convert 1-based column index to Excel column letter (supports up to at least ZZZ)
function colName(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

// Number formats used for finance
const formats = {
  money: '#,##0.00;[Red]-#,##0.00',
  integer: '0',
  percent: '0.00%',
};

function applyHeaderStyle(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };
}

function applyBodyBorder(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };
}

// PUBLIC_INTERFACE
async function buildTrialBalanceWorkbook({ company, params, data }) {
  /**
   * Build an Excel workbook for Trial Balance.
   * company: { name, code?, email?, phone?, address? }
   * params: { start_date?, end_date? }
   * data: { trialBalance: [...], summary: {...} }
   * Returns Buffer
   */
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Accounting API';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Trial Balance', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  // Company Header and report meta (rows 1-5)
  sheet.getCell('A1').value = company?.name || 'Company';
  sheet.mergeCells('A1', 'F1');
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF111827' } };

  sheet.getCell('A2').value = 'Trial Balance';
  sheet.mergeCells('A2', 'F2');
  sheet.getCell('A2').font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };

  const periodText = params?.start_date || params?.end_date
    ? `Period: ${params?.start_date || 'Beginning'} to ${params?.end_date || 'Today'}`
    : 'As of today';
  sheet.getCell('A3').value = periodText;
  sheet.mergeCells('A3', 'F3');
  sheet.getCell('A3').font = { size: 10, color: { argb: 'FF374151' } };

  sheet.getCell('A4').value = `Generated at: ${new Date().toLocaleString()}`;
  sheet.mergeCells('A4', 'F4');
  sheet.getCell('A4').font = { size: 9, color: { argb: 'FF6B7280' } };

  // Summary Row (Totals)
  sheet.getCell('A5').value = 'Summary';
  sheet.getCell('A5').font = { bold: true, color: { argb: 'FF111827' } };
  sheet.getCell('E5').value = Number(data?.summary?.totalDebits || 0);
  sheet.getCell('E5').numFmt = formats.money;
  sheet.getCell('F5').value = Number(data?.summary?.totalCredits || 0);
  sheet.getCell('F5').numFmt = formats.money;

  // Table header (row 6)
  const hasBvA = Array.isArray(data?.trialBalance) && data.trialBalance.some(l => l.budget !== undefined || l.variance !== undefined);
  const headers = hasBvA
    ? ['Account Code', 'Account Name', 'Type', 'Balance', 'Budget', 'Actual', 'Variance', 'Variance %', 'Total Debits', 'Total Credits']
    : ['Account Code', 'Account Name', 'Type', 'Balance', 'Total Debits', 'Total Credits'];
  const widths = hasBvA ? [18, 36, 14, 16, 16, 16, 16, 14, 16, 16] : [18, 36, 14, 16, 16, 16];
  headers.forEach((h, i) => {
    const cell = sheet.getRow(6).getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell);
    sheet.getColumn(i + 1).width = widths[i];
  });

  // Body rows (from row 7)
  const startRow = 7;
  (data?.trialBalance || []).forEach((line, idx) => {
    const r = sheet.getRow(startRow + idx);
    let col = 1;
    r.getCell(col++).value = line.code;
    r.getCell(col++).value = line.name;
    r.getCell(col++).value = line.type;
    r.getCell(col).value = Number(line.balance || 0); r.getCell(col).numFmt = formats.money; col++;
    if (hasBvA) {
      r.getCell(col).value = Number(line.budget || 0); r.getCell(col).numFmt = formats.money; col++;
      r.getCell(col).value = Number(line.actual || line.balance || 0); r.getCell(col).numFmt = formats.money; col++;
      r.getCell(col).value = Number(line.variance || 0); r.getCell(col).numFmt = formats.money; col++;
      r.getCell(col).value = typeof line.variancePercent === 'string'
        ? Number(line.variancePercent) / 100
        : (Number(line.variancePercent || 0) / 100);
      r.getCell(col).numFmt = formats.percent; col++;
    }
    r.getCell(col).value = Number(line.total_debits || 0); r.getCell(col).numFmt = formats.money; col++;
    r.getCell(col).value = Number(line.total_credits || 0); r.getCell(col).numFmt = formats.money; col++;

    for (let c = 1; c <= (hasBvA ? 10 : 6); c++) {
      applyBodyBorder(r.getCell(c));
      if (c >= 4) r.getCell(c).alignment = { horizontal: 'right' };
    }
  });

  // Totals row with formulas
  const lastRow = startRow + (data?.trialBalance?.length || 0);
  const totalRow = sheet.getRow(lastRow + 1);
  totalRow.getCell(3).value = 'Totals';
  totalRow.getCell(3).font = { bold: true };
  const lastCol = hasBvA ? 10 : 6;
  // Balance
  totalRow.getCell(4).value = { formula: `SUM(D${startRow}:D${lastRow})` };
  totalRow.getCell(4).numFmt = formats.money;
  let sumStartIdx = 5;
  if (hasBvA) {
    // Budget, Actual, Variance
    totalRow.getCell(5).value = { formula: `SUM(E${startRow}:E${lastRow})` }; totalRow.getCell(5).numFmt = formats.money;
    totalRow.getCell(6).value = { formula: `SUM(F${startRow}:F${lastRow})` }; totalRow.getCell(6).numFmt = formats.money;
    totalRow.getCell(7).value = { formula: `SUM(G${startRow}:G${lastRow})` }; totalRow.getCell(7).numFmt = formats.money;
    // Variance % left blank in totals
    sumStartIdx = 9;
  }
  totalRow.getCell(sumStartIdx).value = { formula: `SUM(${colName(sumStartIdx)}${startRow}:${colName(sumStartIdx)}${lastRow})` }; totalRow.getCell(sumStartIdx).numFmt = formats.money;
  totalRow.getCell(sumStartIdx + 1).value = { formula: `SUM(${colName(sumStartIdx + 1)}${startRow}:${colName(sumStartIdx + 1)}${lastRow})` }; totalRow.getCell(sumStartIdx + 1).numFmt = formats.money;
  for (let c = 1; c <= lastCol; c++) applyBodyBorder(totalRow.getCell(c));

  return wb.xlsx.writeBuffer();
}

// PUBLIC_INTERFACE
async function buildBalanceSheetWorkbook({ company, params, data }) {
  /**
   * Build an Excel workbook for Balance Sheet with Assets, Liabilities, Equity.
   * Adds totals and balance check.
   */
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Balance Sheet', { views: [{ state: 'frozen', ySplit: 6 }] });

  sheet.getCell('A1').value = company?.name || 'Company';
  sheet.mergeCells('A1', 'E1');
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF111827' } };

  sheet.getCell('A2').value = 'Balance Sheet';
  sheet.mergeCells('A2', 'E2');
  sheet.getCell('A2').font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };

  const asOf = params?.as_of_date ? `As of ${params.as_of_date}` : 'As of today';
  sheet.getCell('A3').value = asOf;
  sheet.mergeCells('A3', 'E3');
  sheet.getCell('A3').font = { size: 10, color: { argb: 'FF374151' } };

  sheet.getCell('A4').value = `Generated at: ${new Date().toLocaleString()}`;
  sheet.mergeCells('A4', 'E4');
  sheet.getCell('A4').font = { size: 9, color: { argb: 'FF6B7280' } };

  // Sections
  const headers = ['Code', 'Name', 'Amount'];
  const widths = [16, 36, 16];
  const startRow = 6;

  function writeSection(title, lines, startAt) {
    const titleRow = sheet.getRow(startAt);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF111827' } };
    // header
    const hdr = sheet.getRow(startAt + 1);
    headers.forEach((h, i) => {
      const cell = hdr.getCell(i + 1);
      cell.value = h;
      applyHeaderStyle(cell);
      sheet.getColumn(i + 1).width = widths[i];
    });
    // body
    const bodyStart = startAt + 2;
    (lines || []).forEach((l, i) => {
      const r = sheet.getRow(bodyStart + i);
      r.getCell(1).value = l.code;
      r.getCell(2).value = l.name;
      r.getCell(3).value = Number(l.amount || 0);
      r.getCell(3).numFmt = formats.money;
      r.getCell(3).alignment = { horizontal: 'right' };
      for (let c = 1; c <= 3; c++) applyBodyBorder(r.getCell(c));
    });
    const end = bodyStart + (lines?.length || 0) - 1;
    const totalRow = sheet.getRow(end + 1);
    totalRow.getCell(2).value = `${title} Total`;
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(3).value = (lines?.length || 0) > 0 ? { formula: `SUM(C${bodyStart}:C${end})` } : 0;
    totalRow.getCell(3).numFmt = formats.money;
    for (let c = 1; c <= 3; c++) applyBodyBorder(totalRow.getCell(c));
    return end + 2;
  }

  let row = startRow;
  row = writeSection('Assets', data?.balanceSheet?.assets, row);
  row += 1;
  row = writeSection('Liabilities', data?.balanceSheet?.liabilities, row);
  row += 1;
  row = writeSection('Equity', data?.balanceSheet?.equity, row);

  // Summary
  row += 2;
  sheet.getRow(row).getCell(1).value = 'Summary';
  sheet.getRow(row).getCell(1).font = { bold: true };
  sheet.getRow(row + 1).getCell(1).value = 'Total Assets';
  sheet.getRow(row + 1).getCell(2).value = Number(data?.summary?.totalAssets || 0);
  sheet.getRow(row + 1).getCell(2).numFmt = formats.money;
  sheet.getRow(row + 2).getCell(1).value = 'Total Liabilities + Equity';
  const tie = Number(data?.summary?.totalLiabilities || 0) + Number(data?.summary?.totalEquity || 0);
  sheet.getRow(row + 2).getCell(2).value = tie;
  sheet.getRow(row + 2).getCell(2).numFmt = formats.money;

  return wb.xlsx.writeBuffer();
}

// PUBLIC_INTERFACE
async function buildProfitLossWorkbook({ company, params, data }) {
  /**
   * Build a P&L workbook with Revenue and Expenses sections and totals/net income.
   */
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Profit & Loss', { views: [{ state: 'frozen', ySplit: 6 }] });

  sheet.getCell('A1').value = company?.name || 'Company';
  sheet.mergeCells('A1', 'E1');
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF111827' } };

  sheet.getCell('A2').value = 'Profit & Loss';
  sheet.mergeCells('A2', 'E2');
  sheet.getCell('A2').font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };

  const periodText = `Period: ${params?.start_date} to ${params?.end_date}`;
  sheet.getCell('A3').value = periodText;
  sheet.mergeCells('A3', 'E3');
  sheet.getCell('A3').font = { size: 10, color: { argb: 'FF374151' } };

  sheet.getCell('A4').value = `Generated at: ${new Date().toLocaleString()}`;
  sheet.mergeCells('A4', 'E4');
  sheet.getCell('A4').font = { size: 9, color: { argb: 'FF6B7280' } };

  const headers = ['Code', 'Name', 'Amount'];
  const widths = [16, 36, 16];

  function writeSec(title, lines, start) {
    const tr = sheet.getRow(start);
    tr.getCell(1).value = title;
    tr.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF111827' } };
    const hdr = sheet.getRow(start + 1);
    headers.forEach((h, i) => {
      const cell = hdr.getCell(i + 1);
      cell.value = h;
      applyHeaderStyle(cell);
      sheet.getColumn(i + 1).width = widths[i];
    });
    const bodyStart = start + 2;
    (lines || []).forEach((l, i) => {
      const r = sheet.getRow(bodyStart + i);
      r.getCell(1).value = l.code;
      r.getCell(2).value = l.name;
      r.getCell(3).value = Number(l.amount || 0);
      r.getCell(3).numFmt = formats.money;
      r.getCell(3).alignment = { horizontal: 'right' };
      for (let c = 1; c <= 3; c++) applyBodyBorder(r.getCell(c));
    });
    const end = bodyStart + (lines?.length || 0) - 1;
    const totalRow = sheet.getRow(end + 1);
    totalRow.getCell(2).value = `${title} Total`;
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(3).value = (lines?.length || 0) > 0 ? { formula: `SUM(C${bodyStart}:C${end})` } : 0;
    totalRow.getCell(3).numFmt = formats.money;
    for (let c = 1; c <= 3; c++) applyBodyBorder(totalRow.getCell(c));
    return end + 2;
  }

  let row = 6;
  row = writeSec('Revenue', data?.profitLoss?.revenue, row);
  row += 1;
  row = writeSec('Expenses', data?.profitLoss?.expenses, row);

  // Net income
  row += 2;
  sheet.getRow(row).getCell(1).value = 'Summary';
  sheet.getRow(row).getCell(1).font = { bold: true };
  sheet.getRow(row + 1).getCell(1).value = 'Total Revenue';
  sheet.getRow(row + 1).getCell(2).value = Number(data?.summary?.totalRevenue || 0);
  sheet.getRow(row + 1).getCell(2).numFmt = formats.money;
  sheet.getRow(row + 2).getCell(1).value = 'Total Expenses';
  sheet.getRow(row + 2).getCell(2).value = Number(data?.summary?.totalExpenses || 0);
  sheet.getRow(row + 2).getCell(2).numFmt = formats.money;
  sheet.getRow(row + 3).getCell(1).value = 'Net Income';
  sheet.getRow(row + 3).getCell(2).value = Number(data?.summary?.netIncome || 0);
  sheet.getRow(row + 3).getCell(2).numFmt = formats.money;

  return wb.xlsx.writeBuffer();
}

// PUBLIC_INTERFACE
async function buildLedgerWorkbook({ company, params, data }) {
  /**
   * Build a General Ledger workbook with grouped accounts and entries.
   */
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('General Ledger', { views: [{ state: 'frozen', ySplit: 6 }] });

  sheet.getCell('A1').value = company?.name || 'Company';
  sheet.mergeCells('A1', 'G1');
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF111827' } };

  sheet.getCell('A2').value = 'General Ledger';
  sheet.mergeCells('A2', 'G2');
  sheet.getCell('A2').font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };

  const periodText = (params?.start_date || params?.end_date)
    ? `Period: ${params?.start_date || 'Beginning'} to ${params?.end_date || 'Today'}`
    : 'All Dates';
  sheet.getCell('A3').value = periodText;
  sheet.mergeCells('A3', 'G3');
  sheet.getCell('A3').font = { size: 10, color: { argb: 'FF374151' } };

  sheet.getCell('A4').value = `Generated at: ${new Date().toLocaleString()}`;
  sheet.mergeCells('A4', 'G4');
  sheet.getCell('A4').font = { size: 9, color: { argb: 'FF6B7280' } };

  // Table headers
  const headers = ['Account Code', 'Account Name', 'Date', 'Txn #', 'Description', 'Debit', 'Credit'];
  const widths = [16, 26, 12, 12, 36, 14, 14];
  headers.forEach((h, i) => {
    const cell = sheet.getRow(6).getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell);
    sheet.getColumn(i + 1).width = widths[i];
  });

  // Body
  let row = 7;
  (data?.ledger || []).forEach(acc => {
    // Account header
    const hdr = sheet.getRow(row++);
    hdr.getCell(1).value = `${acc.code} - ${acc.name}`;
    hdr.getCell(1).font = { bold: true, color: { argb: 'FF111827' } };
    sheet.mergeCells(`A${row - 1}:G${row - 1}`);

    (acc.entries || []).forEach(e => {
      const r = sheet.getRow(row++);
      r.getCell(1).value = acc.code;
      r.getCell(2).value = acc.name;
      r.getCell(3).value = e.date ? new Date(e.date) : '';
      r.getCell(3).numFmt = 'yyyy-mm-dd';
      r.getCell(4).value = e.transaction_id;
      r.getCell(5).value = e.description || '';
      r.getCell(6).value = Number(e.debit || 0);
      r.getCell(6).numFmt = formats.money;
      r.getCell(7).value = Number(e.credit || 0);
      r.getCell(7).numFmt = formats.money;
      for (let c = 1; c <= 7; c++) applyBodyBorder(r.getCell(c));
    });

    // Subtotals
    const dr = sheet.getRow(row++);
    dr.getCell(5).value = 'Account Totals';
    dr.getCell(5).font = { bold: true };
    dr.getCell(6).value = Number(acc.total_debits || 0);
    dr.getCell(6).numFmt = formats.money;
    dr.getCell(7).value = Number(acc.total_credits || 0);
    dr.getCell(7).numFmt = formats.money;
    for (let c = 1; c <= 7; c++) applyBodyBorder(dr.getCell(c));

    row++;
  });

  return wb.xlsx.writeBuffer();
}

// PUBLIC_INTERFACE
async function buildCashFlowWorkbook({ company, params, data }) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Cash Flow', { views: [{ state: 'frozen', ySplit: 6 }] });

  sheet.getCell('A1').value = company?.name || 'Company';
  sheet.mergeCells('A1', 'D1');
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF111827' } };

  sheet.getCell('A2').value = 'Cash Flow Statement (Indirect)';
  sheet.mergeCells('A2', 'D2');
  sheet.getCell('A2').font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };

  const periodText = `Period: ${params?.start_date} to ${params?.end_date}`;
  sheet.getCell('A3').value = periodText;
  sheet.mergeCells('A3', 'D3');
  sheet.getCell('A3').font = { size: 10, color: { argb: 'FF374151' } };

  sheet.getCell('A4').value = `Generated at: ${new Date().toLocaleString()}`;
  sheet.mergeCells('A4', 'D4');
  sheet.getCell('A4').font = { size: 9, color: { argb: 'FF6B7280' } };

  const headers = ['Section', 'Description', 'Amount'];
  const widths = [22, 30, 14];
  headers.forEach((h, i) => {
    const cell = sheet.getRow(6).getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell);
    sheet.getColumn(i + 1).width = widths[i];
  });

  const lines = [
    ['Operating', 'Net cash from operating activities', Number(data?.cashFlow?.operating || 0)],
    ['Investing', 'Net cash from investing activities', Number(data?.cashFlow?.investing || 0)],
    ['Financing', 'Net cash from financing activities', Number(data?.cashFlow?.financing || 0)],
  ];
  let r = 7;
  lines.forEach(line => {
    const row = sheet.getRow(r++);
    row.getCell(1).value = line[0];
    row.getCell(2).value = line[1];
    row.getCell(3).value = line[2];
    row.getCell(3).numFmt = formats.money;
    row.getCell(3).alignment = { horizontal: 'right' };
    for (let c = 1; c <= 3; c++) applyBodyBorder(row.getCell(c));
  });

  const totalRow = sheet.getRow(r);
  totalRow.getCell(2).value = 'Net change in cash';
  totalRow.getCell(2).font = { bold: true };
  totalRow.getCell(3).value = Number(data?.summary?.netChangeInCash || 0);
  totalRow.getCell(3).numFmt = formats.money;
  for (let c = 1; c <= 3; c++) applyBodyBorder(totalRow.getCell(c));

  return wb.xlsx.writeBuffer();
}

// PUBLIC_INTERFACE
async function buildSimpleKeyAmountWorkbook({ title, company, headers, rows, numberIndexes = [], params }) {
  /**
   * Generic worksheet builder for simple key/amount rows (e.g., Aged Receivables/Payables).
   * headers: array of column titles
   * rows: array of arrays matching headers
   * numberIndexes: column indexes (1-based) that should use money format
   */
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 6 }] });

  sheet.getCell('A1').value = company?.name || 'Company';
  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF111827' } };

  sheet.getCell('A2').value = title;
  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell('A2').font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };

  const periodText = params?.as_of_date
    ? `As of ${params.as_of_date}`
    : (params?.start_date || params?.end_date) ? `Period: ${params?.start_date || ''} to ${params?.end_date || ''}` : '';
  if (periodText) {
    sheet.getCell('A3').value = periodText;
    sheet.mergeCells(3, 1, 3, headers.length);
    sheet.getCell('A3').font = { size: 10, color: { argb: 'FF374151' } };
  }

  sheet.getRow(6).height = 18;
  headers.forEach((h, i) => {
    const cell = sheet.getRow(6).getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell);
    sheet.getColumn(i + 1).width = 18;
  });

  let row = 7;
  rows.forEach(arr => {
    const r = sheet.getRow(row++);
    arr.forEach((val, idx) => {
      const c = r.getCell(idx + 1);
      c.value = val;
      if (numberIndexes.includes(idx + 1)) {
        c.numFmt = formats.money;
        c.alignment = { horizontal: 'right' };
      }
      applyBodyBorder(c);
    });
  });

  return wb.xlsx.writeBuffer();
}

module.exports = {
  // PUBLIC_INTERFACE
  buildTrialBalanceWorkbook,
  // PUBLIC_INTERFACE
  buildBalanceSheetWorkbook,
  // PUBLIC_INTERFACE
  buildProfitLossWorkbook,
  // PUBLIC_INTERFACE
  buildLedgerWorkbook,
  // PUBLIC_INTERFACE
  buildCashFlowWorkbook,
  // PUBLIC_INTERFACE
  buildSimpleKeyAmountWorkbook,
};
