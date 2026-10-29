import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const html=readFileSync("apps/hr-web/index.html","utf8");
const js=readFileSync("apps/hr-web/app.js","utf8");
const qr=readFileSync("apps/hr-web/vendor/qrcode.js","utf8");
test("HR login and issuer limited by server role",()=>{
  assert.match(html,/id="hr-password"/);
  assert.match(js,/\["owner","hr_admin"\]/);
  assert.doesNotMatch(js,/\["owner","hr_admin","manager"\]/);
  assert.match(js,/attendance\/qr/);
});
test("QR is generated locally from trusted server nonce",()=>{
  assert.ok(qr.length>20000);
  assert.match(js,/qrcode\(0,"M"\)/);
  assert.match(js,/\^\[0-9a-f\]\{64\}\$/);
  assert.doesNotMatch(js,/qrserver|googleapis|quickchart/);
});
test("HR does not persist access token to web storage",()=>{
  assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie/);
});
