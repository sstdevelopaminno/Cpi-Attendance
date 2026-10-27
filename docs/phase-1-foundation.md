# Phase 1–2 — Implementation checkpoints and guards

## Prepared in GitHub
- HR Web and Employee PWA static screens, currently disabled unless a trusted API is configured.
- Browser Employee sign-in, personal attendance history and BarcodeDetector camera/GPS flow (browser support varies).
- HR sign-in, authorized office-site selection and rotating QR display through vendored MIT-licensed QR generator.
- Node attendance API: health, login, sites, QR issue, punch, history.
- Supabase PostgreSQL private `attendance` schema, transactionally safe idempotent punches, geofence validation, short-lived QR, login rate limit and authenticated organizational context.
- Automated Node and disposable PostgreSQL 17 tests.

## NOT live or complete
- No migrations applied to shared `CpiPOS-Communications`.
- No employee/HR Auth accounts provisioned; login backend requires secrets never in Git.
- No Vercel project deployed (Vercel create operation forbidden by connected account).
- No mobile physical QR test, no Smart Card Reader Bridge and no attendance hardware.
- No leave approvals, full scheduling UI, payroll/payslip, external API tokens, CpIPOS integration or IT package entitlement.

## Before production
1. Make repository private and protect `main`, as appropriate.
2. Review all SECURITY DEFINER functions, grants and rate limiting.
3. Test migrations with exact Supabase settings in a dedicated isolated environment; CI PostgreSQL simulates Supabase Auth.
4. Create trusted company/HR/employee provisioning and credential reset/MFA.
5. Configure actual team-owned Vercel deployments + exact CORS, and *secret values only in the Vercel backend environment*.
6. Test employee auth, QR/nonce and GPS on real Android/iPhone and kiosk, including geolocation spoofing limitations.
7. Provide tenant-specific backup, legal privacy/retention and payroll reviews.
8. Only then approve additive migration to Communications, followed by live API activation.

More: [Roadmap](roadmap-phases-1-5.md).
