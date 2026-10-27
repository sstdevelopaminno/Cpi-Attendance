# Cpi Attendance API (server-only)

Vercel Node.js Functions. **Not ready for live use until audited deployment and migrations.**

- POST `/api/auth/login` — organization code + employee code + independent password, with
  HMAC-derived Supabase Auth alias and PostgreSQL account/IP-attempt limiter.
- POST `/api/attendance/qr` — authorized HR issues 30-second QR challenge.
- POST `/api/attendance/punch` — checks authenticated bearer, anti-replay,
  verified QR and registered-site GPS in database transaction.
- GET `/api/attendance/history?organization_id=<uuid>` — employee's own records.
- GET `/api/health` — clearly reports `ready: false` until production validation.

Environment variables (configure directly in Vercel settings; **never commit values**):
- `ATTENDANCE_SUPABASE_URL` — Communications Supabase URL
- `ATTENDANCE_SUPABASE_PUBLISHABLE_KEY` — publishable/anon API key
- `ATTENDANCE_SUPABASE_SERVICE_KEY` — backend-only service key for rate limit RPC
- `ATTENDANCE_AUTH_DERIVE_KEY` — random >=32-character private secret
- `ATTENDANCE_AUTH_EMAIL_DOMAIN` — verified owned email alias domain
- `ATTENDANCE_ALLOWED_ORIGINS` — exact comma-separated HR/Employee HTTPS origins

**Enrollment prerequisite:** An authorized trusted provisioning service must
create the Supabase Auth account using the same HMAC-derived alias and a strong
password, plus `attendance.employees` and `attendance.org_memberships`.
Such provisioning is intentionally NOT part of this staging PR.

The API is not an OAuth client credential gateway and is not suitable for resale
to external HR systems until M2M scopes, key rotation and webhooks are implemented.

**Security limitations:** Password login rate-limit tests are required before
production, credential recovery and abuse monitoring are still pending,
and PWA tokens are currently intended to remain only in memory.
