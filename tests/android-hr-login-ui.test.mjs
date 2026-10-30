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
 assert.match(java,/ReaderSecretStore\.saveSession\(this,candidate,orgCode,hrCode\)/);
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
 const persisted=java.indexOf("ReaderSecretStore.saveSession(this,candidate,orgCode,hrCode)");
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
 assert.match(api,/attendance_reader_protocol_version/);
 assert.match(api,/readerProtocol\?\.ok===true/);
 assert.match(api,/hr_bound_android_enrollment:readerReady\?"v1":"unavailable"/);
 assert.match(java,/requireHrBoundReaderApi\(\)/);
 assert.match(java,/new URL\(apiBase\+"\/api\/health"\)/);
 assert.match(java,/server_upgrade_required/);
 const login=java.indexOf('JSONObject auth=api(apiBase,"/api/auth/login"');
 const preflight=java.lastIndexOf("requireHrBoundReaderApi();",login);
 assert.ok(preflight>=0&&preflight<login);
 assert.match(java,/แอป Login ไม่ได้ เพราะ Attendance API ยังเป็นรุ่นเก่า/);
});

test("Cancelled HR reader session is terminal and cannot flood /reader/progress",()=>{
 assert.match(java,/\/api\/reader\/progress/);
 assert.match(java,/\(\(ApiFailure\)e\)\.status==403/);
 assert.match(java,/\(\(ApiFailure\)e\)\.status==404/);
 assert.match(java,/paired=false;sessionId="";publicKey="";cardPrompted=false;/);
 const i=java.indexOf('showState("คำขออ่านบัตรสิ้นสุดหรือถูกยกเลิก');
 const j=java.indexOf('cardPrompted=false;retry();',i);
 assert.ok(i>0&&j>i);
 const segment=java.slice(i,j);
 assert.doesNotMatch(segment,/retry\(\)/);
});

test("Android resumes only a server-approved Keystore device session and supports logout",()=>{
 const secure=readFileSync(
   "tools/android-reader-smoke/app/src/main/java/com/cpiattendance/readerprobe/ReaderSecretStore.java","utf8");
 assert.match(secure,/Cipher\.getInstance\("AES\/GCM\/NoPadding"\)/);
 assert.match(secure,/saveSession\(Context context,String token,String orgCode,String hrCode\)/);
 assert.match(secure,/loadIdentity\(Context context\)/);
 assert.match(secure,/getBoolean\("auto_resume",false\)/);
 assert.match(secure,/suspendAutoResume\(Context context\)/);
 assert.doesNotMatch(secure,/(putString|putBoolean)\("password"/);
 assert.match(java,/resumeRememberedHr\(identity\)/);
 assert.match(java,/requireHrBoundReaderApi\(\)/);
 assert.match(java,/result\.optBoolean\("online",false\)/);
 assert.match(java,/ReaderSecretStore\.suspendAutoResume\(this\)/);
 assert.match(java,/ReaderSecretStore\.saveSession\(this,candidate,orgCode,hrCode\)/);
 assert.match(java,/if\(!loggedIn\|\|stopped\)return;/);
 const stateValidation=java.indexOf('result.optBoolean("online",false)');
 const loginState=java.indexOf("loggedIn=true;",stateValidation);
 assert.ok(stateValidation>=0&&loginState>stateValidation,
   "resume may only mark login after a verified API response");
});

test("Keystore capability and HR identity save is atomic and no passwords or JWTs persist",()=>{
 const secure=readFileSync("tools/android-reader-smoke/app/src/main/java/com/cpiattendance/readerprobe/ReaderSecretStore.java","utf8");
 const begin=secure.indexOf("static void saveSession(");
 const next=secure.indexOf("static String[] loadIdentity(",begin);
 const fn=secure.slice(begin,next);
 assert.match(fn,/e\.putString\("cipher"/);
 assert.match(fn,/e\.putString\("identity_cipher"/);
 assert.match(fn,/e\.putBoolean\("auto_resume",true\)/);
 assert.equal((fn.match(/\.commit\(\)/g)||[]).length,1);
 assert.doesNotMatch(secure,/putString\("access_token"|putString\("password"/);
});

test("Reading multiple cards preserves login and requires card removal before the next read",()=>{
 assert.match(java,/private volatile boolean mustRemoveCard=false/);
 assert.match(java,/private void updateCardRemovalState\(\)/);
 assert.match(java,/if\(cardState==2\)/);
 assert.match(java,/mustRemoveCard=true;/);
 assert.match(java,/if\(!paired\|\|stopped\|\|mustRemoveCard\|\|!loggedIn\)return;/);
 assert.match(java,/if\(!waitingSaveSession\.isEmpty\(\)\|\|mustRemoveCard\)return;/);
 assert.match(java,/waitingSaveSession="";[\s\S]{0,180}showState\("HR บันทึกใบสมัครแล้ว/);
 assert.match(java,/คำขอเดิมสิ้นสุดแล้ว/);
 assert.match(java,/โปรดถอดบัตรประชาชนออก/);
 assert.match(java,/R\.drawable\.reader_id_card/);
 assert.match(java,/ตรวจสอบอุปกรณ์และการเชื่อมต่อ/);
});

test("Android renews an existing handoff heartbeat instead of getting stuck paired",()=>{
 assert.match(java,/Recheck the existing handoff on every heartbeat/);
 assert.match(java,/if\(paired && sessionId\.equals\(result\.optString\("session_id",""\)\)\)/);
 assert.match(java,/if\(paired\)\{\s*paired=false;sessionId="";publicKey="";cardPrompted=false;/);
 assert.match(java,/คำขอเดิมสิ้นสุดแล้ว · พร้อมรับคำขอใหม่/);
 assert.match(java,/if\(mustRemoveCard\)\{\s*runOnUiThread/);
});
test("Removal monitoring uses an independent serialized CCID lane, not the web heartbeat",()=>{
 assert.match(java,/private final ExecutorService cardIo=Executors\.newSingleThreadExecutor\(\)/);
 assert.match(java,/private final AtomicBoolean usbBusy=new AtomicBoolean\(false\)/);
 assert.match(java,/private final Runnable cardLoop=new Runnable\(\)/);
 assert.match(java,/handler\.post\(cardLoop\)/);
 assert.match(java,/if\(loggedIn&&mustRemoveCard&&!reading&&usbBusy\.compareAndSet\(false,true\)\)/);
 assert.match(java,/cardIo\.execute/);
 assert.match(java,/cardDiagnostic="ตรวจบัตรไม่สำเร็จ/);
 assert.match(java,/cardIo\.shutdownNow\(\)/);
});
