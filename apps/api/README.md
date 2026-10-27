# Attendance API — reserved

The API must be a separate trusted execution surface and is NOT implemented in Phase 1.
Only an authenticated, tenant-scoped API may write attendance events, approve leave,
read payslips or register API clients.

Avoid exposing the `attendance` database schema in Supabase Data API.
Browser-side code must never contain `service_role` or a Supabase secret key.

Next milestone: schema test environment, auth / org membership service,
idempotent event processing, short-lived signed QR verification and integration API.
