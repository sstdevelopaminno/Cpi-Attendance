# Android B1/B2 — dual-mode prototype v0.4
Scope: existing Zoweetek v0.3 test reader extended with distinct local user interface mode selection.
Owner-reported physical hardware: text+chip photo v0.3 succeeds. v0.4 has not been physically tested.

HR reader diagnostic: may read the owner's own chip data locally after affirmative dialog. It is still an OFFLINE TEST only.
Kiosk hardware diagnostic: permits USB/CCID/ATR tests, hides and prevents private-field reads, and check-in/out controls are disabled until subscriber HR-managed device enrollment and mode access, purchased package entitlement, signed server challenge, employee binding and protected Attendance API exist.
Native Java AttendanceAccessPolicy illustrates fail-closed role/tenant/device profile/entitlement/expiration guards; not a replacement for server-side checks.
No INTERNET permission, no Supabase connection, no saved card details, no payroll, no HR records.
Future real HR enrollment must import only selected and justified applicant fields with user notice and backend validation. Future Kiosk must never expose ID/chip photo.
Do not ship raw Thai ID full read debug UI commercially without legal/licensing/PDPA review and production signing.

Acceptance: compile + policy tests in CI, HR vs Kiosk display separation; physical Android 5-cycle test; server integration is a future stage.