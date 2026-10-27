import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const required = [
  "apps/hr-web/index.html", "apps/employee-pwa/index.html",
  "apps/employee-pwa/manifest.webmanifest",
  "packages/core/src/attendance-policy.mjs",
  "supabase/migrations/20261027_attendance_core_initial.sql",
  "docs/architecture.md", "docs/supabase-audit-20261027.md"
];
for (const path of required) assert.ok(existsSync(path), `missing ${path}`);
const sql=readFileSync(required[4],"utf8");
assert.match(sql,/create schema if not exists attendance/i);
assert.match(sql,/revoke all on schema attendance from public, anon, authenticated/i);
assert.match(sql,/enable row level security/ig);
assert.doesNotMatch(sql,/drop\s+(table|schema)|truncate\s+|delete\s+from\s+public\./i);
const manifest=JSON.parse(readFileSync(required[2],"utf8"));
assert.equal(manifest.name,"Cpi Attendance Employee");
assert.equal(manifest.start_url,"./");
console.log("Foundation checks passed; no database migration was executed.");
