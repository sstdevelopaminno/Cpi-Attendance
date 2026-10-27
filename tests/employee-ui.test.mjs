import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const html=readFileSync("apps/employee-pwa/index.html","utf8");
const code=readFileSync("apps/employee-pwa/app.js","utf8");
test("employee login requires personal password",()=>{
  assert.match(html,/id="employee-code"/);
  assert.match(html,/id="org-code"/);
  assert.match(html,/id="password" type="password"/);
  assert.match(code,/password:\$\("password"\)\.value/);
});
test("employee QR browser API uses camera and on-demand GPS",()=>{
  assert.match(code,/BarcodeDetector/);
  assert.match(code,/getCurrentPosition/);
  assert.match(code,/maximumAge:0/);
  assert.doesNotMatch(code,/watchPosition/);
});
test("no credentials or tokens persisted to localStorage",()=>{
  assert.doesNotMatch(code,/localStorage|sessionStorage|document\.cookie/);
  assert.match(code,/state\.token=""/);
});
test("QR scanner does not navigate to scanned URL",()=>{
  assert.doesNotMatch(code,/location\.href\s*=|window\.open\(/);
});
