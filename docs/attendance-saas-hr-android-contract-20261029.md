# Cpi-Attendance — SaaS product contract & implementation order (HR Web + Android first)

**Decision date:** 2026-10-29  
**Status:** Architecture and delivery plan; no production migration, billing activation, client data import, APK release or CpiPOS-IT writes approved by this document.

## 0. Product decision

One tenant-isolated Attendance service with optional interfaces. The platform IT system is the **authoritative licensing and provisioning control plane**, not the holder of routine employee records.

- **Part A: HR Web** — `https://cpi-attendance-hr.vercel.app/` is the HR administration workspace. Intended for desktop, tablet and iPad browsers. It owns people/branch configuration, recruiting, authorization, enrollment approval, shifts/attendance/leave/audit and restricted payroll screens.
- **Part B: Android Native Zoweetek** — a **single signed Android app, two independently authorized operating modes**: `HR_ENROLLMENT` and `EMPLOYEE_KIOSK`. Physical smart-card I/O runs natively; the API owns changes. Device/operator is not trusted merely because a card reads.
- **Part C: Employee PWA** — self check-in/out via short-lived site QR + GPS/geofence, personal shifts, time entries, leave, payroll/payslips only for the employee and only when provisioned.
- **Part D: POS add-on** — CpiPOS / CRM staff mapping, optional manager/owner menu and limits scoped by IT entitlements.
- **Part E: External HR API** — no HR Web required. Customer can license Android HR capture + kiosks + Employee PWA with externally hosted HR, with per-tenant API read/write scopes and webhooks.

**Build order:** 1) HR Web management + secure backend contracts, 2) Android HR mode + Android Kiosk mode, 3) Employee PWA integration, 4) POS adapter & external HR bridge, 5) expanded payroll, Windows HR and richer offline sync.

## 1. Confirmed baseline

