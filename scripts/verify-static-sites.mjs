import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
for (const site of ["hr-web","employee-pwa"]) {
  const dir="apps/"+site+"/";
  const html=readFileSync(dir+"index.html","utf8");
  for(const filename of ["index.html","styles.css","config.js","app.js"]) {
    assert(existsSync(dir+filename),"Missing "+dir+filename);
    if(filename!=="index.html")assert(html.includes("./"+filename),"HTML missing "+filename);
  }
  const cfg=readFileSync(dir+"config.js","utf8");
  assert.match(cfg,/CPI_ATTENDANCE_API_BASE\s*=\s*""/,"External API must be disabled in preview");
  assert.match(html,/noindex,nofollow/,"Unfinished HR websites must not be indexed");
  const app=readFileSync(dir+"app.js","utf8");
  assert(!app.includes("SUPABASE_SERVICE_KEY"),"Sensitive backend source in frontend");
  new Function(app.replace(/^import.*$/gm,"")); // JS syntax smoke test
  console.log("OK static website",site);
}
const dir="apps/hr-web/";
assert(existsSync(dir+"vendor/qrcode.js"));
assert(existsSync(dir+"vendor/LICENSE-qrcode-generator.txt"));
const manifest=JSON.parse(readFileSync("apps/employee-pwa/manifest.webmanifest","utf8"));
assert.equal(manifest.start_url,"./");
assert(existsSync("apps/employee-pwa/icon.svg"));
console.log("Both static sites are prepared for Vercel imports (not production APIs).");
