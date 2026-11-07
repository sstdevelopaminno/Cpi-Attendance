# Cpi-Attendance — Full project audit and next implementation gate
**Audit date:** 2026-10-28 (Asia/Bangkok)  
**Scope:** GitHub main + draft branches, Vercel, Supabase Communications, Android USB reader field test.  
**Change policy:** planning-only PR; no production deployment, SQL migration, Auth enrolment, payroll, POS or CRM modification.

## Verified baseline

| Layer | Audit finding | Status |
| --- | --- | --- |
| Android Zoweetek USB-C | Owner reports five successful consecutive real-card tests on one phone/reader/card, including ATR and local masked preview. Device had enumerated as CCID `2CE3:9563`. No ID content captured in GitHub. | Hardware smoke **PASS 5/5 (user-reported)**; not certified production authentication |
| Reader code | Draft #7 contains USB/CCID test. Draft #8 builds local-only card preview on #7; CI compile + codec green at commit `45bcf956`. | Separate experimental feature; do not merge or expose personal data by default |
| Repo main | Static HR web + Employee PWA, config has empty API base; QR vendor loading optimization merged in #6. | UI skeleton only, no real attendance login |
| Foundation draft | PR #1 at `d8301f48` includes attendance API, PostgreSQL private-schema migration drafts, role isolation, QR/GPS, leave, payroll draft, integrations. Latest foundation CI green. | Not merged; CI Postgres 17 is disposable, **not** a Supabase production migration |
| Supabase | CpiPOS-Communications `wznixoeezgyhtwurcswb`, project ACTIVE_HEALTHY. `attendance` and `att_private` schemas absent; existing public support/contact tables remain. Security advisors list 7 INFO no-policy notices on intentional private server-only support tables. | Shared production **unchanged**, no attendance data live |
| Vercel | `cpi-attendance-hr` and `cpi-attendance-employee` both have READY production deployments at main `8bd79e96`. Deployment protection applies; HTTP publicly accessible content not independently confirmed. No Attendance API project active. | Static-only; do not advertise as functional HR |
| Repository | `sstdevelopaminno/Cpi-Attendance` is public, default `main`. | Review private visibility and deploy access before employee data or credentials |
| Dependencies | #2 static rollout, #3 auth/database security, #4 HR/payroll/reader/integration roadmap. | Reuse existing issues; avoid parallel rewrite |

## Product contract — one service, two sales channels

1. **POS add-on**: CRM / CpiPOS owner can open HR; mapped organization, stores, staff IDs, entitlements via explicit adapter. POS database remains source of truth for sales, **not** for attendance events.
2. **Standalone**: owner/HR creates an organization, branches and employees without POS membership; account, staff, shifts, attendance, leave and billing operate independently.
3. Both modes use the **same Attendance API and tenant-isolated schema**, with a product entitlement switch. Never copy time events into POS sales tables.

## Implementation sequence and executable acceptance

### Gate 0 — Merge hygiene / security baseline (before feature activation)
- [ ] Keep #1, #7, #8 as Draft and distinguish code-readiness from production readiness.
- [ ] Review repository visibility, GitHub branch protections, private data logging, secrets and dependency locks; select hosting compliant with commercial use before selling.
- [ ] Verify latest CI green, preserve signed/traceable APK version + SHA-256; no ID number/name/card photo in GitHub evidence.
- [ ] Read-only baseline: Supabase schema inventory and Vercel configuration; snapshot current support/contact table and app state. No production write.

### Gate 1 — Isolated schema and authorization test
- [ ] Review #1 SQL **SECURITY DEFINER** routines one by one for auth.uid(), organization/branch scope, least privilege, search_path, public EXECUTE grant, rate limits.
- [ ] Use disposable PostgreSQL/Supabase-compatible test environment (free CI only); test wrong-org employee/manager, inactive employee, forged JWT, concurrent punch, replay, QR expiry, negative GPS and rollback.
- [ ] Confirm migration is additive and touches only private `attendance` schema + explicitly named RPCs. No changes to existing Support/Communications tables.
- [ ] **Require separate approval** before any migration into shared Communications. Avoid new paid Supabase branch.

