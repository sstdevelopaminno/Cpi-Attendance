// Supabase invitations may fall back to the Site URL instead of the custom Redirect URL.
// Never leave an auth token in the main HR workspace URL.
if(/^#(?=.*(?:access_token|error_code)=)(?=.*type=(?:invite|recovery))/.test(location.hash)){
 location.replace("./welcome.html"+location.hash);
}
/* Cpi Attendance HR Office: ephemeral state; no browser persistence or analytics. */
const apiBase=String(window.CPI_ATTENDANCE_API_BASE??"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const I18N={
th:{
workspace:"พื้นที่ทำงาน",dashboard:"แดชบอร์ด / ภาพรวม",applicants:"ผู้สมัครงานใหม่",employees:"พนักงานผ่านโปร / บรรจุแล้ว",settings:"ตั้งค่า Android HR",testOnly:"PRODUCTION · เตรียมบัญชี HR",language:"ภาษา",hrControl:"HR CONTROL CENTER",
dashSubtitle:"สรุปบุคลากร การขาดลา มาสาย และค่าใช้จ่ายจากข้อมูลจริงขององค์กร",apiNotReady:"Attendance API เชื่อมต่อแล้ว • ลงชื่อเข้าใช้ HR เพื่อดูข้อมูลจริง",totalStaff:"พนักงานทั้งหมด",newStaff:"พนักงานใหม่",staffOnLeave:"พนักงานลา",absences:"จำนวนขาดงาน",late:"จำนวนมาสาย",otHours:"จำนวน OT",salaryPaid:"ยอดจ่ายเงินเดือน",otPaid:"ยอดจ่าย OT",advances:"ยอดเบิกเงินเดือน",
attendanceGraph:"แนวโน้มการลงเวลา",payrollGraph:"ภาพรวมค่าใช้จ่าย",last7:"7 วันล่าสุด",month:"เดือนนี้",noChart:"รอข้อมูลสรุปจากเซิร์ฟเวอร์",noPayroll:"ยังไม่มีข้อมูลการจ่ายเงินที่ตรวจรับ",
applicantsSubtitle:"จัดการใบสมัคร ตรวจสอบข้อมูล และอนุมัติรับเข้าทำงาน",addApplicant:"+ เพิ่มผู้สมัครใหม่",search:"ค้นหาชื่อหรือรหัสใบสมัคร",allStatus:"ทุกสถานะ",pending:"รอพิจารณา",approved:"ผ่านการคัดเลือก",rejected:"ไม่ผ่าน",refresh:"รีเฟรช",applicantName:"ชื่อ-นามสกุล",position:"ตำแหน่งสมัคร",source:"ช่องทาง",date:"วันที่สมัคร",status:"สถานะ",actions:"จัดการ",back:"← กลับไปผู้สมัครงาน",print:"พิมพ์ใบสมัคร",edit:"แก้ไข",delete:"ลบ",approve:"ยืนยันผ่านการคัดเลือก",passed:"ผ่านแล้ว",applicationForm:"ใบสมัครงาน",photo:"รูปถ่าย",personalInfo:"01 / ประวัติส่วนตัวและข้อมูลบัตร",thaiCardSection:"ข้อมูลจากบัตรประชาชนไทย",previewCard:"ดูข้อมูลแบบบัตร",idPreviewNotice:"ตัวอย่างการจัดวางข้อมูล ไม่ใช่ภาพบัตรราชการหรือเอกสารยืนยันตัวตน",close:"ปิดหน้าต่าง",thaiPrefix:"คำนำหน้าภาษาไทย",englishPrefix:"คำนำหน้าภาษาอังกฤษ",issuer:"ผู้ออกบัตร / นายทะเบียน",readerWaiting:"รอเชื่อมต่อ Android HR",readerConnecting:"กำลังตรวจสอบการเชื่อมต่อ",readerPaired:"เชื่อมต่อแล้ว · ออนไลน์",readerReading:"กำลังตรวจสอบและอ่านชิป",readerReceived:"อ่านชิปสำเร็จ · ตรวจสอบข้อมูลก่อนบันทึก",readerApiOffline:"ยังไม่มี Attendance API ที่เชื่อมต่อสำเร็จ กรุณาตรวจระบบก่อนอ่านบัตรจริง",readerBack:"กลับไปใบสมัคร",readerPrivacy:"ข้อมูลบัตรส่งแบบเข้ารหัสและต้องให้ HR ตรวจทานก่อนบันทึก",employmentInfo:"02 / ข้อมูลการสมัครงาน",applicantSignature:"ลงชื่อผู้สมัคร ____________________",hrSignature:"ผู้รับใบสมัคร ____________________",printPrivacy:"เอกสารข้อมูลส่วนบุคคล ใช้เฉพาะการรับสมัครตามสิทธิ์ที่ได้รับอนุญาต",employeesSubtitle:"แยกพนักงานระหว่างรอผ่านทดลองงานและบรรจุแล้ว",probationHeading:"พนักงานรอผ่านทดลองงาน",probationHelp:"ผ่านการคัดเลือกแล้ว แต่ต้องยืนยันการผ่านทดลองงานแยกต่างหาก",confirmedHeading:"พนักงานผ่านโปร / บรรจุแล้ว",confirmProbation:"ยืนยันผ่านทดลองงาน",probationStatus:"รอผ่านโปร",confirmProbationQuestion:"ยืนยันว่าพนักงานผ่านทดลองงานแล้ว? การดำเนินการจะบันทึกผู้อนุมัติและเวลา",employeeCode:"รหัสพนักงาน",
settingsSubtitle:"แยกสิทธิ์โหมดรับสมัครงานและเครื่องลงเวลาพนักงาน",modeAccess:"สิทธิ์เข้าสู่โหมดของ Android",modeHelp:"เจ้าขององค์กร/HR Admin เป็นผู้เพิ่มและจัดการเครื่อง Android กำหนดโหมดและสิทธิ์เองภายในแพ็กเกจ ไม่ต้องรออนุมัติจาก IT",modeHr:"HR Enrollment",hrModeDesc:"อ่านบัตรเพื่อตรวจใบสมัคร และส่งข้อมูลขั้นต่ำ",kioskModeDesc:"เสียบบัตรลงเวลา ไม่แสดงข้อมูลส่วนบุคคล",locked:"รอเปิดระบบตั้งค่าโดย HR",modeSecurity:"เจ้าขององค์กร/HR Admin จัดการการเข้าโหมดและอุปกรณ์เอง ขณะนี้หน้าตั้งค่ายังไม่เปิดใช้งาน ห้ามเก็บ PIN หรือรหัส HR แบบข้อความธรรมดาและต้องตรวจจำนวนอุปกรณ์ตามแพ็กเกจจากเซิร์ฟเวอร์",
login:"เข้าสู่ระบบ HR",loginSubtitle:"ลงชื่อเข้าใช้ด้วยบัญชีที่เจ้าขององค์กรหรือ HR Admin ของผู้เช่าจัดการเอง เพื่อเข้าถึงข้อมูลเฉพาะองค์กร",orgCode:"รหัสองค์กร 6 หลัก",userCode:"รหัส Owner / HR Admin",password:"รหัสผ่าน",logout:"ออกจากระบบ",englishName:"ชื่อภาษาอังกฤษ",nationalId:"เลขบัตรประชาชน",dob:"วันเกิด",gender:"เพศ",male:"ชาย",female:"หญิง",other:"อื่น ๆ",phone:"เบอร์โทร",address:"ที่อยู่ตามบัตร",issued:"วันออกบัตร",expires:"วันหมดอายุบัตร",photoWarning:"รูปอยู่ในหน่วยความจำของหน้าเว็บ ไม่ถูกอัปโหลดหรือบันทึกในรุ่นนี้",androidReader:"สามารถนำเข้าจาก Android HR ได้หลังผ่านการตรวจอุปกรณ์และสิทธิ์",readCard:"เปิดรับข้อมูลจาก Android HR",education:"การศึกษา",expectedSalary:"เงินเดือนที่ต้องการ",availableDate:"เริ่มงานได้",workHistory:"ประวัติการทำงานเพิ่มเติม",privacyConfirm:"ได้รับการแจ้งวัตถุประสงค์และฐานกฎหมายในการใช้ข้อมูลเพื่อสมัครงานแล้ว",saveLimit:"รุ่นทดสอบ API รับเฉพาะชื่อผู้สมัครและหลักฐานการแจ้งวัตถุประสงค์ ข้อมูลบัตร/ภาพอยู่ในเครื่องเท่านั้น",cancel:"ยกเลิก",preview:"ดูใบสมัคร / พิมพ์",saveApplicant:"บันทึกใบสมัคร",noCandidates:"ยังไม่มีผู้สมัครงานในองค์กรนี้",noEmployees:"ยังไม่มีรายชื่อพนักงานที่ได้รับอนุญาต",view:"เปิดดู",temp:"ร่างชั่วคราว",previewNotice:"โหมดตัวอย่าง: ข้อมูลนี้อยู่เฉพาะในหน่วยความจำและจะหายเมื่อปิดหน้าเว็บ",loginRequired:"ต้องเข้าสู่ระบบ HR ก่อนจึงจะบันทึกบนเซิร์ฟเวอร์ได้",serverSave:"บันทึกชื่อผู้สมัครเข้าสู่ API แล้ว ข้อมูลบัตรและภาพยังไม่บันทึก",printWarning:"ใบสมัครนี้ประกอบด้วยข้อมูลส่วนบุคคล โปรดรักษาเอกสารให้ปลอดภัย",approvePrompt:"ระบุรหัสพนักงาน (2–48 ตัว)",confirmApprove:"ยืนยันผ่านการคัดเลือกและล็อกการแก้ไขรายการ?",confirmDelete:"ยืนยันลบร่างชั่วคราวนี้?",deleteUnavailable:"การลบข้อมูลจริงต้องผ่านขั้นตอนลบอย่างปลอดภัยและบันทึก Audit Trail",editLocked:"ใบสมัครที่อนุมัติแล้วถูกล็อก ไม่สามารถแก้ไขโดยตรงได้",limitedEdit:"แก้ไขชื่อผู้สมัครได้เท่านั้น ข้อมูลบัตรและรูปยังไม่บันทึกบนเซิร์ฟเวอร์",archiveReason:"ระบุเหตุผล: withdrawn / duplicate / entered_in_error",archiveDone:"ถอนใบสมัครโดยบันทึก Audit Trail แล้ว",pendingReview:"รอพิจารณา",sourceAndroid:"Android HR",sourceWeb:"HR Web",safeNotice:"ไม่มีการเปิดเผยข้อมูลบัตรจากชิปหรือภาพในรายการตาราง",approvedSaved:"อนุมัติและสร้างรหัสพนักงานแล้ว",demoApproved:"ตัวอย่างการอนุมัติ — ยังไม่บันทึกเซิร์ฟเวอร์",wrongCode:"รูปแบบรหัสพนักงานไม่ถูกต้อง"
},
en:{
workspace:"WORKSPACE",dashboard:"Dashboard / Overview",applicants:"New Applicants",employees:"Confirmed Employees",settings:"Android HR Settings",testOnly:"PRODUCTION · HR setup required",language:"Language",hrControl:"HR CONTROL CENTER",
dashSubtitle:"Organization staffing, attendance and verified payroll overview",apiNotReady:"Attendance API connected • Sign in with your authorized HR account.",totalStaff:"Total employees",newStaff:"New employees",staffOnLeave:"On leave",absences:"Absences",late:"Late arrivals",otHours:"Overtime",salaryPaid:"Salary paid",otPaid:"OT paid",advances:"Salary advances",
attendanceGraph:"Attendance trend",payrollGraph:"Payroll overview",last7:"Last 7 days",month:"This month",noChart:"Awaiting verified server data",noPayroll:"No verified payroll data yet",
applicantsSubtitle:"Review applications, verify submitted details and approve employment",addApplicant:"+ New applicant",search:"Search names or application ID",allStatus:"All statuses",pending:"Pending review",approved:"Approved",rejected:"Rejected",refresh:"Refresh",applicantName:"Full name",position:"Position applied for",source:"Source",date:"Application date",status:"Status",actions:"Actions",back:"← Back to applicants",print:"Print application",edit:"Edit",delete:"Delete",approve:"Approve employment",passed:"APPROVED",applicationForm:"Job application",photo:"Photo",personalInfo:"01 / Personal and ID information",thaiCardSection:"Thai National ID fields",previewCard:"View card layout",idPreviewNotice:"Layout illustration only; not an official identity document",close:"Close",thaiPrefix:"Thai name prefix",englishPrefix:"English name prefix",issuer:"Card issuing authority",readerWaiting:"Waiting for Android HR",readerConnecting:"Connecting to Android HR",readerPaired:"Connected · online",readerReading:"Verifying and reading chip",readerReceived:"Read complete · verify before saving",readerApiOffline:"Attendance API connection unavailable. Do not read real cards until configured.",readerBack:"Back to application",readerPrivacy:"Card data is encrypted and requires HR review before saving.",employmentInfo:"02 / Employment application",applicantSignature:"Applicant signature ____________________",hrSignature:"HR signature ____________________",printPrivacy:"Confidential applicant data. Restricted to authorized recruitment use.",employeesSubtitle:"Probation and confirmed employees are listed separately",probationHeading:"Employees in probation",probationHelp:"Recruitment approval does not mean probation has been completed.",confirmedHeading:"Confirmed employees",confirmProbation:"Confirm probation passed",probationStatus:"In probation",confirmProbationQuestion:"Confirm this employee passed probation? Approver and time will be audited.",employeeCode:"Employee ID",
settingsSubtitle:"Separate permissions for HR onboarding and employee attendance kiosks",modeAccess:"Android mode permissions",modeHelp:"Subscriber Owner/HR Admin configures Android devices, sites and HR/Kiosk modes inside the purchased plan; IT does not approve individual devices.",modeHr:"HR Enrollment",hrModeDesc:"Review chip data and submit minimal application information",kioskModeDesc:"Clock in/out without displaying personal chip data",locked:"Tenant HR setup not yet active",modeSecurity:"Subscriber HR manages devices and mode access without IT approval. Settings are not live yet; do not store plain-text PINs or passwords. Validate tenant, device and commercial package limits server-side.",
login:"HR Sign in",loginSubtitle:"Sign in with an account granted by your own organization's Owner/HR Admin to access your tenant's data",orgCode:"6-digit organization code",userCode:"Owner / HR Admin code",password:"Password",logout:"Log out",englishName:"Name in English",nationalId:"National ID number",dob:"Date of birth",gender:"Gender",male:"Male",female:"Female",other:"Other",phone:"Phone",address:"Registered address",issued:"ID issued",expires:"ID expiry",photoWarning:"Photo is previewed in browser memory only; not uploaded in this version.",androidReader:"Android HR import requires authorized device pairing and API approval",readCard:"Import from Android HR (disabled)",education:"Education",expectedSalary:"Expected salary",availableDate:"Available from",workHistory:"Work history",privacyConfirm:"Appropriate privacy notice and lawful processing basis have been confirmed.",saveLimit:"Test API only accepts applicant name and privacy notice confirmation. ID/photo remain on this device.",cancel:"Cancel",preview:"Preview / Print",saveApplicant:"Save application",noCandidates:"No applicants found",noEmployees:"No authorized employees found",view:"View details",temp:"Local draft",previewNotice:"Preview only: this record is held in memory and will disappear when this page closes.",loginRequired:"Sign in as authorized HR to save to the API.",serverSave:"Applicant name saved via API; chip details and photo were not uploaded.",printWarning:"This printout contains personal data. Store securely.",approvePrompt:"Employee ID (2–48 characters)",confirmApprove:"Approve this applicant and lock the record?",confirmDelete:"Delete this local draft?",deleteUnavailable:"Deleting real records requires a secured audited backend workflow.",editLocked:"Approved applications are locked and cannot be edited directly.",limitedEdit:"Only applicant name can be edited on the server. ID/photo remain local only.",archiveReason:"Reason: withdrawn / duplicate / entered_in_error",archiveDone:"Application archived with an audit record.",pendingReview:"Pending review",sourceAndroid:"Android HR",sourceWeb:"HR Web",safeNotice:"Raw chip data and images are never shown in table rows.",approvedSaved:"Approved and assigned internal employee ID",demoApproved:"Demonstration approval only; no server write",wrongCode:"Invalid employee ID"
}};
const S={language:"th",screen:"dashboard",token:"",context:null,expiresAt:0,records:[],roster:[],selected:null,localDrafts:[],draftEditing:null,readerSession:null};
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
async function request(method,path,body){
 if(!signedIn()&&!["/api/auth/login","/api/auth/request-password-setup"].includes(path))throw Error(tr("loginRequired"));
 if(!isOnline())throw Error(tr("apiNotReady"));
 const response=await fetch(apiBase+path,{method,headers:{"Content-Type":"application/json",...(S.token?{Authorization:"Bearer "+S.token}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error??"request_rejected");
 return payload.data;
}
function logout(){
 if(typeof window.cancelReaderSession==="function")window.cancelReaderSession();
 for(const r of S.records)releasePhoto(r);
 S.token="";S.context=null;S.expiresAt=0;S.records=[];S.roster=[];S.selected=null;
 $("hr-login").hidden=false;$("session-bar").hidden=true;$("hr-password").value="";
 refreshView();notice(tr("apiNotReady"));
}
$("hr-login-form").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("hr-login-button");btn.disabled=true;
 try{
  const v=await request("POST","/api/auth/login",{
   organization_code:$("hr-org-code").value.trim(),employee_code:$("hr-user-code").value.trim(),password:$("hr-password").value
  });
  if(!["owner","hr_admin"].includes(v?.context?.role))throw Error("hr_role_forbidden");
  S.token=v.access_token;S.context=v.context;S.expiresAt=Date.now()+Math.min(v.expires_in??3600,3600)*1000-20000;
  $("hr-password").value="";$("hr-login").hidden=true;$("session-bar").hidden=false;
  $("session-label").textContent=v.context.organization_name+" · "+v.context.role;notice("✓ "+v.context.organization_name);
  await refreshView();
 }catch(error){logout();notice(error.message)}finally{btn.disabled=false}
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
$("hr-logout").addEventListener("click",logout);
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
 const records=combined().filter(x=>(status==="all"||x.status===status)&&
  (!q||(x.name+" "+x.id).toLowerCase().includes(q)));
 const body=$("applicant-rows");body.replaceChildren();
 for(const row of records){
  const trEl=document.createElement("tr");
  const first=td("");first.append(rowButton(row.name,()=>openDetail(row)));trEl.append(first);
  trEl.append(td(row.extra?.position??"—"),td(row.source==="android_hr"?tr("sourceAndroid"):tr("sourceWeb")),td(safeDate(row.created_at)));
  const badge=td("");badge.append(statusChip(row.status));trEl.append(badge);
  const action=td("");action.append(rowButton(tr("view"),()=>openDetail(row)));trEl.append(action);body.append(trEl);
 }
 if(!records.length){const trEl=document.createElement("tr");const cell=td(tr("noCandidates"));cell.colSpan=6;cell.style.textAlign="center";cell.style.padding="40px";trEl.append(cell);body.append(trEl)}
 $("pending-count").textContent=String(combined().filter(x=>x.status==="pending").length||"—");
 $("applicant-note").textContent=signedIn()?tr("safeNotice"):tr("previewNotice");
}
function renderEmployees(){
 const confirmed=$("employee-rows"),pending=$("probation-rows");
 confirmed.replaceChildren();pending.replaceChildren();
 let nConfirmed=0,nPending=0;
 for(const row of S.roster.filter(x=>x.status==="active")){
  const isConfirmed=row.probation_status==="confirmed";
  const trEl=document.createElement("tr");
  trEl.append(td(row.code??"—"),td(row.name??"—"));
  if(isConfirmed){
   trEl.append(td("—"));
   const status=td("");status.append(statusChip("approved"));trEl.append(status,td("—"));
   confirmed.append(trEl);nConfirmed++;
  }else{
   const status=td("");const chip=statusChip("pending");chip.textContent=tr("probationStatus");status.append(chip);
   const action=td("");
   if(signedIn()&&["owner","hr_admin"].includes(S.context?.role)){
    action.append(rowButton(tr("confirmProbation"),()=>void confirmProbation(row)));
   }else action.textContent="—";
   trEl.append(status,action);pending.append(trEl);nPending++;
  }
 }
 // Local demo approvals remain probationary; never count as confirmed.
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
 $("approval-ribbon").hidden=r.status!=="approved";$("detail-edit").disabled=r.status==="approved";
 $("detail-approve").disabled=r.status!=="pending";$("detail-delete").disabled=r.status!=="pending";
 $("detail-personal").replaceChildren();$("detail-employment").replaceChildren();
 for(const [label,key] of [["applicantName","name"],["englishName","english_name"],["nationalId","national_id"],["dob","dob"],["gender","gender"],["address","address"],["issued","issued"],["expires","expires"],["phone","phone"]]){
  let val=key==="name"?r.name:r.extra?.[key];
  if(r.persisted&&!r.localPreview&&["national_id","address","dob"].includes(key))val="—"; // Never assert stored card fields.
  addDefinition($("detail-personal"),label,val);
 }
 for(const [label,key] of [["position","position"],["education","education"],["expectedSalary","expected_salary"],["availableDate","available_date"],["workHistory","work_history"]])
  addDefinition($("detail-employment"),label,r.extra?.[key]??"—");
 const photo=$("detail-photo");photo.replaceChildren();
 if(r.photoUrl&&(!r.persisted||r.localPreview)){const im=document.createElement("img");im.src=r.photoUrl;im.alt=tr("photo");photo.append(im)}
 else photo.textContent=tr("photo");
}
function openDetail(row){S.selected=row;renderDetail();navigate("applicant-detail")}
$("detail-back").addEventListener("click",()=>navigate("applicants"));
$("detail-print").addEventListener("click",()=>{if(!S.selected)return;window.print()});
$("detail-edit").addEventListener("click",()=>{
 if(!S.selected||S.selected.status!=="pending"){notice(tr("editLocked"));return}
 S.draftEditing=S.selected;showModal(S.selected);
 if(S.selected.persisted)notice(tr("limitedEdit"));
});
$("detail-delete").addEventListener("click",async()=>{
 const r=S.selected;if(!r||r.status!=="pending")return;
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
$("detail-approve").addEventListener("click",async()=>{
 const r=S.selected;if(!r||r.status!=="pending"||!confirm(tr("confirmApprove")))return;
 const code=prompt(tr("approvePrompt"));if(code===null)return;
 if(!/^[a-zA-Z0-9._-]{2,48}$/.test(code)){notice(tr("wrongCode"));return}
 if(r.persisted){
  try{
   await request("POST","/api/hr/applications/review",{
    organization_id:S.context.organization_id,application_id:r.id,decision:"approved",employee_code:code});
   r.status="approved";r.employee_code=code;notice(tr("approvedSaved"));await refreshView();
  }catch(e){notice(e.message);return}
 }else{r.status="approved";r.employee_code=code;notice(tr("demoApproved"))}
 renderDetail();renderApplicants();renderEmployees();
});
function showModal(r=null){
 const form=$("applicant-form");form.reset();S.draftEditing=r;
 // Persisted application amendments are minimal & audited; never silently save card fields.
 for(const input of form.querySelectorAll("input,select,textarea"))
  input.disabled=!!(r?.persisted&&!["full_name","consent"].includes(input.name));
 if(r?.extra){for(const [key,val] of Object.entries({...r.extra,full_name:r.name})){
  const field=form.elements.namedItem(key);if(field&&field.type!=="file")field.value=String(val??"");
 }}else if(r)form.elements.namedItem("full_name").value=r.name;
 if(typeof $("applicant-dialog").showModal==="function")$("applicant-dialog").showModal();
}
$("add-applicant").addEventListener("click",()=>showModal());
function closeModal(){if(typeof window.cancelReaderSession==="function")window.cancelReaderSession();$("applicant-dialog").close();S.draftEditing=null}
$("modal-close").addEventListener("click",closeModal);
$("modal-cancel").addEventListener("click",closeModal);
const keys=["english_name","national_id","dob","gender","phone","address","issuer","issued","expires","thai_prefix","english_prefix","position","education","expected_salary","available_date","work_history"];
async function draftFromForm(){
 const form=$("applicant-form"),name=String(form.elements.namedItem("full_name").value??"").trim();
 if(name.length<2||name.length>180||!form.elements.namedItem("consent").checked)throw Error(tr("privacyConfirm"));
 const extra={};for(const key of keys)extra[key]=String(form.elements.namedItem(key)?.value??"").trim();
 const photo=form.elements.namedItem("photo")?.files?.[0]||window.readerPhotoForDraft||null;if(photo&&
  (!["image/png","image/jpeg","image/webp"].includes(photo.type)||photo.size>2*1024*1024))
  throw Error("Photo must be PNG/JPEG/WEBP under 2 MB");
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
 try{const data=await draftFromForm();const entry=putDraft(data);closeModal();renderApplicants();openDetail(entry);notice(tr("previewNotice"))}
 catch(e){alert(e.message)}
});
$("applicant-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const btn=$("modal-save");btn.disabled=true;
 try{
  const data=await draftFromForm();
  if(!signedIn()){
   const temp=putDraft(data);closeModal();renderApplicants();openDetail(temp);notice(tr("previewNotice"));return;
  }
  if(S.draftEditing?.persisted){
   const record=S.draftEditing;
   await request("POST","/api/hr/applications/update",{
    organization_id:S.context.organization_id,application_id:record.id,
    applicant_name:data.name
   });
   closeModal();S.selected=null;await refreshView();
   const updated=S.records.find(x=>x.id===record.id);
   if(updated)openDetail(updated);
   notice(tr("limitedEdit"));return;
  }
  const saved=await request("POST","/api/hr/applications",{
   organization_id:S.context.organization_id,applicant_name:data.name,
   source:"hr_manual",idempotency_key:crypto.randomUUID(),consent_confirmed:true
  });
  if(!saved?.id)throw Error("No application reference received");
  // Confirm to Android only AFTER the minimal application is committed.
  // If receipt acknowledgement fails, never roll back the saved application.
  if(typeof window.markReaderApplicationSaved==="function"){
   try{await window.markReaderApplicationSaved(saved.id)}
   catch(err){notice("Saved, but Android acknowledgement pending: "+err.message)}
  }
  // No national ID, address, image, DOB or other PII is sent by this endpoint.
  if(data.photo)notice(tr("saveLimit"));
  closeModal();await refreshView();const row=S.records.find(x=>x.id===saved.id);
  if(row){
   // Sensitive card information remains a one-session print preview only.
   row.extra=data.extra;row.localPreview=true;
   row.photoUrl=data.photo?URL.createObjectURL(data.photo):null;
   openDetail(row);
  }
  notice(tr("serverSave")+" · "+tr("printWarning"));
 }catch(err){alert(err.message)}finally{btn.disabled=false}
});
$("applicant-search").addEventListener("input",renderApplicants);
$("applicant-status").addEventListener("change",renderApplicants);
$("refresh-applicants").addEventListener("click",()=>void refreshView());
$("language").value=S.language;translate();navigate("dashboard",{silent:true});
if(!isOnline()){$("hr-login-button").disabled=true;notice(tr("apiNotReady"));}
window.addEventListener("beforeunload",()=>{for(const r of [...S.localDrafts,...S.records])releasePhoto(r)});
