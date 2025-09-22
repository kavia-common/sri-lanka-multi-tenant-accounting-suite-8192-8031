# Advanced Reports API (v2)

This API extends financial/statutory reports with comparative periods and Budget vs Actuals support, optimized for real-time response.

Common query parameters:
- period[]: array of strings. For P&L/GL/Cash Flow use "YYYY-MM-DD..YYYY-MM-DD". For Balance Sheet and Aged reports use a single date "YYYY-MM-DD".
- compare_to[]: array of strings (same format as period[]), used for comparative columns/sections.
- budget_source: table:budgets | zero | prior_year
  - table:budgets: sums budgets.amount by account for the given period range.
  - zero: treats all budgets as 0.
  - prior_year: uses prior-year actuals for the same period as the budget baseline.
- fiscal_year: if period[] is omitted, service maps to:
  - P&L/GL/Cash Flow: YYYY-01-01..YYYY-12-31
  - Balance Sheet: YYYY-12-31 as_of_date
- format: json | xlsx

Endpoints:
- GET /api/reports/v2/profit-loss
- GET /api/reports/v2/balance-sheet
- GET /api/reports/v2/trial-balance
- GET /api/reports/v2/general-ledger
- GET /api/reports/v2/cash-flow
- GET /api/reports/v2/aged-receivables
- GET /api/reports/v2/aged-payables
- GET /api/reports/v2/budget-vs-actual

Response structure:
- meta: describes base period used (and as_of_date for BS), plus bucket labels where applicable.
- payload: report-specific object; for Budget vs Actuals includes lines with { code, name, type, budget, actual, variance, variancePercent } and summary totals.
- comparative: optional array of comparative datasets.

Performance:
- Queries are parameterized and aligned with indexes on transactions(company_id, date) and journal_entries(transaction_id, account_id).
- Advanced service functions batch SQL calls via Promise.all to reduce latency.

Exports:
- xlsx export supported for all v2 endpoints by passing ?format=xlsx.

Examples:
- Profit & Loss BvA with compare:
  /api/reports/v2/profit-loss?period[]=2025-01-01..2025-03-31&compare_to[]=2024-01-01..2024-03-31&budget_source=table:budgets

- Balance Sheet comparative as-of:
  /api/reports/v2/balance-sheet?period[]=2025-03-31&compare_to[]=2024-03-31

- Trial Balance with fiscal year fallback:
  /api/reports/v2/trial-balance?fiscal_year=2025&budget_source=prior_year
