# Cpi Attendance — Phase 1–5 delivery roadmap

Date: 2026-10-27. Scope: Cpi Attendance repository only. CRM/POS and CpiPOS-IT remain unchanged.

## Phase 1 — Database and repository isolation
Delivered as PR: isolated `attendance` PostgreSQL schema draft; organization/employee/site/shift/event/leave/audit models; all sensitive tables privately scoped and RLS enabled; Node tests; PostgreSQL 17 disposable CI.
Remaining: actual Supabase Communications migration (intentionally not applied), live credentials/monitoring and storage retention.

## Phase 2 — Secure login, HR kiosk, QR/GPS punch
Staged as code: Supabase Auth alias + password gateway, rate-limit RPC, organizational membership validation, HR QR issue (30-second random nonce, SHA-256 hash stored), role-scoped site selector, browser QR scanner using BarcodeDetector, GPS on-demand, idempotent DB transaction and employee self-history.
Verified: disposable Postgres two-organization tests, role isolation, GPS rejection, idempotent retry.
Blocked before live: authorized employee/HR provisioning, production CORS and email-domain config, browser/device E2E, recovery/MFA, negative rate-limit tests on real Supabase, approved database migration.

## Phase 3 — Leave, shifts, time rules
Pending: shift calendar/assignments, cross-midnight work-day pairing, late/absence/overtime rules per employer, leave balances/approval escalation, leave attachments, HR correction requests and auditable historical policies.
Gate: tests with multiple shifts, overtime exceptions, holidays and two organization roles.

## Phase 4 — Payroll and payslip
Pending: approved week/biweekly/month payroll periods, deduction rules, paid leave, payroll run draft/review/approve/finalize, locked historical payslips, secure private PDF delivery, data retention and export.
Gate: payroll accountant sign-off and jurisdiction-specific legal/rate validation. No auto-bank transfer without explicit separate specification.

## Phase 5 — Hardware, external API and CpiPOS/IT licensing
Pending: Smart Card Kiosk bridge with tested Android/Windows drivers, external HR OAuth2 M2M, scoped API access, signed webhooks, retries, mapping, CpiPOS adapter, standalone Attendance contracts in CpIPOS-IT, provisioning/billing lifecycle, audit/SLA/load tests.
Gate: physical hardware tests, external tenant API isolation and live IT billing parity.

## Deployment gate
- Target Supabase: **CpiPOS-Communications** (project ref `wznixoeezgyhtwurcswb`), never CpiPOS-001.
- Vercel target team: `sstdevelopaminnos-projects` (Hobby).
- Vercel API create project was denied **403 forbidden** on 2026-10-27. Two projects requested:
  - `cpi-attendance-hr` root `apps/hr-web`, framework Other/static
  - `cpi-attendance-employee` root `apps/employee-pwa`, framework Other/static
- A separate server-only API project root `apps/api` is required after backend audit; no real login or attendance is live yet.
- Do not point DNS/production domains until privileges, secrets and migrations are verified. Static pages deliberately disable login without verified HTTPS API configuration.
- New repository is Public; recommend Private before payroll and customer-specific integration work.
