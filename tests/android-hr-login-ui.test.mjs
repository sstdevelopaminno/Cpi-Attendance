import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,existsSync} from "node:fs";

const root="tools/android-reader-smoke/app/src/main/";
const java=readFileSync(root+"java/com/cpiattendance/readerprobe/ReaderHandoffActivity.java","utf8");
const dialog=readFileSync(root+"java/com/cpiattendance/readerprobe/HrLoginDialog.java","utf8");
const manifest=readFileSync(root+"AndroidManifest.xml","utf8");
const logo=root+"res/drawable/cpi_brand_mark.xml";
const launcher=root+"res/mipmap-anydpi-v26/ic_launcher.xml";
test("Android HR has branded login UI and launcher inside existing app",()=>{
 assert.ok(existsSync(logo));assert.ok(existsSync(launcher));
 assert.match(readFileSync(logo,"utf8"),/viewportWidth="512"/);
 assert.match(manifest,/android:icon="@mipmap\/ic_launcher"/);
 assert.match(dialog,/cpi_brand_mark/);
 assert.match(dialog,/รหัสองค์กร 6 หลัก/);
 assert.match(dialog,/รหัส HR/);
 assert.match(dialog,/รหัสผ่าน HR/);
 assert.match(dialog,/เข้าสู่ระบบ Android HR/);
 assert.match(java,/new HrLoginDialog\(this\)\.show/);
 assert.doesNotMatch(manifest,/MainActivity/);
});
test("Android HR login refuses legacy enrollment and avoids sensitive logging",()=>{
 assert.match(java,/\/api\/reader\/enroll/);
 assert.match(java,/ยืนยันบัญชี HR สำเร็จ/);
 assert.match(java,/error.status==422&&"invalid_payload".equals\(error.errorCode\)/);
 assert.match(java,/error.status==404/);
 assert.match(java,/errorCode/);
 assert.match(java,/ReaderSecretStore\.save\(this,candidate\)/);
 assert.doesNotMatch(java,/Log\.(d|i|e|v|w)\(/);
 assert.doesNotMatch(dialog,/SharedPreferences|Log\.(d|i|e|v|w)\(/);
});

test("Unsupported legacy device enrollment is a separate phase after successful HR login",()=>{
 const login=java.indexOf('"/api/auth/login"');
 const enroll=java.indexOf('"/api/reader/enroll"');
 assert.ok(login>=0&&enroll>login);
 assert.match(java,/enrolling=true;/);
 assert.match(java,/done.failure\(loginError\(failure,enrolling\)\)/);
 assert.doesNotMatch(java,/deviceSecret=candidate;[^]*?apiWithBearer\(apiBase,"\/api\/reader\/enroll"/);
});
