# Architecture — Cpi Attendance

## Product boundaries
- HR Web: desktop-oriented HR administration (future payroll + approvals).
- Employee PWA: self-service attendance, leave requests and payslip access.
- Attendance API: only source of truth for time events and tenant authorization.
- CpiPOS and external HR systems: optional adapters, **never** mandatory dependencies.

## Shared Supabase choice
- Target project: `CpiPOS-Communications` (`wznixoeezgyhtwurcswb`, Singapore).
- **Not** `CpiPOS-001`.
- Attendance tables use an isolated, unexposed `attendance` PostgreSQL schema.
- Existing `public.support_*` and `public.website_contact_*` are off-limits.
- Shared database still shares uptime, CPU, connection capacity, backup policy and disk quota with Communications.
- Free space *cannot* be determined from database size alone; inspect project billing/quota dashboard before production load.

## Isolation and identity
- `org_id` is mandatory on tenant-owned tables; cross-table references are composite where possible.
- `employee_id` is an internal surrogate key; national IDs should never be primary keys.
- `org_memberships` links Supabase Auth identities to roles inside organizations.
- Employee codes identify accounts but NEVER authenticate without an independent factor.
- The initial schema grants no direct anonymous/authenticated access; RLS enabled, no permissive policies.
- Expose narrowly authorized API endpoints after threat modeling and isolated DB tests. Never ship service_role to browsers.
- HR/payroll read access requires independent permission; ordinary employees can view their own records only.

## Time and geofence
- Preserve server-event `occurred_at` as timestamptz UTC.
- Assign civil work date using the employer timezone and scheduled shift, not `new Date().toISOString().slice(0,10)`.
- Events append; corrections append new audited actions, never silently overwrite time punches.
- GPS from browsers is untrusted supporting evidence. Require accuracy + company site scope + short-lived QR or device binding.
- Uncertain GPS is reviewed, not treated automatically as absence.

## Integration
- Dedicated scoped API clients per organization; short-lived tokens, rotation, throttling, audit and signed webhooks.
- In Employee-only mode, external HR remains system of record for the employee and payroll data as agreed.
- CpiPOS-IT entitlements will be a separate product family, not automatic inheritance from CpiPOS POS licensing.

## Delivery checkpoints
1. Foundation repository, automated tests and additive SQL migration **draft**.
2. Isolated DB testing, auth + RLS, employee registration and API.
3. HR Web + Employee PWA attendance proof-of-concept.
4. Leave, payroll, exports + external API, then Smart Card hardware.
5. Security review, load testing and verified production deployment.

**Change management:** a pull request is not production. Do not apply SQL to the shared Communications database until isolated migration/rollback tests and authorization review are complete.
