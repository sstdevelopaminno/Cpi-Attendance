# Supabase selection and inventory — 2026-10-27

Read-only inspection, project `CpiPOS-Communications`:
- Project ref: `wznixoeezgyhtwurcswb`
- Region: `ap-southeast-1`, status: `ACTIVE_HEALTHY`, PostgreSQL 17.
- Database measured size ~11 MB (12,045,459 bytes).
- Seven existing `public` tables: support conversations, messages, participants,
  attachments, call sessions, website contacts, website contact event audit.
- 0 Supabase Auth users; 0 Storage objects (1 storage bucket).
- No `attendance` or `att_private` schema and no `public.att_%` tables.
- Supabase Security Advisors report 7 informational `rls_enabled_no_policy` findings
  for current Communications tables. They are intentionally server-only per comments;
  do not grant direct browser access to resolve these informational notices.
- Current size does **not** establish available quota, pricing tier or production headroom.

Do not modify Communications tables, policies, edge functions or storage buckets
as part of the Attendance foundation.
