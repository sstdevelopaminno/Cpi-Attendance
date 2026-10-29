import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const api=readFileSync("supabase/functions/attendance-api/index.ts","utf8");
const html=readFileSync("apps/hr-web/index.html","utf8");
const app=readFileSync("apps/hr-web/app.js","utf8");
test("IT-issued six-digit tenant code plus subscriber HR alias",()=>{
 assert.match(html,/id="hr-org-code"[^>]*pattern="\[0-9\]\{6\}"/);
 assert.match(html,/id="hr-user-code"[^>]*pattern="\[A-Za-z0-9\]\{6\}"/);
 assert.match(api,/attendance_hr_resolve_login/);
 assert.match(api,/attendance_login_context/);
 assert.match(api,/attendance_allow_login/);
 assert.match(api,/password.length<12/);
 assert.doesNotMatch(api,/password\s*===?\s*"123456"/);
 assert.doesNotMatch(html,/value="123456"/);
 assert.match(app,/รหัสองค์กร 6 หลัก/);
});
test("IT does not approve individual devices or create tenant HR passwords",()=>{
 const sql=readFileSync("supabase/migrations/20261029_attendance_six_digit_subscription.sql","utf8");
 assert.match(sql,/attendance.subscriptions/);
 assert.match(sql,/attendance.hr_login_aliases/);
 assert.match(sql,/subscription_kind/);
 assert.match(sql,/attendance_hr_package_valid/);
 assert.match(sql,/revoke all on attendance.hr_login_aliases/);
 assert.doesNotMatch(sql,/device_approval_by_it|IT_approves_device/);
 new Function(api);
});

test("Edge Auth HMAC fingerprint uses the mandatory SHA-256 hash parameters",async()=>{
 assert.match(api,/importKey\("raw",[^\n]*\{name:"HMAC",hash:"SHA-256"\},false,\["sign"\]\)/);
 const {webcrypto}=await import("node:crypto");
 const key=await webcrypto.subtle.importKey("raw",new TextEncoder().encode("synthetic server-only secret"),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const mac=await webcrypto.subtle.sign("HMAC",key,new TextEncoder().encode("test account rate limit"));
 assert.equal(mac.byteLength,32);
});
