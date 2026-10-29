# Work C — External HR / CpiPOS integration stage

IT issues ATT_EXTERNAL_API authorization. Organizations may omit HR Web and license Android HR, Android Kiosk, Employee PWA and a scoped external HR integration independently.

Developed:
- A pure trusted server-side grant validation model for organization, scope, expiry, revocation and feature entitlement.
- A strict outbound attendance event allow-list preventing accidental export of unapproved source fields.
- Node regression tests for the external grant scope and tenant boundaries.
- Existing webhook signing helper remains in packages/integration/src/webhooks.mjs.

Important: only authenticated backend code may look up verified grants from IT. A customer-supplied grant object is never trusted authorization.

Not yet implemented: OAuth2 client management, IT credential issuance, paid API subscriptions, live external API endpoints, webhook delivery worker/retry, POS staff mapping, external payroll import and data export approval.

Production requirements: scoped access token rotation, idempotency/replay, audit, quotas and retention, cross-organization security, consent/privacy and business/legal sign-off.
