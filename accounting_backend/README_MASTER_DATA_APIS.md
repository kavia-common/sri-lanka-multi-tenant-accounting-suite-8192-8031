# Master Data APIs

All endpoints require:
- Authorization: Bearer <JWT>
- x-company-id: <UUID> header for tenant context

Base path: /api

Tags: Customers, Vendors, Bank Accounts, Tax Rates, Currencies

Examples:

GET /api/customers?q=acme&limit=25
GET /api/vendors?page=2
POST /api/bank-accounts
{
  "bank_name": "Commercial Bank",
  "account_name": "Main Operating",
  "account_number": "0112345678",
  "currency_code": "LKR"
}

POST /api/tax-rates
{
  "code": "VAT15",
  "name": "VAT 15%",
  "rate": 15,
  "type": "VAT"
}

POST /api/currencies
{
  "code": "LKR",
  "name": "Sri Lankan Rupee",
  "symbol": "Rs",
  "decimal_places": 2
}