### Gate 2 — Minimum useful Standalone + POS-neutral HR
- [ ] Auth owner/HR/employee: secure invitation, password reset, recovery and optional MFA; org/staff code must not be sole authenticator.
- [ ] Organization + site + employee create/manage, role and branch scoping, disabled/departed employee flows.
- [ ] HR screen shows staff roster, manual corrections with full audit, event history; employee PWA shows own attendance and leave.
- [ ] QR rotates ~30s, server validates nonce + membership + site + rate limit; issue/consume idempotently, use server time only.
- [ ] Use organization timezone in shift/workday logic, not a fixed Asia/Bangkok timestamp for all tenants. Handle cross-midnight shifts.
- [ ] Verify Android/iOS camera, BarcodeDetector fallback, GPS permission/accuracy, denied permissions, screen-lock/network loss.
- [ ] Configure separate protected API hosting, exact CORS, publishable vs service credentials server-only; verify endpoints and 2-org end-to-end.
- [ ] Maintain **preview disabled / static-first** resource constraints where applicable.

### Gate 3 — Smart Card kiosk as optional sign-in method
- [x] One phone + Zoweetek USB-C card: owner reports 5/5 successful card tests (not remote observed).
- [ ] Keep reader as native Android **kiosk bridge**, not an untrusted web page with unrestricted WebUSB.
- [ ] Explicit employee enrolment with privacy notice; do not store full 13-digit citizen number, raw card APDU, image or ATR in database/logs.
- [ ] Prefer a revocable organization-scoped credential binding (keyed token/fingerprint server-side when necessary), not citizen ID as primary key.
- [ ] Bind device + site + employee; use authenticated device assertions, nonce/expiry and online verification, anti-replay and duplicate prevention. Card possession alone does not authenticate the holder.
- [ ] Test unplug/replug, USB permission denial, stale session, card removed mid-read, duplicate taps, offline behavior, 5+ repeat cycles, Android models.
- [ ] Check legal, licensing and privacy basis for commercial Thai ID chip access **before** shipping this module. Offline diagnostic success does not authorize commercialization.

### Gate 4 — Commercialization / optional POS adapter
- [ ] CpiPOS/CRM staff mapping, store-scoped roles, tenant entitlements, subscription expiry, suspension and safe tenant unlink.
- [ ] Standalone onboarding and subscription activation without POS dependency.
- [ ] HR policy schedules, leave balances, overtime, exports and audit. Payroll/payslips only after separate accounting/legal validation and access review.
- [ ] Backup restore drill, load/stress, incident playbook, retention/deletion, monitoring and disaster recovery.
- [ ] Full UAT: two unrelated organizations and two branches each, two HR users, 10+ employees, different shifts, user-disabled flow, QR and kiosk.

## Immediate next development package (no production changes)

1. **Back-end hardening PR** based on #1: normalize migrations, auth/RPC privilege audit, negative integration tests; ensure it rebases cleanly onto `main` without regressing the QR lazy-load fix (#6).
2. **Front-end HR/employee integration PR** after Gate 1: tenant and branch admin UI, invites, event review, error states, Android/iOS QR scan.
3. **Android Kiosk contract PR** after Gate 2: separate hardware bridge and revocable scoped employee card enrollment; keep experimental Thai ID read in draft #8 until legal review.
4. **POS add-on adapter PR** after Standalone end-to-end acceptance. No forced POS dependency.

## Safety decisions
- This audit **does not** merge Draft PRs; it **does not** create live tables, apply migrations, set secrets, deploy a new API, charge a cloud service, or expose employee/card data.
- Success criteria for opening to customers: reviewed Auth + tenant isolation, protected API + migration, on-device tests, data/retention controls, commercial hosting and lawful card integration.
