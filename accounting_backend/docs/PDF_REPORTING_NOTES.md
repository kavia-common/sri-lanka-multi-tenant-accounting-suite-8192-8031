# PDF Reporting Notes (Backend)

- Service: src/services/PdfService.js
  - PUBLIC_INTERFACE
    - createDocument(res, { fileName })
    - drawHeader(doc, company, { reportTitle, periodText?, comparativeText? })
    - section(doc, title)
    - keyValues(doc, rows: [{ label, value }])
    - totalsRow(doc, { label, values: [{ amount }] })
    - table(doc, { columns: [{ key, title, width, align? }], data })

- Controllers:
  - src/controllers/sriLankaCompliance.js: Each action supports `?format=pdf` to stream a PDF, otherwise returns JSON as before.

- Branding:
  - Company data fetched from DB using companyId: name, address, email, phone, tax_number.
  - Layout aims for clean, modern style inline with Ocean Professional theme colors.

- Environment:
  - SL_CORP_TAX_RATE used by the income tax schedule (default 0.30). See .env.example.

- Future:
  - Extend PdfService with re-usable table with header/footer, pagination-aware calculations, and numeric formatting.
  - Add logo embedding by providing a path or binary and drawing with doc.image().
