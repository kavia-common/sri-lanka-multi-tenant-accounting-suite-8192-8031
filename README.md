# sri-lanka-multi-tenant-accounting-suite-8192-8031

Backend (accounting_backend)
- Express API with multi-tenant isolation, JWT auth, CRUD entities, double-entry journals, and Sri Lanka VAT scaffolding
- Uses PostgreSQL. Copy .env.example to .env and set DB credentials.

Quick start
1. cd accounting_backend
2. cp .env.example .env  # and edit values
3. npm install
4. npm run db:schema     # initialize schema
5. npm run dev
Open API docs at /docs and raw JSON at /openapi.json