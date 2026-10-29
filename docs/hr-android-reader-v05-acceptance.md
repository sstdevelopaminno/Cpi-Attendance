# Cpi Attendance — HR Reader handoff v0.5 test plan (2026-10-29)

## Product requirement
**Subscriber Owner/HR Admin** controls recruitment, Android/Windows devices, mode choices and site permissions. CpIPOS-IT sells/enables Attendance packages and provides support only; no per-device approval or operational access.

## UI scope implemented
- SVG HR menu icons and reversible sidebar collapse (desktop 260px ↔ 78px; mobile navigation hides/reappears).
- Thai/English labels for Thailand ID-card fields, including Thai/English prefixes, full names, 13-digit citizen ID, date of birth, sex, registered address, issuer, issue/expiry dates and photo.
- Applicant 'ดูข้อมูลแบบบัตร' displays a **generic stylized layout**. It is not an official identity card replica and includes no data from user-supplied example photos. Full ID is masked in this preview; the form data remain editable by HR.
- Reader progress statuses: waiting, online/paired, chip reading, received. Browser session has ephemeral RSA-OAEP private key and decrypts encrypted data for *local form review only*.
- On save, the current recruitment API accepts only applicant name plus privacy-notice confirmation; raw ID, full address and JPEG must **not** be added to the existing API automatically.

## How pairing is intended to work
1. Subscriber HR signs in on HR Web. 'เพิ่มผู้สมัครใหม่' → 'เชื่อมต่อ Android HR' creates a random 128-bit one-use code valid for five minutes, and a one-session public key.
2. Android Reader v0.5 does **not** ask for an HR account or password. Enter official Attendance API HTTPS base URL and the HR-generated code (a future QR scan / pre-paired device UI can make this easier).
3. Android shows green only after server claim succeeds. When inserted chip responds, the operator confirms applicant purpose/permission. Existing Zoweetek CCID reader reads Thai-card data and JPEG with a progress state.
4. On Android, JSON payload is AES-256-GCM encrypted; AES key RSA-OAEP SHA-256-wrapped for the browser's public key. Backend only stores ciphertext for the short-lived session and does not know the HR browser's private key.
5. HR browser polls its **own** org/session; decrypts locally, populates editable fields, previews the card/photo and manually saves only currently supported minimum fields; browser cancels/consumes handoff.
6. Session data expires; cleanup needs a scheduled, audited service job before production. No real staff records or card images should be used until the complete server and privacy checklist is signed off.

## Verified to date
- GitHub Actions Node/static UI tests, API request mock tests and disposable PostgreSQL cross-tenant/replay/ciphertext cleanup tests.
- Android v0.5 debug APK compiles with Android SDK 35 and Java 17.
- **NOT verified**: real Auth/PostgREST/tenant entitlements, remote API deployment, live Android ↔ HR transfer, official identity/photo storage, physical v0.5 five-cycle test or production Thai-ID commercial compliance.

## Required readiness gates before Production
- Create separate Attendance API deployment and connect it only after Auth, service-role server-only secret, TLS CORS allowlist and environment controls are reviewed. HR site's current `window.CPI_ATTENDANCE_API_BASE` is intentionally blank.
- Review migrations, Auth/RLS, package entitlement and tenant-bound pairing in isolated Supabase staging. Communications Production currently contains no Attendance schema. **Never run these draft migrations there without full review**.
- Introduce source-IP rate limits for claim endpoint, abusive traffic monitoring, cleanup job for expired encrypted envelopes, short-lived device pairing audit and backend quotas from purchased plan. HR can self-pair without IT approval.
- Verify end-to-end using synthetic identities first. Only thereafter use a consented volunteer's card on a real Android device; never put real citizen numbers or card photos in GitHub logs, test artifacts, or public images.
- Review lawful basis, notice, sensitive attributes, photo retention, printing permissions, commercial chip-access licensing and restricted correction/erasure procedures.
- **No Vercel Preview** per product owner. After full acceptance, deploy directly to authorized HR and API Production targets, then verify readiness.

## Status
The two implementation PRs are **Draft**, not yet merged or released to Production. Do not market the test APK as an authorized identity-verification product.
