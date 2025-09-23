# Swagger/OpenAPI Extensions

This backend serves OpenAPI via swagger-jsdoc using code annotations and a base configuration.

Added tags:
- Customers
- Vendors
- Bank Accounts
- Tax Rates
- Currencies

All endpoints under these tags require:
- Authorization: Bearer <JWT>
- Header: x-company-id (UUID)
