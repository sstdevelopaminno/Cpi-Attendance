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

test("Android enforces server-attested tenant + exact HR before Keystore persistence",()=>{
 const api=readFileSync("supabase/functions/attendance-api/index.ts","utf8");
 const sql=readFileSync("supabase/migrations/20261029_attendance_hr_bound_reader_login.sql","utf8");
 assert.match(api,/context:\{\.\.\.ctx\.data,hr_user_id:lookup\.data\.auth_user_id\}/);
 assert.match(sql,/'hr_user_id',v_actor,'device_id',v_device\.id/);
 assert.match(java,/orgCode\.equals\(context\.getString\("organization_code"\)\)/);
 assert.match(java,/authenticatedHrId\.equalsIgnoreCase\(receipt\.optString\("hr_user_id",""\)\)/);
 assert.match(java,/organizationId\.equalsIgnoreCase\(receipt\.optString\("organization_id",""\)\)/);
 const receipt=java.indexOf("receipt.optBoolean");
 const persisted=java.indexOf("ReaderSecretStore.save(this,candidate)");
 assert.ok(receipt>0&&persisted>receipt,"Keystore write must happen only after binding receipt validation");
});

test("Android preview API can target isolated Supabase staging without client-side secrets",()=>{
 const gradle=readFileSync("tools/android-reader-smoke/app/build.gradle","utf8");
 assert.match(gradle,/CPI_ATTENDANCE_API_BASE/);
 assert.match(gradle,/apiUri\.scheme != 'https'/);
 assert.match(gradle,/apiUri\.rawPath != '\/functions\/v1\/attendance-api'/);
 assert.match(gradle,/resValue 'string', 'attendance_api_base', attendanceApi/);
 assert.match(java,/getString\(R\.string\.attendance_api_base\)/);
 assert.doesNotMatch(gradle,/SERVICE_ROLE|SECRET_KEY|service_role/);
});

test("Android checks server enrollment protocol before sending HR credentials",()=>{
 const api=readFileSync("supabase/functions/attendance-api/index.ts","utf8");
 assert.match(api,/hr_bound_android_enrollment:"v1"/);
 assert.match(java,/requireHrBoundReaderApi\(\)/);
 assert.match(java,/new URL\(apiBase\+"\/api\/health"\)/);
 assert.match(java,/server_upgrade_required/);
 const login=java.indexOf('JSONObject auth=api(apiBase,"/api/auth/login"');
 const preflight=java.lastIndexOf("requireHrBoundReaderApi();",login);
 assert.ok(preflight>=0&&preflight<login);
 assert.match(java,/แอป Login ไม่ได้ เพราะ Attendance API ยังเป็นรุ่นเก่า/);
});
