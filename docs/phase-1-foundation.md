# Phase 1 — Delivery Gate

## Completed in foundation PR
- New repository baseline and CI with zero runtime dependencies.
- Separate HR Web and Employee PWA entrypoints.
- Pure business-date, geofence-evidence and attendance-intent helpers with automated tests.
- Tenant-scoped private attendance-schema SQL migration prepared, **not applied**.
- Database inventory captured without exposing messages or personal data.

## Must pass before activating a backend
- Test SQL on a separate database or disposable environment using current Supabase Postgres version.
- Validate all foreign keys and RLS with two organizations, 2 HR users and 2 employees.
- Select real employee MFA/login flow and recovery process; employee code only is prohibited.
- Implement transactionally atomic, idempotent check-in/out with server-generated time.
- Implement signed QR nonce issuing/expiry, device binding, GPS checks and audit trails.
- Configure exact Supabase data API exposure; private schema must stay private.
- Allocate backups, retention, capacity alerting and monitoring.
- Decide if public repository must become private (recommended).
- HR and payslip routes must stay disabled until role verification and authorization tests pass.

## Not yet implemented
- Operational API, RLS policies, authentication UI, real QR scanning, Smart Card Bridge,
  shift scheduling UI, leave workflows, payroll or payslips.
- Vercel deployments, live domains, Supabase schema migration or billing/IT integrations.

**Do not claim these features exist until built and verified.**
