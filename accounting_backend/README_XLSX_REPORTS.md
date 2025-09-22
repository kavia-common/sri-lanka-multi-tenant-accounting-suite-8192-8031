# XLSX Export for Reports

This backend supports Excel (XLSX) export for all reports using ExcelJS with company branding and financial formatting.

How to use:
- Append `?format=xlsx` to any reporting endpoint.
- Ensure `x-company-id` header and Authorization bearer token are provided.

Examples:
- GET /api/reports/trial-balance?start_date=2025-01-01&end_date=2025-03-31&format=xlsx
- GET /api/reports/balance-sheet?as_of_date=2025-03-31&format=xlsx
- GET /api/reports/profit-loss?start_date=2025-01-01&end_date=2025-03-31&format=xlsx
- GET /api/reports/v2/general-ledger?start_date=2025-01-01&end_date=2025-03-31&format=xlsx
- GET /api/reports/v2/cash-flow?start_date=2025-01-01&end_date=2025-03-31&format=xlsx
- GET /api/reports/v2/changes-in-equity?start_date=2025-01-01&end_date=2025-03-31&format=xlsx
- GET /api/reports/v2/aged-receivables?as_of_date=2025-03-31&format=xlsx
- GET /api/reports/v2/aged-payables?as_of_date=2025-03-31&format=xlsx
- GET /api/reports/v2/budget-vs-actual?start_date=2025-01-01&end_date=2025-03-31&format=xlsx

Branding:
- Company name is displayed at the top; address/email/phone can be incorporated by enhancing the controller to attach `req.company` details.

Formatting:
- Currency columns use "#,##0.00;[Red]-#,##0.00".
- Header rows are styled with the ocean professional theme color (#2563EB).
- Totals use Excel formulas where applicable.

Notes:
- JSON remains the default when `format` is not provided or is `json`.
- The API returns `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment` for XLSX responses.
