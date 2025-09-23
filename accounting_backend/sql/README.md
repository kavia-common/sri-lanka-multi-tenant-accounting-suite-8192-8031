# SQL Migrations

Apply in order:
- 001_init.sql
- 002_email_scheduling.sql
- 003_custom_reports.sql
- 004_master_data.sql

All tables include company_id for multi-tenancy. Ensure foreign key constraints to companies(id) exist and that application-level RLS is enforced by always filtering on company_id in queries.
