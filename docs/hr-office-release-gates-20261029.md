# Cpi Attendance HR Office — Implementation and release gates (2026-10-29)

## Implemented in Draft PR #17
- New polished desktop/tablet/mobile HR Office with transparent Cutting Point Innovation symbol centered in the left brand area.
- Thai and English language switch, labels and status messages.
- Dashboard: total employees, new employees this month, approved leave for today and seven-day checked-in/out trend from a tenant-scoped authenticated RPC. Absence, lateness, OT, payroll, OT payout and advances are deliberately unknown until validated shifts/payroll ledgers exist.
- New Applicants: searchable table, source/status/date, individual detail/back, two-section applicant dialog, print with signature spaces, local preview, diagonal green approved mark.
- Confirmed Employees roster from authorized employee RPC.
- Android Mode Settings view, explaining HR vs Kiosk device-bound authorization (no plain-text mode passwords).
- Browser never uploads raw citizen ID, photo, full address or raw APDU to the existing minimal applicant API. The photo preview is ephemeral and held in browser memory; no localStorage, analytics or persistent cache.
- Server-side source guard: POST /api/hr/applications with source android_hr now returns 403 until trusted IT-signed device-mode grants exist.

## Work still required to meet full business specification
1. **Approved applicant records / probation semantics:** IMPLEMENTED IN DRAFT: recruitment approval creates an employee with `probation_status=pending`, while HR Owner/Admin separately confirms probation through an audited, tenant-restricted endpoint; the UI has two tables. Still requires HR acceptance of probation dates and formal employment terms.
2. **Complete HR applicant profile persistence:** separately approved minimal data fields with encrypted restricted storage, explicit access policy, retention, versioned amendments and audit; do not store all chip fields by default.
3. **Application deletion:** authenticated HR soft-delete/reason audit; reject unaudited hard-delete. Locked approvals require correction request instead of editing in place.
4. **Applicant photo and Thai ID card:** obtain commercial permission/legal review; separate lawful purpose/privacy notice and policy. Store photo only where specifically justified, in private encrypted object storage, with signed short-lived access, deletion policy and HR-only audit.
5. **Android HR import:** user must log in with valid Supabase Auth, IT-granted ATT_HR_ANDROID feature and paired-device cryptographic challenge. Review fields on-device and transmit **only selected minimally necessary data**. The kiosk mode must not expose chip data/photo.
6. **Android mode access in HR settings:** HR may request/pair an IT-approved device for HR_ENROLLMENT or EMPLOYEE_KIOSK. IT is entitlement issuer. No reusable shared passcodes in source/browser/APK; use individual HR login and server-issued time-limited/device-scoped mode credential with rate limiting, revocation and audit.
7. **End-to-end staging:** separate tenant Auth/users and branch scopes; run actual Supabase Auth/PostgREST/RLS E2E before any Production DB changes. Current disposable PostgreSQL CI green is necessary but insufficient.
8. **Payroll metrics:** only show verified values from a contractual payroll ledger, with Payroll-role restriction and currency precision. Avoid deriving 'paid' salary from check-in events.
9. **Deployment:** existing HR Vercel project returned 403 on attempted preview deployment. Permission must be resolved with project owner before deployment; no override or redeploy attempted. Production cpi-attendance-hr.vercel.app remains on older UI.
10. **Acceptance:** responsive Thai/English UI, keyboard accessibility, print, search, status, back navigation, identity/PII security, two-org isolation, role and device revocation; original owner should test UI before merge/release.

## Why disabled behavior matters
The original offline Android v0.3 full-card reader was a successful physical diagnostic with the owner's own chip, not a production applicant upload permission. It is intentionally separate from this HR API. Only after approval and identity/access design can a signed, IT-licensed Android build submit minimal fields to an authorized org endpoint.

## Production-only release policy
- **No Vercel Preview** for this project unless the user changes direction. Do not create preview deployments to test or work around permissions.
- **Release criterion:** a reviewed exact commit with green Node, static UI and disposable Postgres integration CI; explicit business acceptance; verified real Supabase Auth/organization tests; scoped Android device enrollment; remaining applicant PII policy; confirmed production team/project deployment permission.
- Only at this readiness gate, create **one Production** deployment for Vercel project `cpi-attendance-hr` owned by team `sstdevelopaminnos-projects`. Verify release commit and production URL after deployment. Do not apply Supabase migrations ad hoc from the HR web deployment.
- If Vercel continues to return 403 or the deploy cannot be verified READY, keep existing production unchanged and report the blocker; do not bypass team permissions.

## Delivery plan
A1 UI staged: complete in Draft PR #17.
A2 restricted aggregate API and security regressions: complete in synthetic CI, not migrated live.
Android HR: next dedicated PR after IT device grants.
Windows Smart Card and Kiosk: unchanged.
