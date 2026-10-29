import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const roots=["hr-web","employee-pwa"];
for(const site of roots){
 const prefix="apps/"+site+"/";
 const html=readFileSync(prefix+"index.html","utf8");
 const app=readFileSync(prefix+"app.js","utf8");
 const cfg=readFileSync(prefix+"config.js","utf8");
 assert.match(html,/noindex,nofollow/);
 assert.match(html,/\.\/app\.js/);
 assert.match(cfg,/CPI_ATTENDANCE_API_BASE\s*=\s*""/);
 assert(!app.includes("SUPABASE_SERVICE_KEY"));
 new Function(app.replace(/^import.*$/gm,""));
}
const hr=readFileSync("apps/hr-web/index.html","utf8");
const styles=readFileSync("apps/hr-web/office.css","utf8");
const js=readFileSync("apps/hr-web/app.js","utf8");
for(const asset of ["office.css","cpi-mark.webp"])assert(existsSync("apps/hr-web/"+asset),asset+" missing");
assert.match(hr,/\.\/office\.css/);
assert.match(hr,/\.\/cpi-mark\.webp/);
assert.match(hr,/data-i18n="dashboard"/);
assert.match(hr,/data-i18n="applicants"/);
assert.match(hr,/data-i18n="employees"/);
assert.match(styles,/@media\(max-width:860px\)/);
assert.match(js,/function translate\(/);
console.log("PASS: bilingual HR office and employee PWA static regression");
