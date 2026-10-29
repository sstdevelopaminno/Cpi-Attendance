# A2 — HR roster and recruitment stage

Adds scoped HR read/write RPCs and server routes, **not deployed**. Only authorized `owner` and `hr_admin` with active membership in the exact organization can read or submit applicants, approve employees, or read the employee roster. Branch managers are held back until branch-specific authorizations are implemented.

Employee creation after approval is a registry entry with `auth_user_id = null`. Account invitation, password reset and employee login provisioning are a separate guarded task. Prevent treating approval as login activation.

PII minimization: only a voluntarily provided applicant name and consent confirmation, never full Thai citizen ID, card JPEG or chip APDU. `source` identifies data entry channel and does not grant Android device privilege by itself. Neither Android APK nor outside HR API is authorized to invoke this until the IT entitlement and device-binding gates pass.

Proposed migration: `supabase/migrations/20261029_attendance_hr_recruitment_draft.sql`. It extends private schema `attendance` in ephemeral CI only. Do not run on shared Supabase `CpiPOS-Communications` without separate acceptance. Existing `public` support/contact tables unaffected.

Acceptance: unauthorized roles and org B denied, same-key same-data safe replay, modified payload with reused key rejected, HR-only approve, wrong org rejected, approved employee does not gain login automatically, private tables unreadable by authenticated role.
