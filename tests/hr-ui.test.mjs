import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const html=readFileSync("apps/hr-web/index.html","utf8");
const js=readFileSync("apps/hr-web/app.js","utf8");
const css=readFileSync("apps/hr-web/office.css","utf8");
test("HR Office has dashboard, recruitment, confirmed employees and restricted Android settings",()=>{
 for(const name of ["screen-dashboard","screen-applicants","screen-applicant-detail","screen-employees","screen-settings","applicant-dialog","detail-approve","detail-print","detail-delete","language","hr-login-form"])
   assert.match(html,new RegExp('id="'+name+'"'));
 for(const m of ["employees","new","leave","absent","late","ot","salary","otPaid","advances"])
   assert.match(html,new RegExp('data-metric="'+m+'"'));
 assert.match(html,/cpi-mark\.webp/);
 assert.match(html,/name="national_id"/);
 assert.match(html,/name="photo"/);
});
test("HR Office is bilingual and does not inject untrusted applicant HTML",()=>{
 assert.match(js,/th:\{/);assert.match(js,/en:\{/);
 assert.match(js,/textContent/);
 assert.doesNotMatch(js,/innerHTML|document\.write\(/);
 assert.match(css,/@media print/);
 assert.match(css,/\.ribbon/);
});
test("HR Office respects role/tenant boundaries and refuses raw card upload",()=>{
 assert.match(js,/\["owner","hr_admin"\]/);
 assert.doesNotMatch(js,/\["owner","hr_admin","manager"\]/);
 assert.match(js,/api\/hr\/applications/);
 assert.match(js,/consent_confirmed:true/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie/);
 assert.doesNotMatch(js,/SUPABASE_SERVICE_KEY|service_role/);
 assert.doesNotMatch(js,/JSON\.stringify\(data\.extra\)/);
});
test("Office Javascript parses and native card control is disabled before device pairing",()=>{
 new Function(js);
 assert.match(html,/id="read-card"[^>]*type="button"/);
 assert.match(readFileSync("apps/hr-web/reader-link.js","utf8"),/if\(!signedIn\(\)\)/);
 assert.match(js,/signedIn\(\)/);
 assert.match(js,/confirmed|confirmApprove/);
});

test("Confirmed employee screen separates pending probation and needs audited API transition",()=>{
 assert.match(html,/id="probation-rows"/);
 assert.match(html,/id="employee-rows"/);
 assert.match(js,/probation_status==="confirmed"/);
 assert.match(js,/api\/hr\/employees\/confirm/);
 assert.match(js,/confirmProbationQuestion/);
 assert.doesNotMatch(js,/S\.localDrafts\.filter\(x=>x\.status==="approved"\)\)rows\.push/);
});

test("Tenant HR—not platform IT—owns Android devices and mode settings",()=>{
 assert.match(html,/เจ้าขององค์กร\/HR Admin จัดการเครื่อง Android/);
 assert.match(js,/Subscriber Owner\/HR Admin configures Android devices/);
 assert.doesNotMatch(html,/รอเปิดสิทธิ์จาก IT|รอ IT อนุมัติอุปกรณ์/);
 assert.doesNotMatch(js,/IT-controlled device pairing|IT activation required/);
 assert.match(js,/Tenant HR setup not yet active/);
});

test("New HR sidebar collapses and sensitive reader card flow has offline safety",()=>{
 const reader=readFileSync("apps/hr-web/reader-link.js","utf8");
 new Function(reader);
 assert.match(html,/id="sidebar-toggle"/);
 assert.match(html,/id="card-dialog"/);
 assert.match(html,/id="reader-session"/);
 assert.match(html,/id="preview-card"/);
 assert.match(html,/name="thai_prefix"/);
 assert.match(html,/name="issuer"/);
 assert.match(html,/reader-link.js/);
 assert.match(css,/sidebar-collapsed/);
 assert.match(css,/\.nav-symbol svg/);
 assert.match(reader,/crypto\.subtle\.generateKey/);
 assert.match(reader,/RSA-OAEP/);
 assert.match(reader,/AES-GCM/);
 assert.match(reader,/signedIn\(\)/);
 assert.doesNotMatch(reader,/innerHTML|localStorage|sessionStorage/);
});
