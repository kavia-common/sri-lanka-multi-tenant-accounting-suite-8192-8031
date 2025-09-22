# PDF Output for Sri Lanka Statutory and Financial Reports

This backend supports PDF generation for Sri Lanka statutory reports and annual financials using PDFKit with company branding/letterhead.

How to request PDF:
- Add `?format=pdf` to any supported report endpoint (default is JSON):
  - GET /api/reports/lk/vat-return?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD&include_transactions=true&format=pdf
  - GET /api/reports/lk/income-tax?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD&format=pdf
  - GET /api/reports/lk/wht-statement?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD&include_transactions=true&format=pdf
  - GET /api/reports/lk/epf-etf?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD&format=pdf
  - GET /api/reports/lk/annual-financials?as_of_date=YYYY-MM-DD&include_previous_year=true&format=pdf

Branding / Header:
- Pulls company info from DB: name, address, email, phone, tax_number.
- Displays report title, period info, and generated timestamp.
- Layout helper in src/services/PdfService.js

Per-report PDF content:
- VAT Return
  - Summary: Output VAT, Input VAT, Net VAT, Zero-rated Sales (est.), Exempt Sales (est.), Non-recoverable VAT (est.)
  - Optional details table of VAT-related transactions when `include_transactions=true`
- Income Tax Schedule
  - Computation: Revenue, Expenses, Profit Before Tax, Addbacks, Allowances, Taxable Income, Corporate Tax Rate, Tax Due
- WHT Statement
  - Summary by type (Interest, Dividend, Services, Other) with totals
  - Optional detailed transactions table when `include_transactions=true`
- EPF/ETF
  - Ledger amounts: Gross Pay, EPF Withheld (ledger), ETF Employer (ledger)
  - Estimated contributions: EPF Employee 8%, EPF Employer 12%, ETF Employer 3%
- Annual Financials
  - Current year Companies Act-style category summary
  - Optional previous year comparative if `include_previous_year=true`

Implementation notes:
- PDF builder: `src/services/PdfService.js`
- Controllers render PDF when `format=pdf`, otherwise return JSON as before.
- Corporate tax rate for income tax schedule uses env `SL_CORP_TAX_RATE` (default 0.30).
