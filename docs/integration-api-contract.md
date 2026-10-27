# External API and POS Plugin — Phase 5 contract (not deployed)

## Architecture
Attendance API is the only authority for time events, while CpiPOS and external
HR/ERP systems are explicitly optional. External organization ID and employee ID
must map to an internal Attendance UUID through per-tenant mapping records.

## Security before commercial launch
- Each integration uses OAuth 2.0 client credentials with independent scopes,
  expiry, rotation and explicit tenant binding. No Supabase service_role sharing.
- Write endpoints require an idempotency key. The public API should never trust
  a tenant ID supplied by a credential holder unless it matches the scope.
- Webhook signature `v1=HMAC_SHA256(secret, timestamp.eventId.rawBody)`.
  Timestamp tolerance 300 seconds by default; backend must persist unique event
  IDs so replay inside the tolerance window is also rejected.
- Audit auth failures, quota metering, last sync cursor, retries and disable events.
- Payroll is a separate scope and may come from a customer HR system; it is never
  presumed authoritative in both directions.

## Planned feature families
- ATT_FULL (HR Web, Employee PWA, payroll)
- ATT_EMPLOYEE (Employee PWA + HR integration)
- ATT_API (machine-to-machine attendance API)
- ATT_POS_ADDON (licensed CpiPOS integration)

This is a staged contract and pure helper code only. No external API keys,
CpiPOS addon, third-party webhooks, client provisioning or licensed feature
activation is live.
