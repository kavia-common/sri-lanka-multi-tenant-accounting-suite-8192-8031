# PDF Reporting Notes

This backend provides branded PDF generation utilities via PdfService (PDFKit) and supports streaming PDFs for certain reports. Advanced v2 report endpoints add comparative periods and budget vs actual analysis and currently support JSON and Excel (xlsx) outputs; PDF can be easily added by composing the response using PdfService.

Key files:
- src/services/PdfService.js: Helpers to create documents, draw headers/sections/tables/totals.
- src/controllers/*: Controllers that prepare data and invoke services.
- README_XLSX_REPORTS.md: Similar notes for Excel exports.
- README_ADVANCED_REPORTS.md: Details on v2 endpoints and parameters (period[], compare_to[], fiscal_year, budget_source, format).

Supported formats today:
- JSON: All v1 and v2 endpoints.
- XLSX: Trial Balance, Balance Sheet, Profit & Loss, General Ledger, Cash Flow, Aged AR/AP (v1 and v2).
- PDF: Compliance endpoints (e.g., VAT return) already support pdf via ?format=pdf. v2 financial statements can be rendered to PDF by composing sections with PdfService.

Advanced v2 parameters:
- period[]: array of strings. For P&L/GL/Cash Flow use "YYYY-MM-DD..YYYY-MM-DD". For Balance Sheet and Aged reports use a single as-of date "YYYY-MM-DD".
- compare_to[]: array of strings (same format as period[]), used for comparative analysis.
- budget_source: table:budgets | zero | prior_year
  - table:budgets: sums budgets.amount by account for the given period range.
  - zero: treats all budgets as 0.
  - prior_year: uses prior-year actuals for the same period as the budget baseline.
- fiscal_year: if period[] is omitted, service maps to:
  - P&L/GL/Cash Flow: YYYY-01-01..YYYY-12-31
  - Balance Sheet: YYYY-12-31 as_of_date
- format: json | xlsx (add pdf in future as needed)

Examples:
- Profit & Loss BvA with comparison:
  GET /api/reports/v2/profit-loss?period[]=2025-01-01..2025-03-31&compare_to[]=2024-01-01..2024-03-31&budget_source=table:budgets

- Balance Sheet comparative as-of:
  GET /api/reports/v2/balance-sheet?period[]=2025-03-31&compare_to[]=2024-03-31

- Trial Balance with fiscal year fallback and prior-year budget:
  GET /api/reports/v2/trial-balance?fiscal_year=2025&budget_source=prior_year

How to add PDF output for v2 endpoints:
1) In the relevant controller (src/controllers/advancedReports.js), after assembling data:
   - const doc = PdfService.createDocument(res, { fileName: 'report.pdf' });
   - PdfService.drawHeader(doc, req.company, { reportTitle: 'Title', periodText: '...', comparativeText: '...' });
   - Use PdfService.section, PdfService.table, PdfService.keyValues, PdfService.totalsRow to render content.
   - doc.end();
2) Add a query parameter ?format=pdf to trigger the PDF branch.
3) Ensure consistent columns with the JSON/XLSX shapes (actual, budget, variance, variancePercent) to keep layouts predictable.

Performance notes:
- Queries are parameterized and aligned with indexes on transactions(company_id, date), journal_entries(transaction_id, account_id), and budgets(company_id, account_id, period).
- v2 services batch database calls via Promise.all to reduce latency.
