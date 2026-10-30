// Supabase invitations may fall back to the Site URL instead of the custom Redirect URL.
// Never leave an auth token in the main HR workspace URL.
if(/^#(?=.*(?:access_token|error_code)=)(?=.*type=(?:invite|recovery))/.test(location.hash)){
 location.replace("./welcome.html"+location.hash);
}
/* Cpi Attendance HR Office: access tokens live only in memory; the server keeps an HttpOnly rotating refresh session. */
const apiBase=String(window.CPI_ATTENDANCE_API_BASE??"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const I18N={
th:{
workspace:"พื้นที่ทำงาน",dashboard:"แดชบอร์ด / ภาพรวม",applicants:"ผู้สมัครงานใหม่",employees:"พนักงานผ่านโปร / บรรจุแล้ว",settings:"ตั้งค่า Android HR",testOnly:"PRODUCTION · เตรียมบัญชี HR",language:"ภาษา",hrControl:"HR CONTROL CENTER",
dashSubtitle:"สรุปบุคลากร การขาดลา มาสาย และค่าใช้จ่ายจากข้อมูลจริงขององค์กร",apiNotReady:"Attendance API เชื่อมต่อแล้ว • ลงชื่อเข้าใช้ HR เพื่อดูข้อมูลจริง",totalStaff:"พนักงานทั้งหมด",newStaff:"พนักงานใหม่",staffOnLeave:"พนักงานลา",absences:"จำนวนขาดงาน",late:"จำนวนมาสาย",otHours:"จำนวน OT",salaryPaid:"ยอดจ่ายเงินเดือน",otPaid:"ยอดจ่าย OT",advances:"ยอดเบิกเงินเดือน",
attendanceGraph:"แนวโน้มการลงเวลา",payrollGraph:"ภาพรวมค่าใช้จ่าย",last7:"7 วันล่าสุด",month:"เดือนนี้",noChart:"รอข้อมูลสรุปจากเซิร์ฟเวอร์",noPayroll:"ยังไม่มีข้อมูลการจ่ายเงินที่ตรวจรับ",
applicantsSubtitle:"จัดการใบสมัคร ตรวจสอบข้อมูล และอนุมัติรับเข้าทำงาน",addApplicant:"+ เพิ่มผู้สมัครใหม่",search:"ค้นหาชื่อหรือรหัสใบสมัคร",allStatus:"ทุกสถานะ",pending:"รอพิจารณา",approved:"ผ่านการคัดเลือก",rejected:"ไม่ผ่าน",refresh:"รีเฟรช",applicantName:"ชื่อ-นามสกุล",position:"ตำแหน่งสมัคร",source:"ช่องทาง",date:"วันที่สมัคร",status:"สถานะ",actions:"จัดการ",back:"← กลับไปผู้สมัครงาน",print:"พิมพ์ใบสมัคร",edit:"แก้ไข",delete:"ลบ",approve:"ยืนยันผ่านการคัดเลือก",passed:"ผ่านแล้ว",applicationForm:"ใบสมัครงาน",photo:"รูปถ่าย",personalInfo:"01 / ประวัติส่วนตัวและข้อมูลบัตร",thaiCardSection:"ข้อมูลจากบัตรประชาชนไทย",previewCard:"ดูข้อมูลแบบบัตร",idPreviewNotice:"ตัวอย่างการจัดวางข้อมูล ไม่ใช่ภาพบัตรราชการหรือเอกสารยืนยันตัวตน",close:"ปิดหน้าต่าง",thaiPrefix:"คำนำหน้าภาษาไทย",englishPrefix:"คำนำหน้าภาษาอังกฤษ",issuer:"ผู้ออกบัตร / นายทะเบียน",readerWaiting:"รอเชื่อมต่อ Android HR",readerConnecting:"กำลังตรวจสอบการเชื่อมต่อ",readerPaired:"เชื่อมต่อแล้ว · ออนไลน์",readerReading:"กำลังตรวจสอบและอ่านชิป",readerReceived:"อ่านชิปสำเร็จ · ตรวจสอบข้อมูลก่อนบันทึก",readerApiOffline:"ยังไม่มี Attendance API ที่เชื่อมต่อสำเร็จ กรุณาตรวจระบบก่อนอ่านบัตรจริง",readerBack:"กลับไปใบสมัคร",readerPrivacy:"ข้อมูลบัตรส่งแบบเข้ารหัสและต้องให้ HR ตรวจทานก่อนบันทึก",employmentInfo:"02 / ข้อมูลการสมัครงาน",applicantSignature:"ลงชื่อผู้สมัคร ____________________",hrSignature:"ผู้รับใบสมัคร ____________________",printPrivacy:"เอกสารข้อมูลส่วนบุคคล ใช้เฉพาะการรับสมัครตามสิทธิ์ที่ได้รับอนุญาต",employeesSubtitle:"แยกพนักงานระหว่างรอผ่านทดลองงานและบรรจุแล้ว",probationHeading:"พนักงานรอผ่านทดลองงาน",probationHelp:"ผ่านการคัดเลือกแล้ว แต่ต้องยืนยันการผ่านทดลองงานแยกต่างหาก",confirmedHeading:"พนักงานผ่านโปร / บรรจุแล้ว",confirmProbation:"ยืนยันผ่านทดลองงาน",probationStatus:"รอผ่านโปร",confirmProbationQuestion:"ยืนยันว่าพนักงานผ่านทดลองงานแล้ว? การดำเนินการจะบันทึกผู้อนุมัติและเวลา",employeeCode:"รหัสพนักงาน",
settingsSubtitle:"แยกสิทธิ์โหมดรับสมัครงานและเครื่องลงเวลาพนักงาน",modeAccess:"สิทธิ์เข้าสู่โหมดของ Android",modeHelp:"เจ้าขององค์กร/HR Admin เป็นผู้เพิ่มและจัดการเครื่อง Android กำหนดโหมดและสิทธิ์เองภายในแพ็กเกจ ไม่ต้องรออนุมัติจาก IT",modeHr:"HR Enrollment",hrModeDesc:"อ่านบัตรเพื่อตรวจใบสมัคร และส่งข้อมูลขั้นต่ำ",kioskModeDesc:"เสียบบัตรลงเวลา ไม่แสดงข้อมูลส่วนบุคคล",locked:"รอเปิดระบบตั้งค่าโดย HR",modeSecurity:"เจ้าขององค์กร/HR Admin จัดการการเข้าโหมดและอุปกรณ์เอง ขณะนี้หน้าตั้งค่ายังไม่เปิดใช้งาน ห้ามเก็บ PIN หรือรหัส HR แบบข้อความธรรมดาและต้องตรวจจำนวนอุปกรณ์ตามแพ็กเกจจากเซิร์ฟเวอร์",
login:"เข้าสู่ระบบ HR",loginSubtitle:"ลงชื่อเข้าใช้ด้วยบัญชีที่เจ้าขององค์กรหรือ HR Admin ของผู้เช่าจัดการเอง เพื่อเข้าถึงข้อมูลเฉพาะองค์กร",orgCode:"รหัสองค์กร 6 หลัก",userCode:"รหัส Owner / HR Admin",password:"รหัสผ่าน",logout:"ออกจากระบบ",englishName:"ชื่อภาษาอังกฤษ",nationalId:"เลขบัตรประชาชน",dob:"วันเกิด",gender:"เพศ",male:"ชาย",female:"หญิง",other:"อื่น ๆ",phone:"เบอร์โทร",address:"ที่อยู่ตามบัตร",issued:"วันออกบัตร",expires:"วันหมดอายุบัตร",photoWarning:"รูปและข้อมูลใบสมัครจะบันทึกในพื้นที่ข้อมูลส่วนตัวขององค์กรเมื่อ HR กดบันทึกสำเร็จ",androidReader:"สามารถนำเข้าจาก Android HR ได้หลังผ่านการตรวจอุปกรณ์และสิทธิ์",readCard:"เปิดรับข้อมูลจาก Android HR",education:"การศึกษา",expectedSalary:"เงินเดือนที่ต้องการ",availableDate:"เริ่มงานได้",workHistory:"ประวัติการทำงานเพิ่มเติม",privacyConfirm:"ได้รับการแจ้งวัตถุประสงค์และฐานกฎหมายในการใช้ข้อมูลเพื่อสมัครงานแล้ว",saveLimit:"การจัดเก็บข้อมูลผู้สมัครต้องได้รับการแจ้งวัตถุประสงค์ และเข้าถึงได้เฉพาะ HR ที่มีสิทธิ์",cancel:"ยกเลิก",preview:"ดูใบสมัคร / พิมพ์",saveApplicant:"บันทึกใบสมัคร",noCandidates:"ยังไม่มีผู้สมัครงานในองค์กรนี้",noEmployees:"ยังไม่มีรายชื่อพนักงานที่ได้รับอนุญาต",view:"เปิดดู",temp:"ร่างชั่วคราว",previewNotice:"โหมดตัวอย่าง: ข้อมูลนี้อยู่เฉพาะในหน่วยความจำและจะหายเมื่อปิดหน้าเว็บ",loginRequired:"ต้องเข้าสู่ระบบ HR ก่อนจึงจะบันทึกบนเซิร์ฟเวอร์ได้",serverSave:"บันทึกข้อมูลผู้สมัครและรูปในระบบแล้ว",printWarning:"ใบสมัครนี้ประกอบด้วยข้อมูลส่วนบุคคล โปรดรักษาเอกสารให้ปลอดภัย",approvePrompt:"ระบุรหัสพนักงาน (2–48 ตัว)",confirmApprove:"ยืนยันผ่านการคัดเลือกและสร้างพนักงานจากใบสมัครนี้?",confirmDelete:"ยืนยันลบร่างชั่วคราวนี้?",deleteUnavailable:"การลบข้อมูลจริงต้องผ่านขั้นตอนลบอย่างปลอดภัยและบันทึก Audit Trail",editLocked:"ใบสมัครที่อนุมัติแล้วถูกล็อก ไม่สามารถแก้ไขโดยตรงได้",limitedEdit:"แก้ไขข้อมูลผู้สมัครและรูปได้โดยบันทึกการแก้ไขในระบบ",archiveReason:"ระบุเหตุผล: withdrawn / duplicate / entered_in_error",archiveDone:"ถอนใบสมัครโดยบันทึก Audit Trail แล้ว",pendingReview:"รอพิจารณา",sourceAndroid:"Android HR",sourceWeb:"HR Web",safeNotice:"ไม่มีการเปิดเผยข้อมูลบัตรจากชิปหรือภาพในรายการตาราง",approvedSaved:"อนุมัติและสร้างรหัสพนักงานแล้ว",demoApproved:"ตัวอย่างการอนุมัติ — ยังไม่บันทึกเซิร์ฟเวอร์",wrongCode:"รูปแบบรหัสพนักงานไม่ถูกต้อง"
},
en:{
workspace:"WORKSPACE",dashboard:"Dashboard / Overview",applicants:"New Applicants",employees:"Confirmed Employees",settings:"Android HR Settings",testOnly:"PRODUCTION · HR setup required",language:"Language",hrControl:"HR CONTROL CENTER",
dashSubtitle:"Organization staffing, attendance and verified payroll overview",apiNotReady:"Attendance API connected • Sign in with your authorized HR account.",totalStaff:"Total employees",newStaff:"New employees",staffOnLeave:"On leave",absences:"Absences",late:"Late arrivals",otHours:"Overtime",salaryPaid:"Salary paid",otPaid:"OT paid",advances:"Salary advances",
attendanceGraph:"Attendance trend",payrollGraph:"Payroll overview",last7:"Last 7 days",month:"This month",noChart:"Awaiting verified server data",noPayroll:"No verified payroll data yet",
applicantsSubtitle:"Review applications, verify submitted details and approve employment",addApplicant:"+ New applicant",search:"Search names or application ID",allStatus:"All statuses",pending:"Pending review",approved:"Approved",rejected:"Rejected",refresh:"Refresh",applicantName:"Full name",position:"Position applied for",source:"Source",date:"Application date",status:"Status",actions:"Actions",back:"← Back to applicants",print:"Print application",edit:"Edit",delete:"Delete",approve:"Approve employment",passed:"APPROVED",applicationForm:"Job application",photo:"Photo",personalInfo:"01 / Personal and ID information",thaiCardSection:"Thai National ID fields",previewCard:"View card layout",idPreviewNotice:"Layout illustration only; not an official identity document",close:"Close",thaiPrefix:"Thai name prefix",englishPrefix:"English name prefix",issuer:"Card issuing authority",readerWaiting:"Waiting for Android HR",readerConnecting:"Connecting to Android HR",readerPaired:"Connected · online",readerReading:"Verifying and reading chip",readerReceived:"Read complete · verify before saving",readerApiOffline:"Attendance API connection unavailable. Do not read real cards until configured.",readerBack:"Back to application",readerPrivacy:"Card data is encrypted and requires HR review before saving.",employmentInfo:"02 / Employment application",applicantSignature:"Applicant signature ____________________",hrSignature:"HR signature ____________________",printPrivacy:"Confidential applicant data. Restricted to authorized recruitment use.",employeesSubtitle:"Probation and confirmed employees are listed separately",probationHeading:"Employees in probation",probationHelp:"Recruitment approval does not mean probation has been completed.",confirmedHeading:"Confirmed employees",confirmProbation:"Confirm probation passed",probationStatus:"In probation",confirmProbationQuestion:"Confirm this employee passed probation? Approver and time will be audited.",employeeCode:"Employee ID",
settingsSubtitle:"Separate permissions for HR onboarding and employee attendance kiosks",modeAccess:"Android mode permissions",modeHelp:"Subscriber Owner/HR Admin configures Android devices, sites and HR/Kiosk modes inside the purchased plan; IT does not approve individual devices.",modeHr:"HR Enrollment",hrModeDesc:"Review chip data and submit minimal application information",kioskModeDesc:"Clock in/out without displaying personal chip data",locked:"Tenant HR setup not yet active",modeSecurity:"Subscriber HR manages devices and mode access without IT approval. Settings are not live yet; do not store plain-text PINs or passwords. Validate tenant, device and commercial package limits server-side.",
login:"HR Sign in",loginSubtitle:"Sign in with an account granted by your own organization's Owner/HR Admin to access your tenant's data",orgCode:"6-digit organization code",userCode:"Owner / HR Admin code",password:"Password",logout:"Log out",englishName:"Name in English",nationalId:"National ID number",dob:"Date of birth",gender:"Gender",male:"Male",female:"Female",other:"Other",phone:"Phone",address:"Registered address",issued:"ID issued",expires:"ID expiry",photoWarning:"Applicant details and photo are saved in the organization's protected records after confirmation.",androidReader:"Android HR import requires authorized device pairing and API approval",readCard:"Import from Android HR (disabled)",education:"Education",expectedSalary:"Expected salary",availableDate:"Available from",workHistory:"Work history",privacyConfirm:"Appropriate privacy notice and lawful processing basis have been confirmed.",saveLimit:"Private applicant data requires confirmed privacy notice and authorized HR access.",cancel:"Cancel",preview:"Preview / Print",saveApplicant:"Save application",noCandidates:"No applicants found",noEmployees:"No authorized employees found",view:"View details",temp:"Local draft",previewNotice:"Preview only: this record is held in memory and will disappear when this page closes.",loginRequired:"Sign in as authorized HR to save to the API.",serverSave:"Applicant record and photo saved securely to the organization's database.",printWarning:"This printout contains personal data. Store securely.",approvePrompt:"Employee ID (2–48 characters)",confirmApprove:"Approve this applicant and lock the record?",confirmDelete:"Delete this local draft?",deleteUnavailable:"Deleting real records requires a secured audited backend workflow.",editLocked:"Approved applications are locked and cannot be edited directly.",limitedEdit:"Authorized HR can edit applicant details and photo with an audit trail.",archiveReason:"Reason: withdrawn / duplicate / entered_in_error",archiveDone:"Application archived with an audit record.",pendingReview:"Pending review",sourceAndroid:"Android HR",sourceWeb:"HR Web",safeNotice:"Raw chip data and images are never shown in table rows.",approvedSaved:"Approved and assigned internal employee ID",demoApproved:"Demonstration approval only; no server write",wrongCode:"Invalid employee ID"
}};
const S={language:"th",screen:"dashboard",token:"",context:null,expiresAt:0,records:[],roster:[],selected:null,localDrafts:[],draftEditing:null,readerSession:null};
const authPanel=document.getElementById("hr-login"),authShell=document.querySelector(".app-shell");
document.body.append(authPanel);
function showAuthGate(open){
 authPanel.hidden=!open;authShell.inert=open;
 if(open)document.getElementById("hr-org-code").focus({preventScroll:true});
}
showAuthGate(true);
function tr(key){return I18N[S.language]?.[key]??key}
const safeDate=x=>x&&!Number.isNaN(Date.parse(x))?new Date(x).toLocaleDateString(S.language==="th"?"th-TH":"en-US",{year:"numeric",month:"short",day:"numeric",timeZone:"Asia/Bangkok"}):"—";
const isOnline=()=>/^(https:\/\/)/.test(apiBase);
const signedIn=()=>!!(S.token&&S.context&&Date.now()<S.expiresAt);
function notice(t){$("system-banner").textContent=t}
function translate(){
 document.documentElement.lang=S.language;
 for(const el of document.querySelectorAll("[data-i18n]"))el.textContent=tr(el.dataset.i18n);
 for(const el of document.querySelectorAll("[data-i18n-placeholder]"))el.placeholder=tr(el.dataset.i18nPlaceholder);
 $("today-label").textContent=new Date().toLocaleDateString(S.language==="th"?"th-TH":"en-US",{year:"numeric",month:"long",day:"numeric"});
 $("breadcrumb").textContent=tr(S.screen==="applicant-detail"?"applicants":S.screen);
 if(!signedIn())notice(tr("apiNotReady"));
 renderApplicants();renderEmployees();if(S.selected)renderDetail();if(signedIn())void loadDashboard();
}
function navigate(screen,{silent=false}={}){
 S.screen=screen;
 for(const page of document.querySelectorAll(".screen"))page.hidden=page.id!=="screen-"+(screen==="applicant-detail"?"applicant-detail":screen);
 for(const b of document.querySelectorAll("[data-view]")){b.classList.toggle("selected",b.dataset.view===screen);}
 $("breadcrumb").textContent=tr(screen==="applicant-detail"?"applicants":screen);
 if(!silent)history.replaceState({view:screen},"","#"+screen);
 window.scrollTo({top:0,behavior:"instant"});
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
$("sidebar-toggle").addEventListener("click",()=>{
 const collapsed=document.querySelector(".app-shell").classList.toggle("sidebar-collapsed");
 $("sidebar-toggle").setAttribute("aria-expanded",String(!collapsed));
 $("sidebar-toggle").setAttribute("aria-label",collapsed?"ขยายแถบเมนู":"ยุบแถบเมนู");
});
$("language").addEventListener("change",e=>{S.language=e.target.value;translate()});
let renewingSession=null;
async function resumeSession(){
 if(renewingSession)return renewingSession;
 renewingSession=(async()=>{
  try{
   const response=await fetch("/api/hr-session",{method:"GET",credentials:"same-origin",cache:"no-store"});
   if(!response.ok)return false;
   const data=await response.json();
   if(!["owner","hr_admin"].includes(data?.context?.role))return false;
   applySession(data);
   return true;
  }catch{return false}
 })();
 try{return await renewingSession}finally{renewingSession=null}
}
function applySession(data){
 S.token=data.access_token;S.context=data.context;
 S.expiresAt=Date.now()+Math.min(data.expires_in||3600,3600)*1000-20000;
 $("session-label").textContent=data.context.organization_name+" · "+(data.hr_code||"HR")+" · "+data.context.role;
 $("hr-password").value="";
 showAuthGate(false);
 $("session-bar").hidden=false;
 $("hr-logout").hidden=false;
 document.dispatchEvent(new Event("cpi-hr-signed-in"));
}
async function request(method,path,body){
 if(!["/api/auth/login","/api/auth/request-password-setup"].includes(path)&&!signedIn()){
  if(!await resumeSession())throw Error(tr("loginRequired"));
 }
 if(!isOnline())throw Error(tr("apiNotReady"));
 const response=await fetch(apiBase+path,{method,headers:{"Content-Type":"application/json",...(S.token?{Authorization:"Bearer "+S.token}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error??"request_rejected");
 return payload.data;
}
function logout({revoke=true}={}){
 if(revoke)void fetch("/api/hr-session",{method:"DELETE",credentials:"same-origin",
  cache:"no-store"}).catch(()=>{});
 S.pendingSaveKey=null;
 if(typeof window.cancelReaderSession==="function")window.cancelReaderSession();
 for(const r of S.records)releasePhoto(r);
 S.token="";S.context=null;S.expiresAt=0;S.records=[];S.roster=[];S.selected=null;
 showAuthGate(true);$("session-bar").hidden=true;$("hr-logout").hidden=true;$("hr-password").value="";
  document.dispatchEvent(new Event("cpi-hr-signed-out"));
 refreshView();notice(tr("apiNotReady"));
}
$("hr-login-form").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("hr-login-button");btn.disabled=true;
 try{
  const v=await request("POST","/api/auth/login",{
   organization_code:$("hr-org-code").value.trim(),employee_code:$("hr-user-code").value.trim(),password:$("hr-password").value
  });
  if(!["owner","hr_admin"].includes(v?.context?.role))throw Error("hr_role_forbidden");
  const hrCode=$("hr-user-code").value.trim().toUpperCase();
  let session=null;
  if(typeof v.refresh_token==="string"){
   try{
    const stored=await fetch("/api/hr-session",{
     method:"POST",credentials:"same-origin",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({org:$("hr-org-code").value.trim(),hr:hrCode,refresh_token:v.refresh_token})
    });
    if(stored.ok)session=await stored.json();
   }catch{/* A temporary cookie failure must not invalidate a verified login. */}
  }
  applySession({...v,...session,hr_code:hrCode});
  notice(session?"✓ "+v.context.organization_name+" · เข้าระบบอัตโนมัติในครั้งถัดไป":
   "เข้าสู่ระบบแล้ว แต่ยังจดจำการเข้าสู่ระบบไม่ได้ โปรดลองอีกครั้งภายหลัง");
  await refreshView();
 }catch(error){logout({revoke:false});notice(error.message)}finally{btn.disabled=false}
});
$("hr-request-reset").addEventListener("click",async()=>{
 const org=$("hr-org-code").value.trim(),code=$("hr-user-code").value.trim().toUpperCase(),
 help=$("hr-password-help"),button=$("hr-request-reset");
 if(!/^[0-9]{6}$/.test(org)||!/^[A-Z0-9]{6}$/.test(code)){
  help.textContent="กรอกรหัสองค์กร 6 หลักและรหัส HR 6 ตัวก่อนส่งอีเมล";return;
 }
 button.disabled=true;help.textContent="กำลังส่งคำขอตั้งรหัสผ่าน…";
 try{
  await request("POST","/api/auth/request-password-setup",{
   organization_code:org,employee_code:code
  });
  help.textContent="หากบัญชีนี้ได้รับสิทธิ์แล้ว ระบบจะส่งอีเมลตั้งรหัสผ่านไปยังเจ้าของบัญชี ตรวจกล่องจดหมายและสแปม แล้วเปิดลิงก์ฉบับล่าสุด";
 }catch(err){
  help.textContent=err.message==="too_many_requests"?
   "ส่งคำขอถี่เกินไป โปรดลองใหม่ภายหลัง":"ยังส่งคำขอไม่ได้: "+err.message;
 }finally{button.disabled=false}
});
$("hr-logout").addEventListener("click",()=>logout());
setInterval(()=>{if(S.token&&!signedIn()){
  void resumeSession().then(ok=>{if(!ok)logout({revoke:false})});
}},15000);
// HttpOnly refresh cookie is checked automatically on each page load.
void resumeSession().then(ok=>{if(ok)void refreshView()});
async function refreshView(){
 if(signedIn()){
  const org=encodeURIComponent(S.context.organization_id);
  const data=await Promise.allSettled([
   request("GET","/api/hr/applications?organization_id="+org),
   request("GET","/api/hr/employees?organization_id="+org)
  ]);
  if(data[0].status==="fulfilled"){
   for(const r of S.records)releasePhoto(r);
   S.records=(Array.isArray(data[0].value)?data[0].value:[]).map(x=>({
    id:x.id,name:x.name??"",source:x.source??"hr_manual",status:x.status??"pending",
    created_at:x.created_at,employee_id:x.employee_id,persisted:true
  }));
  }
  if(data[1].status==="fulfilled")S.roster=Array.isArray(data[1].value)?data[1].value:[];
  if(data.some(x=>x.status==="rejected"))notice("Data API: "+data.filter(x=>x.status==="rejected").map(x=>x.reason?.message??"unavailable").join(", "));
 }
 renderApplicants();renderEmployees();loadDashboard();
}
function combined(){return [...S.localDrafts,...S.records]}
function td(text){const cell=document.createElement("td");cell.textContent=String(text??"—");return cell}
function statusChip(status){const el=document.createElement("span");el.className="status-pill "+status;el.textContent=tr(status==="approved"?"approved":status==="rejected"?"rejected":"pending");return el}
function rowButton(label,onClick){const btn=document.createElement("button");btn.type="button";btn.className="linklike";btn.textContent=label;btn.addEventListener("click",onClick);return btn}
function renderApplicants(){
 const q=$("applicant-search").value.trim().toLowerCase(),status=$("applicant-status").value;
 const records=combined().filter(x=>x.status!=="approved"&&(status==="all"||x.status===status)&&
  (!q||(x.name+" "+x.id).toLowerCase().includes(q)));
 const body=$("applicant-rows");body.replaceChildren();
 for(const row of records){
  const trEl=document.createElement("tr");
  const first=td("");first.append(rowButton(row.name,()=>openDetail(row)));trEl.append(first);
  trEl.append(td(row.extra?.position??"—"),td(row.source==="android_hr"?tr("sourceAndroid"):tr("sourceWeb")),td(safeDate(row.created_at)));
  const badge=td("");badge.append(statusChip(row.status));trEl.append(badge);
  const action=td("");const actions=document.createElement("div");actions.className="table-row-actions";
  actions.append(rowButton(tr("view"),()=>void openDetail(row)));
  if(!row.persisted||signedIn()&&["owner","hr_admin"].includes(S.context?.role))
   actions.append(rowButton("ลบ",()=>void archiveApplicant(row)));
  action.append(actions);trEl.append(action);body.append(trEl);
 }
 if(!records.length){const trEl=document.createElement("tr");const cell=td(tr("noCandidates"));cell.colSpan=6;cell.style.textAlign="center";cell.style.padding="40px";trEl.append(cell);body.append(trEl)}
 $("pending-count").textContent=String(combined().filter(x=>x.status==="pending").length||"—");
 $("applicant-note").textContent=signedIn()?tr("safeNotice"):tr("previewNotice");
}
async function archiveApplicant(row){
 if(!row)return;
 if(!row.persisted){
  if(!confirm("นำร่างใบสมัครนี้ออกจากรายการ?"))return;
  S.localDrafts=S.localDrafts.filter(x=>x!==row);releasePhoto(row);
  if(S.selected?.id===row.id){S.selected=null;navigate("applicants")}
  renderApplicants();return;
 }
 if(!signedIn()||!["owner","hr_admin"].includes(S.context?.role))
  return notice("เฉพาะ Owner / HR Admin ขององค์กรเท่านั้นที่นำรายการออกได้");
 if(!confirm("ยืนยันนำใบสมัครของ "+row.name+" ออกจากรายการ?\\n"+
   "ระบบจะเก็บประวัติในคลังและ Audit Trail ไม่ลบข้อมูลถาวร"))return;
 const reason=prompt("เหตุผลการเก็บเข้าคลัง: withdrawn / duplicate / entered_in_error","entered_in_error");
 if(reason===null)return;
 if(!["withdrawn","duplicate","entered_in_error"].includes(reason))
  return notice("กรุณาเลือกเหตุผลที่ถูกต้อง");
 try{
  await request("POST","/api/hr/applications/archive",{
   organization_id:S.context.organization_id,application_id:row.id,reason
  });
  if(S.selected?.id===row.id){S.selected=null;navigate("applicants")}
  await refreshView();notice("นำใบสมัครออกจากรายการแล้ว โดยยังเก็บประวัติไว้");
 }catch(e){notice("นำใบสมัครออกไม่ได้: "+e.message)}
}
function viewEmployee(row){
 let dialog=$("employee-detail-dialog");
 if(!dialog){
  dialog=document.createElement("dialog");
  dialog.id="employee-detail-dialog";dialog.className="employee-detail-dialog";
  document.body.append(dialog);
 }
 dialog.replaceChildren();
 const header=document.createElement("div");header.className="employee-detail-head";
 const title=document.createElement("h2");title.textContent="ข้อมูลพนักงาน";
 const close=rowButton("✕ ปิด",()=>dialog.close());header.append(title,close);dialog.append(header);
 const dl=document.createElement("dl");dl.className="employee-detail-fields";
 for(const [label,val] of [["รหัสพนักงาน",row.code],["ชื่อ-นามสกุล",row.name],
   ["สถานะการจ้าง",row.status==="active"?"กำลังทำงาน":row.status==="inactive"?"พักการใช้งาน":"สิ้นสุดการจ้าง"],
   ["สถานะทดลองงาน",row.probation_status==="confirmed"?"ผ่านทดลองงาน":"อยู่ระหว่างทดลองงาน"]]){
  const item=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");
  dt.textContent=label;dd.textContent=String(val??"—");item.append(dt,dd);dl.append(item);
 }
 dialog.append(dl);
 const actions=document.createElement("div");actions.className="employee-detail-actions";
 const source=S.records.find(x=>x.employee_id===row.id||x.id===row.application_id);
 if(source)actions.append(rowButton("ดูประวัติใบสมัครและรูป",()=>{
   dialog.close();void openDetail(source);
 }));
 const permitted=signedIn()&&["owner","hr_admin"].includes(S.context?.role);
 if(permitted){
  const edit=rowButton("แก้ไขชื่อ",()=>{dialog.close();void manageEmployee(row,"rename")});
  actions.append(edit);
  if(row.status==="active"){
   actions.append(rowButton("พักการใช้งาน",()=>{dialog.close();void manageEmployee(row,"deactivate")}));
   if(row.probation_status==="confirmed")
    actions.append(rowButton("กลับไปทดลองงาน",()=>{dialog.close();void manageEmployee(row,"reopen_probation")}));
  }else if(row.status==="inactive")
   actions.append(rowButton("เปิดใช้งาน",()=>{dialog.close();void manageEmployee(row,"activate")}));
  if(row.status!=="terminated")actions.append(rowButton("ยุติการจ้าง",()=>{
   dialog.close();void manageEmployee(row,"terminate");
  }));
  actions.append(rowButton("นำพนักงานออกจากรายการ",()=>{
   dialog.close();void archiveEmployee(row);
  }));
 }
 dialog.append(actions);dialog.showModal();
}
function staffActions(row,isConfirmed){
 const action=td("");
 const actions=document.createElement("div");actions.className="table-row-actions";
 actions.append(rowButton("ดูข้อมูล",()=>viewEmployee(row)));
 const source=S.records.find(x=>x.employee_id===row.id||x.id===row.application_id);
 if(source)actions.append(rowButton("ประวัติ",()=>void openDetail(source)));
 if(!signedIn()||!["owner","hr_admin"].includes(S.context?.role)){
  action.append(actions);return action;
 }
 if(row.status==="active"&&!isConfirmed)
  actions.append(rowButton(tr("confirmProbation"),()=>void confirmProbation(row)));
 actions.append(rowButton("แก้ไขชื่อ",()=>void manageEmployee(row,"rename")));
 if(row.status==="active"){
  actions.append(rowButton("พักใช้งาน",()=>void manageEmployee(row,"deactivate")));
  if(isConfirmed)actions.append(rowButton("กลับไปทดลองงาน",()=>void manageEmployee(row,"reopen_probation")));
 }else if(row.status==="inactive"){
  actions.append(rowButton("เปิดใช้งาน",()=>void manageEmployee(row,"activate")));
 }
 if(row.status!=="terminated")
  actions.append(rowButton("ยุติการจ้าง",()=>void manageEmployee(row,"terminate")));
 actions.append(rowButton("ลบ",()=>void archiveEmployee(row)));
 action.append(actions);
 return action;
}
async function archiveEmployee(row){
 if(!signedIn()||!["owner","hr_admin"].includes(S.context?.role))return;
 const mustTerminate=row.status!=="terminated";
 const message=mustTerminate?
  "พนักงาน "+row.name+" ยังไม่ได้สิ้นสุดการจ้าง\\n"+
  "การนำออกจะยุติการจ้างและเก็บรายการไว้ในคลังพร้อม Audit Trail (ข้อมูลลงเวลาและเงินเดือนจะไม่ถูกลบ)":
  "ยืนยันนำพนักงาน "+row.name+" ออกจากตาราง? ข้อมูลเดิมและ Audit Trail จะยังถูกเก็บ";
 if(!confirm(message))return;
 try{
  await request("POST","/api/hr/employees/archive",{
   organization_id:S.context.organization_id,employee_id:row.id,
   terminate_before_archive:mustTerminate
  });
  await refreshView();
  notice("นำรายการพนักงานออกจากตารางแล้ว โดยยังเก็บข้อมูลย้อนหลังไว้");
 }catch(e){notice("ยังนำรายการออกไม่ได้: "+e.message)}
}
async function manageEmployee(row,action){
 if(!signedIn()||!["owner","hr_admin"].includes(S.context?.role))return;
 const labels={rename:"แก้ไขชื่อพนักงาน",activate:"กลับมาใช้งาน",deactivate:"พักการใช้งาน",
  terminate:"ยุติการจ้าง (เก็บประวัติ)",reopen_probation:"ยกเลิกการยืนยันผ่านโปร"};
 let name=null;
 if(action==="rename"){
  name=prompt("ชื่อพนักงานที่ถูกต้อง",row.name);
  if(name===null)return;
  name=name.trim();if(name.length<2||name.length>180){notice("กรุณากรอกชื่อ 2–180 ตัวอักษร");return}
 }else if(!confirm("ยืนยัน "+labels[action]+" สำหรับ "+row.name+"?"))return;
 try{
  await request("POST","/api/hr/employees/manage",{
   organization_id:S.context.organization_id,employee_id:row.id,action,
   ...(name!==null?{full_name:name}:{})
  });
  notice("บันทึก "+labels[action]+" เรียบร้อย");await refreshView();
 }catch(e){notice("ยังบันทึกไม่ได้: "+e.message)}
}
function setEmployeeTableView(view){
 const target=["all","probation","confirmed"].includes(view)?view:"all";
 $("employees-probation-section").hidden=target==="confirmed";
 $("employees-confirmed-section").hidden=target==="probation";
 for(const btn of document.querySelectorAll("[data-employee-view]")){
  const selected=btn.dataset.employeeView===target;
  btn.setAttribute("aria-pressed",String(selected));
  btn.classList.toggle("primary",selected);
  btn.classList.toggle("ghost",!selected);
 }
}
document.querySelectorAll("[data-employee-view]").forEach(button=>{
 button.addEventListener("click",()=>setEmployeeTableView(button.dataset.employeeView));
});
function renderEmployees(){
 const confirmed=$("employee-rows"),pending=$("probation-rows");
 confirmed.replaceChildren();pending.replaceChildren();
 let nConfirmed=0,nPending=0;
 for(const row of S.roster){
  const isPending=row.status==="active"&&row.probation_status!=="confirmed";
  const trEl=document.createElement("tr");
  trEl.append(td(row.code??"—"));
  const nameCell=td("");nameCell.append(rowButton(row.name??"—",()=>viewEmployee(row)));trEl.append(nameCell);
  if(isPending){
   const status=td("");status.textContent="อยู่ระหว่างทดลองงาน";
   trEl.append(status,staffActions(row,false));pending.append(trEl);nPending++;
  }else{
   trEl.append(td("—"));
   const status=td("");
   status.textContent=row.status==="inactive"?"พักการใช้งาน":
     row.status==="terminated"?"สิ้นสุดการจ้าง":"บรรจุแล้ว";
   trEl.append(status,staffActions(row,true));confirmed.append(trEl);nConfirmed++;
  }
 }
 // Preview-only draft approvals have no persisted employee id to mutate.
 for(const row of S.localDrafts.filter(x=>x.status==="approved")){
  const trEl=document.createElement("tr");trEl.append(td(row.employee_code??"DEMO"),
   td(row.name??"—"));
  const status=td("");status.append(statusChip("pending"));trEl.append(status,td(tr("temp")));
  pending.append(trEl);nPending++;
 }
 const empty=(tbody,message,cols)=>{
  const row=document.createElement("tr"),cell=td(message);cell.colSpan=cols;
  cell.style.padding="35px";cell.style.textAlign="center";row.append(cell);tbody.append(row);
 };
 if(nConfirmed===0)empty(confirmed,tr("noEmployees"),5);
 if(nPending===0)empty(pending,tr("noEmployees"),4);
}
async function confirmProbation(row){
 if(!signedIn()||!["owner","hr_admin"].includes(S.context.role))return;
 if(!confirm(tr("confirmProbationQuestion")))return;
 try{
  await request("POST","/api/hr/employees/confirm",{
   organization_id:S.context.organization_id,employee_id:row.id
  });
  notice(tr("approvedSaved"));await refreshView();
 }catch(e){notice(e.message)}
}
async function loadDashboard(){
 // Unknown financial or time-policy numbers are never presented as zero.
 for(const node of document.querySelectorAll("[data-metric] strong"))node.textContent="—";
 if(!signedIn())return;
 try{
  const metrics=await request("GET","/api/hr/dashboard?organization_id="+encodeURIComponent(S.context.organization_id));
  for(const key of ["employees","new","leave","absent","late","ot","salary","otPaid","advances"]){
   const node=document.querySelector('[data-metric="'+key+'"] strong');
   const value=metrics?.[key];
   node.textContent=typeof value==="number"&&Number.isFinite(value)?
    (key==="salary"||key==="otPaid"||key==="advances"?
      new Intl.NumberFormat(S.language==="th"?"th-TH":"en-US",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(value):
      new Intl.NumberFormat(S.language==="th"?"th-TH":"en-US").format(value)):"—";
  }
  const graph=$("attendance-chart");const data=metrics?.attendance_series;
  if(Array.isArray(data)&&data.length===7){
   graph.replaceChildren();
   const chart=document.createElement("div");chart.className="bar-chart";
   const max=Math.max(1,...data.map(x=>Math.max(Number(x.check_in)||0,Number(x.check_out)||0)));
   for(const d of data){
    const group=document.createElement("div");group.className="chart-day";
    const pair=document.createElement("div");pair.className="bar-pair";
    for(const [key,style] of [["check_in","in"],["check_out","out"]]){
     const bar=document.createElement("span");bar.className="bar "+style;
     bar.style.height=Math.max(2,Math.round(Math.min(100,(Number(d[key])||0)/max*100)))+"%";
     bar.title=d.day+" · "+key+": "+d[key];pair.append(bar);
    }
    const label=document.createElement("small");label.textContent=String(d.day).slice(5);
    group.append(pair,label);chart.append(group);
   }
   graph.append(chart);
  }
 }catch(e){notice("Dashboard: "+e.message)}
}
function addDefinition(node,label,value){
 const box=document.createElement("div");const dt=document.createElement("dt");dt.textContent=tr(label);
 const dd=document.createElement("dd");dd.textContent=String(value??"—")||"—";box.append(dt,dd);node.append(box);
}
function renderDetail(){
 const r=S.selected;if(!r)return;
 $("detail-reference").textContent="#"+String(r.id).slice(0,12)+" · "+safeDate(r.created_at)+(r.persisted?"":" · "+tr("temp"));
 $("approval-ribbon").hidden=r.status!=="approved";$("detail-edit").disabled=!signedIn()&&r.persisted;
 $("detail-approve").disabled=r.status!=="pending";$("detail-reject").disabled=r.status!=="pending";
 $("detail-delete").disabled=!signedIn()&&r.persisted;
 $("detail-personal").replaceChildren();$("detail-employment").replaceChildren();
 for(const [label,key] of [["applicantName","name"],["englishName","english_name"],["nationalId","national_id"],["dob","dob"],["gender","gender"],["address","address"],["issued","issued"],["expires","expires"],["phone","phone"]]){
  let val=key==="name"?r.name:r.extra?.[key];
  if(r.persisted&&!r.profileLoaded&&["national_id","address","dob"].includes(key))val="—";
  addDefinition($("detail-personal"),label,val);
 }
 for(const [label,key] of [["position","position"],["education","education"],["expectedSalary","expected_salary"],["availableDate","available_date"],["workHistory","work_history"]])
  addDefinition($("detail-employment"),label,r.extra?.[key]??"—");
 const photo=$("detail-photo");photo.replaceChildren();
 if(r.photoUrl){const im=document.createElement("img");im.src=r.photoUrl;im.alt=tr("photo");photo.append(im)}
 else photo.textContent=tr("photo");
}
async function openDetail(row){
 S.selected=row;renderDetail();navigate("applicant-detail");
 if(!row.persisted)return;
 try{
  const result=await request("GET","/api/hr/applications/detail?organization_id="+
    encodeURIComponent(S.context.organization_id)+"&application_id="+encodeURIComponent(row.id));
  if(S.selected?.id!==row.id)return;
  row.extra=result?.fields||{};
  releasePhoto(row);
  const photo=result?.photo;
  if(photo?.base64&&["image/jpeg","image/png","image/webp"].includes(photo.mime)){
   const binary=atob(photo.base64),bytes=Uint8Array.from(binary,x=>x.charCodeAt(0));
   if(bytes.length<=262144)row.photoUrl=URL.createObjectURL(new Blob([bytes],{type:photo.mime}));
  }
  row.profileLoaded=true;renderDetail();
 }catch(e){
  notice("ยังโหลดรายละเอียดใบสมัครไม่สำเร็จ กรุณาลองเปิดรายการใหม่: "+e.message);
 }
}
$("detail-back").addEventListener("click",()=>navigate("applicants"));
$("detail-print").addEventListener("click",()=>{if(!S.selected)return;window.print()});
$("detail-edit").addEventListener("click",()=>{
 if(!S.selected){notice(tr("editLocked"));return}
 S.draftEditing=S.selected;showModal(S.selected);
 if(S.selected.persisted)notice(tr("limitedEdit"));
});
$("detail-delete").addEventListener("click",async()=>{
 const r=S.selected;if(!r)return;
 if(r.persisted&&r.status==="approved"&&r.employee_id){
  const staff=S.roster.find(x=>x.id===r.employee_id);
  if(!staff||staff.status!=="terminated"){
   notice("ต้องยุติการจ้างพนักงานที่เชื่อมโยงก่อน จึงจะเก็บใบสมัครนี้เข้าคลังได้");
   return;
  }
 }
 if(!confirm(tr("confirmDelete")))return;
 if(r.persisted){
  if(!signedIn())return notice(tr("loginRequired"));
  const reason=prompt(tr("archiveReason"),"entered_in_error");
  if(reason===null)return;
  if(!["withdrawn","duplicate","entered_in_error"].includes(reason))
   return notice(tr("archiveReason"));
  try{
   await request("POST","/api/hr/applications/archive",{
    organization_id:S.context.organization_id,application_id:r.id,reason
   });
   S.selected=null;navigate("applicants");await refreshView();notice(tr("archiveDone"));
  }catch(e){notice(e.message)}
  return;
 }
 S.localDrafts=S.localDrafts.filter(x=>x!==r);releasePhoto(r);S.selected=null;
 navigate("applicants");renderApplicants();renderEmployees();
});
$("detail-reject").addEventListener("click",async()=>{
 const r=S.selected;
 if(!r||r.status!=="pending"||!confirm("ยืนยันว่าผู้สมัครรายนี้ไม่ผ่านการคัดเลือก?"))return;
 if(r.persisted){
  try{
   await request("POST","/api/hr/applications/review",{
    organization_id:S.context.organization_id,application_id:r.id,decision:"rejected"
   });
   notice("บันทึกผลไม่ผ่านการคัดเลือกแล้ว");await refreshView();
   const updated=S.records.find(x=>x.id===r.id);
   if(updated)openDetail(updated);
  }catch(err){notice("เปลี่ยนสถานะไม่สำเร็จ: "+err.message)}
 }else{
  r.status="rejected";renderDetail();renderApplicants();
 }
});
$("detail-approve").addEventListener("click",async()=>{
 const r=S.selected;if(!r||r.status!=="pending"||!confirm(tr("confirmApprove")))return;
 const code=prompt(tr("approvePrompt"));if(code===null)return;
 if(!/^[a-zA-Z0-9._-]{2,48}$/.test(code)){notice(tr("wrongCode"));return}
 if(r.persisted){
  try{
   await request("POST","/api/hr/applications/review",{
    organization_id:S.context.organization_id,application_id:r.id,decision:"approved",employee_code:code});
   r.status="approved";r.employee_code=code;
   await refreshView();navigate("employees");
   notice("อนุมัติแล้ว ย้ายรายการไปยังเมนูพนักงานผ่านโปร / บรรจุแล้ว");
  }catch(e){notice(e.message);return}
 }else{r.status="approved";r.employee_code=code;notice(tr("demoApproved"))}
 renderDetail();renderApplicants();renderEmployees();
});
function showModal(r=null){
 const form=$("applicant-form");form.reset();S.draftEditing=r;
 // Persisted application amendments are minimal & audited; never silently save card fields.
 for(const input of form.querySelectorAll("input,select,textarea"))
  input.disabled=false;
 if(r?.persisted&&!r.profileLoaded){
  notice("กรุณารอให้ระบบโหลดรายละเอียดใบสมัครก่อนแก้ไข");
  return;
 }
 if(r?.extra){for(const [key,val] of Object.entries({...r.extra,full_name:r.name})){
  const field=form.elements.namedItem(key);if(field&&field.type!=="file")field.value=String(val??"");
 }}else if(r)form.elements.namedItem("full_name").value=r.name;
 if(r?.persisted)form.elements.namedItem("consent").checked=true;
 if(typeof $("applicant-dialog").showModal==="function")$("applicant-dialog").showModal();
}
$("add-applicant").addEventListener("click",()=>{S.pendingSaveKey=null;showModal()});
function closeModal(){if(typeof window.cancelReaderSession==="function")window.cancelReaderSession();$("applicant-dialog").close();S.draftEditing=null}
$("modal-close").addEventListener("click",closeModal);
$("modal-cancel").addEventListener("click",closeModal);
const keys=["english_name","national_id","dob","gender","phone","address","issuer","issued","expires","thai_prefix","english_prefix","position","education","expected_salary","available_date","work_history"];
async function draftFromForm(){
 const form=$("applicant-form"),name=String(form.elements.namedItem("full_name").value??"").trim();
 if(name.length<2||name.length>180||!form.elements.namedItem("consent").checked)throw Error(tr("privacyConfirm"));
 const extra={};for(const key of keys)extra[key]=String(form.elements.namedItem(key)?.value??"").trim();
 const photo=form.elements.namedItem("photo")?.files?.[0]||window.readerPhotoForDraft||null;if(photo&&
  (!["image/png","image/jpeg","image/webp"].includes(photo.type)||photo.size>262144))
  throw Error("เพื่อเก็บรูปได้อย่างปลอดภัย โปรดใช้รูป JPEG/PNG/WEBP ไม่เกิน 256 KB");
 return {name,extra,photo,consent:true};
}
function releasePhoto(r){if(r?.photoUrl)URL.revokeObjectURL(r.photoUrl);if(r)r.photoUrl=null}
function putDraft(data){
 const previous=S.draftEditing;
 if(previous){releasePhoto(previous);previous.name=data.name;previous.extra=data.extra;
  previous.photoUrl=data.photo?URL.createObjectURL(data.photo):null;return previous}
 const entry={id:crypto.randomUUID(),name:data.name,status:"pending",source:"hr_manual",
  created_at:new Date().toISOString(),persisted:false,extra:data.extra,
  photoUrl:data.photo?URL.createObjectURL(data.photo):null};
 S.localDrafts.unshift(entry);return entry;
}
$("modal-preview").addEventListener("click",async()=>{
 if(!confirmApplicantNotice())return;
 try{const data=await draftFromForm();const entry=putDraft(data);closeModal();renderApplicants();openDetail(entry);notice(tr("previewNotice"))}
 catch(e){alert(e.message)}
});
function confirmApplicantNotice(){
 const field=$("applicant-form").elements.namedItem("consent");
 if(field?.checked)return true;
 if(!window.confirm("ยืนยันว่าท่านได้แจ้งวัตถุประสงค์และฐานกฎหมายในการเก็บข้อมูลสมัครงานให้ผู้สมัครทราบแล้ว?"))return false;
 if(field)field.checked=true;
 return true;
}
async function photoPayload(file){
 if(!file)return null;
 if(file.size>262144||!["image/jpeg","image/png","image/webp"].includes(file.type))
  throw Error("ขนาดรูปต้องไม่เกิน 256 KB และเป็น JPEG/PNG/WEBP");
 const bytes=new Uint8Array(await file.arrayBuffer());
 let raw="";for(let i=0;i<bytes.length;i+=8192)
  raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {mime:file.type,base64:btoa(raw)};
}
$("applicant-form").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!confirmApplicantNotice())return;
 const btn=$("modal-save");btn.disabled=true;
 let committed=false;
 try{
  const data=await draftFromForm();
  if(!signedIn()){
   const temp=putDraft(data);closeModal();renderApplicants();void openDetail(temp);
   notice(tr("previewNotice"));return;
  }
  const photo=await photoPayload(data.photo);
  if(S.draftEditing?.persisted){
   const record=S.draftEditing;
   await request("POST","/api/hr/applications/update",{
    organization_id:S.context.organization_id,application_id:record.id,
    applicant_name:data.name,fields:data.extra,photo
   });
   committed=true;
   closeModal();S.selected=null;await refreshView();
   const updated=S.records.find(x=>x.id===record.id);
   if(updated)await openDetail(updated);
   notice("บันทึกการแก้ไขพร้อมรายละเอียดแล้ว");
   return;
  }
  if(!S.pendingSaveKey)S.pendingSaveKey=crypto.randomUUID();
  const saved=await request("POST","/api/hr/applications",{
   organization_id:S.context.organization_id,applicant_name:data.name,
   source:"hr_manual",idempotency_key:S.pendingSaveKey,consent_confirmed:true,
   fields:data.extra,photo
  });
  if(!saved?.id)throw Error("เซิร์ฟเวอร์ยังไม่ยืนยันหมายเลขใบสมัคร");
  committed=true;
  // Acknowledge to Android only after the transactional DB save succeeded.
  let ackError=null;
  if(typeof window.markReaderApplicationSaved==="function"){
   try{await window.markReaderApplicationSaved(saved.id)}
   catch(err){ackError=err.message}
  }
  S.pendingSaveKey=null;closeModal();S.selected=null;await refreshView();
  const row=S.records.find(x=>x.id===saved.id);
  if(row)await openDetail(row);
  notice(ackError?"บันทึกใบสมัครสำเร็จแล้ว แต่การแจ้ง Android ยังไม่สำเร็จ: "+ackError:
   "บันทึกข้อมูลผู้สมัครและรูปแล้ว สามารถเปิดรายการกลับมาตรวจสอบได้");
 }catch(err){
  // Never encourage a second POST when the first database transaction committed.
  if(committed)notice("ข้อมูลบันทึกสำเร็จแล้ว แต่โหลดหน้ารายการใหม่ไม่ได้ โปรดกดรีเฟรช: "+err.message);
  else notice("ยังบันทึกไม่สำเร็จ ข้อมูลยังอยู่ในฟอร์ม กรุณาลองอีกครั้ง: "+err.message);
 }finally{btn.disabled=false}
});
$("applicant-search").addEventListener("input",renderApplicants);
$("applicant-status").addEventListener("change",renderApplicants);
$("refresh-applicants").addEventListener("click",()=>void refreshView());
$("language").value=S.language;translate();navigate("dashboard",{silent:true});
if(!isOnline()){$("hr-login-button").disabled=true;notice(tr("apiNotReady"));}
window.addEventListener("beforeunload",()=>{for(const r of [...S.localDrafts,...S.records])releasePhoto(r)});