- Main branch currently contains static HR Web and Employee PWA. Live site builds are READY but `config.js` keeps the API disabled. Draft [#10](../pull/10) introduces the redesigned HR console and employee mobile QR shell.
- Draft [#1](../pull/1) contains private Attendance schema migrations, API and SQL/Node tests only, not live Communications migration.
- Android Zoweetek USB-C v0.2 and v0.3 were physically tested by the owner. Owner reports five passes for v0.2 and successful full text/photo preview on v0.3. Draft [#11](../pull/11) holds experimental **offline** owner-only card data/photo preview; not a production HR app.
- Windows diagnostic [#12](../pull/12) is separate. Windows HR is not the first priority in this milestone.
- Supabase target `CpiPOS-Communications` `wznixoeezgyhtwurcswb` is ACTIVE_HEALTHY and **does not yet have an attendance schema**. Do not touch unrelated support/contact tables.
- CpIPOS-IT already has package catalog, package versions, tenant management, features and devices. Its POS control plane is a different trust domain; do not ship IT credentials into the Attendance app.

## 2. Phase A — HR Web: begin here

### Navigation / roles
- `Overview`: today in/out, staff on shift, exceptions, pending approvals and sync/device status. All figures from verified API, never fabricated.
- `Organizations & branches`: legal entity, office, timezone, geofence, site identifiers, quota view.
- `Recruitment`: application, consent/privacy notice, document access review, approve/reject; onboarding into employee registry after an explicit HR decision.
- `Employees`: unique internal employee ID, employment status, assigned branches, device/card enrollment status; invitation and reset flow.
- `Time attendance & schedules`: shift setup, break, lateness, cross-midnight, missed punch reconciliation, HR edits with immutable audit.
- `Kiosk & QR`: authorized devices, site mapping, 30-second QR issuance, disable/rotate, anomaly review and duplicate prevention.
- `Leave/approval`: request queue, approval rules, history.
- `Payroll/payslips`: role-segregated; not enabled until legal/accounting and document-storage review.
- `Integrations`: POS mapping and third-party API only when entitlement allows.
- `Settings/audit`: tenant roles, branches, password/recovery, exports, retention requests.

**Role boundary:** owner and HR-admin manage HR within licensed org scope; manager is branch-scoped; payroll staff can view only payroll modules; employee sees own data. **IT Admin controls licensing/devices/technical support, not unfettered access to personal HR records**.

### Phase A acceptance
1. Organization can be created/activated by IT with admin invitation; both active and suspended tenant tests.
2. Two organizations (two branches each) cannot read or change each other's employees, applications, devices or time events.
3. HR enrolls candidate -> reviews -> creates employee; no automatic copy of entire ID-chip payload or photo.
4. Device registration/approval and card binding have audit records; failed attempts and revoked card/device are denied.
5. HR sees true incoming mobile events and can review/correct with reason and audit.
6. Browser/tablet/iPad UI usable with keyboard and touch, error/empty/loading states; protected endpoints tested.
7. No production switch before schema + Auth + roles, legal basis, backups and commercial hosting approval.

## 3. Phase B — Android Native: single APK, two strict modes

### Mode 1: `HR_ENROLLMENT` (authorized HR only)
- HR signs in; app checks `ATT_HR_ANDROID` entitlement, employee role and registered device; picks tenant/branch.
- Searches Zoweetek USB/CCID device, obtains Android USB permission; verifies ATR and chip read.
- **For recruiting/employee onboarding**, shows a separate confirmation of purpose/notice and user chooses which fields to import. Core fields: Thai/English name, basic details and optional picture only if lawfully justified. Full raw chip photo, full citizen ID and chip payload are **never automatically sent** to Supabase.
- HR reviews fields, can correct errors, submits candidate or enrollment API with idempotency key; approval establishes internal employee UUID.
- Card sign-in association is revocable, explicitly authorized and audit-logged. Employee ID is **not** the national ID.
- Never use a test-mode private-card reader with unlimited raw-field exposure as production onboarding; license/regulatory security review is a gate.

### Mode 2: `EMPLOYEE_KIOSK` (shared unattended device)
- IT/HR pairs kiosk to org + specific site; separate `ATT_KIOSK` entitlement, device certificate/key, signed nonce and remote suspension.
- App locks into kiosk profile; no HR recruitment, candidate list, raw card number, photo or debug APDUs visible to employees.
- Employee inserts chip; backend resolves an approved **opaque card binding** to employee UUID; attendance action check-in/check-out is presented; require policy-defined additional verification (e.g., PIN or supervised challenge), because possession of card alone is not identity proof.
- Sends `organization_id, site_id, device_id, employee_binding, event_type, idempotency_key, attestation/proof, observed_at` to attendance API. Server verifies authenticated device, organization, expiry, site, card state and sequence, then stores server time + event outcome/audit.
- Duplicate insert, same-action repeat, time reversal, invalid card, removed chip, revoked card/device and network loss have explicit states.
- For first online MVP: only show 'ลงเวลาสำเร็จ' when server acknowledged. Optional offline queue must be encrypted and labeled 'รอซิงก์'; reconcile trusted time and check entitlement grace before acceptance.

### Phase B acceptance
1. Zoweetek compatible Android reader still passes USB/CCID/ATR after production refactor.
2. HR can register a candidate, submit only selected fields, and see it appear in authorized HR Web (no PII in logs).
3. Kiosk employees can check-in/out at authorized site without opening HR controls.
4. Two-org and cross-site card/device spoofing rejected; suspended organization/device cannot record new confirmed punches.
5. API idempotency, replay, concurrent submissions and offline/reconnect outcomes verified.
6. Two physical Android devices: one HR, one kiosk; repeat, unplug, permission deny, reconnect and card removal testing.
7. Release only signed APK with provenance/SHA-256 via controlled channel; do not publish test debug raw-field UI as customer release.

## 4. Data/API contract

Single trusted API gateway; never write directly from APK/browser to private tenant tables with service-role credentials.

**Draft endpoint groups (not live):**
- `/v1/orgs/.../applications` — create/review recruitment applicants, minimal fields and approval.
- `/v1/orgs/.../employees` — employee roster, internal IDs, organization/branch membership.
- `/v1/devices/enroll|revoke` — device pairing/revocation with HR/IT authorization.
- `/v1/card-bindings/enroll|revoke|resolve` — tokenized card association; no raw APDU/photo.
- `/v1/attendance/check-in|check-out|history` — server-side time event validation, atomic idempotency and audit.
- `/v1/integrations/external/... ` — separately metered tenant-scoped API and signed webhooks.

Schema draft groups: `organizations`, `sites`, `org_memberships`, `employees`, `applications`, `device_registrations`, `card_bindings`, `time_events`, `shift_assignments`, `leave_requests`, `audit_entries`, `integration_clients`, `entitlement_snapshots`. Schema is **proposed**, not created.

Use Supabase Auth and strict organization/branch authorization. Keep `attendance` schema private; expose narrow audited RPCs/server endpoints only. Privileged `SECURITY DEFINER` functions must be audited for caller, grants, scope, search_path and replay.

## 5. IT as the only licensing/entitlement issuer

**Product family:** `CPI_ATTENDANCE` as a separate family from existing POS subscriptions. IT already has package, feature, tenant and device management; extend existing control plane rather than duplicating it.

**Independent modules:**
- `ATT_HR_WEB`: HR web UI
- `ATT_HR_ANDROID`: Android HR recruiting/card capture
- `ATT_KIOSK`: employee card-punch Kiosk on Android
- `ATT_EMPLOYEE_PWA`: personal QR + GPS/leave/history
- `ATT_PAYROLL`: payroll/payslip (restricted future module)
- `ATT_EXTERNAL_API`: third-party system integration, scoped tokens/webhooks
- `ATT_POS_ADDON`: CpiPOS/CRM integration

**Package presets, subject to IT-defined pricing/terms:**
- Standalone HR: `ATT_HR_WEB + ATT_HR_ANDROID + ATT_EMPLOYEE_PWA` (Kiosk add-on).
- Android & External HR: `ATT_HR_ANDROID + ATT_KIOSK + ATT_EMPLOYEE_PWA + ATT_EXTERNAL_API`, **HR Web OFF**.
- POS Add-on: `ATT_POS_ADDON` and selected modules.
- Custom Contract: any combination with defined quotas, data retention and SLA.

**IT controls:** term/trial/end date, billing status, seat/branch/device limits, API scopes and rate quota, add-ons, device pairing, activation, suspension, renewal, audit, custom price. No price values are fixed in this document.

IT issues signed or authenticated entitlement snapshots to Attendance backend; backend validates scopes **on every sensitive request** and caches bounded expiry. HR app **cannot self-upgrade features or change package quotas**. Employees must still be able to access lawful record/export channels under an expired contract policy; avoid sudden destructive data deletion.

**External HR contract:** API-only customer can omit HR Web, while keeping HR-enabled Android and Employee PWA. External payroll information/payslips must be supplied through a separately authorized integration if Employee PWA is expected to show pay data; do not assume it exists in Attendance DB. OAuth2/M2M tenant scope, least privilege, rate limits, rotation, idempotency and signed webhooks required.

## 6. Security, privacy and commercial gates

- Thai citizen card: do not use DOPA restricted software/services commercially without verified authorization. Verify third-party chip protocol use, licensing, privacy notice, minimum fields and retention before selling smart-card enrollment.
- Per-person data vs enrollment: special test APK full-field/photo read succeeded according to owner, **but production must be minimal-by-default and not upload full ID/photos indiscriminately**. Encrypted private object storage only where expressly justified, with access review and retention.
- Employee card check-in cannot rely solely on a chip ID or image; add kiosk device trust and anti-impersonation control.
- Multi-tenant tests, protected API, security-advisor review, credential hygiene, signed APK, SAST/dependency scans and disaster recovery before sellable launch.
- Current Vercel Hobby hosting is for development/prototype. Validate commercial hosting rights and quota before offering subscription service.
- Windows PC/SC remains a compatible future card reader, but Windows HR desktop app is **not required** for Phase A/B.

## 7. Concrete next PR work packages

**A1 (first):** Stage HR Web feature map / menu / permission matrix on top of Draft #10. Implement auth-safe organization/branch/employee/applicant page shells, audit/empty/error states without fake data.

**A2 (prerequisite before live API):** Review Draft #1 RLS and RPC privileges, test two-tenant migration/auth in isolated Supabase-compatible environment, add provisioning and role-scoped endpoints. Production Communications schema remains untouched until separately approved.

**B1 (next):** Refactor the successful Zoweetek v0.3 proof into Android app `HR_ENROLLMENT` mode: session, role/entitlement guard, selected-field review, API submission preview with a mock/staging backend first.

**B2 (next):** Build physically separate `EMPLOYEE_KIOSK` mode with device activation, card binding, check-in/out states and online idempotent API. Hardware-specific app remains separate from HR Web.

**C (after A+B E2E):** Activate Employee PWA QR/GPS/leave/history and payroll placeholders only as entitled; then POS/external HR integrations and optional Windows HR offline client.

### Non-negotiable merge/deploy boundary
Document and UI changes can be prepared in Draft PRs. Do **not** merge the experimental full-card reader into customer HR, enable IT billing, expose full national ID/photo, deploy functioning employee access, or migrate shared Supabase without isolated tests, legal review and explicit production authorization.
