/* Cpi Attendance HR Office: ephemeral state; no browser persistence or analytics. */
const apiBase=String(window.CPI_ATTENDANCE_API_BASE??"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const I18N={
th:{
workspace:"พื้นที่ทำงาน",dashboard:"แดชบอร์ด / ภาพรวม",applicants:"ผู้สมัครงานใหม่",employees:"พนักงานผ่านโปร / บรรจุแล้ว",settings:"ตั้งค่า Android HR",testOnly:"ทดสอบระบบ · ไม่ใช่ Production",language:"ภาษา",hrControl:"HR CONTROL CENTER",
dashSubtitle:"สรุปบุคลากร การขาดลา มาสาย และค่าใช้จ่ายจากข้อมูลจริงขององค์กร",apiNotReady:"API ยังไม่เปิดใช้งานจริง ตัวเลขจะแสดงเมื่อมีข้อมูลที่ตรวจสอบได้",totalStaff:"พนักงานทั้งหมด",newStaff:"พนักงานใหม่",staffOnLeave:"พนักงานลา",absences:"จำนวนขาดงาน",late:"จำนวนมาสาย",otHours:"จำนวน OT",salaryPaid:"ยอดจ่ายเงินเดือน",otPaid:"ยอดจ่าย OT",advances:"ยอดเบิกเงินเดือน",
attendanceGraph:"แนวโน้มการลงเวลา",payrollGraph:"ภาพรวมค่าใช้จ่าย",last7:"7 วันล่าสุด",month:"เดือนนี้",noChart:"รอข้อมูลสรุปจากเซิร์ฟเวอร์",noPayroll:"ยังไม่มีข้อมูลการจ่ายเงินที่ตรวจรับ",
applicantsSubtitle:"จัดการใบสมัคร ตรวจสอบข้อมูล และอนุมัติรับเข้าทำงาน",addApplicant:"+ เพิ่มผู้สมัครใหม่",search:"ค้นหาชื่อหรือรหัสใบสมัคร",allStatus:"ทุกสถานะ",pending:"รอพิจารณา",approved:"ผ่านการคัดเลือก",rejected:"ไม่ผ่าน",refresh:"รีเฟรช",applicantName:"ชื่อ-นามสกุล",position:"ตำแหน่งสมัคร",source:"ช่องทาง",date:"วันที่สมัคร",status:"สถานะ",actions:"จัดการ",back:"← กลับไปผู้สมัครงาน",print:"พิมพ์ใบสมัคร",edit:"แก้ไข",delete:"ลบ",approve:"ยืนยันผ่านการคัดเลือก",passed:"ผ่านแล้ว",applicationForm:"ใบสมัครงาน",photo:"รูปถ่าย",personalInfo:"01 / ประวัติส่วนตัวและข้อมูลบัตร",employmentInfo:"02 / ข้อมูลการสมัครงาน",applicantSignature:"ลงชื่อผู้สมัคร ____________________",hrSignature:"ผู้รับใบสมัคร ____________________",printPrivacy:"เอกสารข้อมูลส่วนบุคคล ใช้เฉพาะการรับสมัครตามสิทธิ์ที่ได้รับอนุญาต",employeesSubtitle:"รายชื่อผู้ที่ผ่านการคัดเลือกและบรรจุตามทะเบียนพนักงาน",employeeCode:"รหัสพนักงาน",
settingsSubtitle:"แยกสิทธิ์โหมดรับสมัครงานและเครื่องลงเวลาพนักงาน",modeAccess:"สิทธิ์เข้าสู่โหมดของ Android",modeHelp:"โหมด HR ต้องยืนยันบัญชี HR และสิทธิ์อุปกรณ์ ส่วนโหมด Kiosk ต้องจับคู่อุปกรณ์กับสาขา โดยไม่ใช้ PIN ที่เก็บในหน้าเว็บ",modeHr:"HR Enrollment",hrModeDesc:"อ่านบัตรเพื่อตรวจใบสมัคร และส่งข้อมูลขั้นต่ำ",kioskModeDesc:"เสียบบัตรลงเวลา ไม่แสดงข้อมูลส่วนบุคคล",locked:"รอเปิดสิทธิ์จาก IT",modeSecurity:"ไม่เก็บรหัสผ่าน HR แบบข้อความธรรมดา ต้องออกสิทธิ์ตามบัญชี HR, องค์กร, อุปกรณ์และแพ็กเกจจากเซิร์ฟเวอร์",
login:"เข้าสู่ระบบ HR",loginSubtitle:"ลงชื่อเข้าใช้ด้วยบัญชีที่ IT/HR อนุมัติ จึงจะเรียกดูหรือจัดการข้อมูลจริงได้",orgCode:"รหัสองค์กร",userCode:"รหัส HR",password:"รหัสผ่าน",logout:"ออกจากระบบ",englishName:"ชื่อภาษาอังกฤษ",nationalId:"เลขบัตรประชาชน",dob:"วันเกิด",gender:"เพศ",male:"ชาย",female:"หญิง",other:"อื่น ๆ",phone:"เบอร์โทร",address:"ที่อยู่ตามบัตร",issued:"วันออกบัตร",expires:"วันหมดอายุบัตร",photoWarning:"รูปอยู่ในหน่วยความจำของหน้าเว็บ ไม่ถูกอัปโหลดหรือบันทึกในรุ่นนี้",androidReader:"สามารถนำเข้าจาก Android HR ได้หลังผ่านการตรวจอุปกรณ์และสิทธิ์",readCard:"อ่านจาก Android HR (ยังไม่เปิด)",education:"การศึกษา",expectedSalary:"เงินเดือนที่ต้องการ",availableDate:"เริ่มงานได้",workHistory:"ประวัติการทำงานเพิ่มเติม",privacyConfirm:"ได้รับการแจ้งวัตถุประสงค์และฐานกฎหมายในการใช้ข้อมูลเพื่อสมัครงานแล้ว",saveLimit:"รุ่นทดสอบ API รับเฉพาะชื่อผู้สมัครและหลักฐานการแจ้งวัตถุประสงค์ ข้อมูลบัตร/ภาพอยู่ในเครื่องเท่านั้น",cancel:"ยกเลิก",preview:"ดูใบสมัคร / พิมพ์",saveApplicant:"บันทึกใบสมัคร",noCandidates:"ยังไม่มีผู้สมัครงานในองค์กรนี้",noEmployees:"ยังไม่มีรายชื่อพนักงานที่ได้รับอนุญาต",view:"เปิดดู",temp:"ร่างชั่วคราว",previewNotice:"โหมดตัวอย่าง: ข้อมูลนี้อยู่เฉพาะในหน่วยความจำและจะหายเมื่อปิดหน้าเว็บ",loginRequired:"ต้องเข้าสู่ระบบ HR ก่อนจึงจะบันทึกบนเซิร์ฟเวอร์ได้",serverSave:"บันทึกชื่อผู้สมัครเข้าสู่ API แล้ว ข้อมูลบัตรและภาพยังไม่บันทึก",printWarning:"ใบสมัครนี้ประกอบด้วยข้อมูลส่วนบุคคล โปรดรักษาเอกสารให้ปลอดภัย",approvePrompt:"ระบุรหัสพนักงาน (2–48 ตัว)",confirmApprove:"ยืนยันผ่านการคัดเลือกและล็อกการแก้ไขรายการ?",confirmDelete:"ยืนยันลบร่างชั่วคราวนี้?",deleteUnavailable:"การลบข้อมูลจริงต้องผ่านขั้นตอนลบอย่างปลอดภัยและบันทึก Audit Trail",editLocked:"ใบสมัครที่อนุมัติแล้วถูกล็อก ไม่สามารถแก้ไขโดยตรงได้",pendingReview:"รอพิจารณา",sourceAndroid:"Android HR",sourceWeb:"HR Web",safeNotice:"ไม่มีการเปิดเผยข้อมูลบัตรจากชิปหรือภาพในรายการตาราง",approvedSaved:"อนุมัติและสร้างรหัสพนักงานแล้ว",demoApproved:"ตัวอย่างการอนุมัติ — ยังไม่บันทึกเซิร์ฟเวอร์",wrongCode:"รูปแบบรหัสพนักงานไม่ถูกต้อง"
},
en:{
workspace:"WORKSPACE",dashboard:"Dashboard / Overview",applicants:"New Applicants",employees:"Confirmed Employees",settings:"Android HR Settings",testOnly:"Test environment · Not Production",language:"Language",hrControl:"HR CONTROL CENTER",
dashSubtitle:"Organization staffing, attendance and verified payroll overview",apiNotReady:"Attendance API is not active. Numbers appear only when verified records are available.",totalStaff:"Total employees",newStaff:"New employees",staffOnLeave:"On leave",absences:"Absences",late:"Late arrivals",otHours:"Overtime",salaryPaid:"Salary paid",otPaid:"OT paid",advances:"Salary advances",
attendanceGraph:"Attendance trend",payrollGraph:"Payroll overview",last7:"Last 7 days",month:"This month",noChart:"Awaiting verified server data",noPayroll:"No verified payroll data yet",
applicantsSubtitle:"Review applications, verify submitted details and approve employment",addApplicant:"+ New applicant",search:"Search names or application ID",allStatus:"All statuses",pending:"Pending review",approved:"Approved",rejected:"Rejected",refresh:"Refresh",applicantName:"Full name",position:"Position applied for",source:"Source",date:"Application date",status:"Status",actions:"Actions",back:"← Back to applicants",print:"Print application",edit:"Edit",delete:"Delete",approve:"Approve employment",passed:"APPROVED",applicationForm:"Job application",photo:"Photo",personalInfo:"01 / Personal and ID information",employmentInfo:"02 / Employment application",applicantSignature:"Applicant signature ____________________",hrSignature:"HR signature ____________________",printPrivacy:"Confidential applicant data. Restricted to authorized recruitment use.",employeesSubtitle:"Approved and registered employees",employeeCode:"Employee ID",
settingsSubtitle:"Separate permissions for HR onboarding and employee attendance kiosks",modeAccess:"Android mode permissions",modeHelp:"HR mode requires a verified HR session and device grants. Kiosk mode requires IT-controlled device pairing, never a PIN stored on the web client.",modeHr:"HR Enrollment",hrModeDesc:"Review chip data and submit minimal application information",kioskModeDesc:"Clock in/out without displaying personal chip data",locked:"IT activation required",modeSecurity:"Do not store plain HR mode passwords. Require server-side HR account, tenant, paired-device and package authorization.",
login:"HR Sign in",loginSubtitle:"Verified IT/HR accounts are required before accessing real data",orgCode:"Organization code",userCode:"HR user code",password:"Password",logout:"Log out",englishName:"Name in English",nationalId:"National ID number",dob:"Date of birth",gender:"Gender",male:"Male",female:"Female",other:"Other",phone:"Phone",address:"Registered address",issued:"ID issued",expires:"ID expiry",photoWarning:"Photo is previewed in browser memory only; not uploaded in this version.",androidReader:"Android HR import requires authorized device pairing and API approval",readCard:"Import from Android HR (disabled)",education:"Education",expectedSalary:"Expected salary",availableDate:"Available from",workHistory:"Work history",privacyConfirm:"Appropriate privacy notice and lawful processing basis have been confirmed.",saveLimit:"Test API only accepts applicant name and privacy notice confirmation. ID/photo remain on this device.",cancel:"Cancel",preview:"Preview / Print",saveApplicant:"Save application",noCandidates:"No applicants found",noEmployees:"No authorized employees found",view:"View details",temp:"Local draft",previewNotice:"Preview only: this record is held in memory and will disappear when this page closes.",loginRequired:"Sign in as authorized HR to save to the API.",serverSave:"Applicant name saved via API; chip details and photo were not uploaded.",printWarning:"This printout contains personal data. Store securely.",approvePrompt:"Employee ID (2–48 characters)",confirmApprove:"Approve this applicant and lock the record?",confirmDelete:"Delete this local draft?",deleteUnavailable:"Deleting real records requires a secured audited backend workflow.",editLocked:"Approved applications are locked and cannot be edited directly.",pendingReview:"Pending review",sourceAndroid:"Android HR",sourceWeb:"HR Web",safeNotice:"Raw chip data and images are never shown in table rows.",approvedSaved:"Approved and assigned internal employee ID",demoApproved:"Demonstration approval only; no server write",wrongCode:"Invalid employee ID"
}};
const S={language:"th",screen:"dashboard",token:"",context:null,expiresAt:0,records:[],roster:[],selected:null,localDrafts:[],draftEditing:null};
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
$("language").addEventListener("change",e=>{S.language=e.target.value;translate()});
async function request(method,path,body){
 if(!signedIn()&&path!=="/api/auth/login")throw Error(tr("loginRequired"));
 if(!isOnline())throw Error(tr("apiNotReady"));
 const response=await fetch(apiBase+path,{method,headers:{"Content-Type":"application/json",...(S.token?{Authorization:"Bearer "+S.token}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error??"request_rejected");
 return payload.data;
}
function logout(){
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
$("hr-logout").addEventListener("click",logout);
async function refreshView(){
 if(signedIn()){
  const org=encodeURIComponent(S.context.organization_id);
  const data=await Promise.allSettled([
   request("GET","/api/hr/applications?organization_id="+org),
   request("GET","/api/hr/employees?organization_id="+org)
  ]);
  if(data[0].status==="fulfilled")S.records=(Array.isArray(data[0].value)?data[0].value:[]).map(x=>({
    id:x.id,name:x.name??"",source:x.source??"hr_manual",status:x.status??"pending",
    created_at:x.created_at,employee_id:x.employee_id,persisted:true
  }));
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
 const body=$("employee-rows");body.replaceChildren();
 const rows=[...S.roster];
 for(const r of S.localDrafts.filter(x=>x.status==="approved"))rows.push({code:r.employee_code||"DEMO",name:r.name,status:"preview"});
 for(const r of rows){
  const el=document.createElement("tr");el.append(td(r.code??"—"),td(r.name??"—"),td("—"));
  const ch=td("");ch.append(statusChip("approved"));el.append(ch);el.append(td("—"));body.append(el);
 }
 if(!rows.length){const el=document.createElement("tr");const c=td(tr("noEmployees"));c.colSpan=5;c.style.padding="40px";c.style.textAlign="center";el.append(c);body.append(el)}
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
 $("detail-approve").disabled=r.status!=="pending";$("detail-delete").disabled=r.persisted;
 $("detail-personal").replaceChildren();$("detail-employment").replaceChildren();
 for(const [label,key] of [["applicantName","name"],["englishName","english_name"],["nationalId","national_id"],["dob","dob"],["gender","gender"],["address","address"],["issued","issued"],["expires","expires"],["phone","phone"]]){
  let val=key==="name"?r.name:r.extra?.[key];
  if(r.persisted&&["national_id","address","dob"].includes(key))val="—"; // Never assert stored card fields.
  addDefinition($("detail-personal"),label,val);
 }
 for(const [label,key] of [["position","position"],["education","education"],["expectedSalary","expected_salary"],["availableDate","available_date"],["workHistory","work_history"]])
  addDefinition($("detail-employment"),label,r.extra?.[key]??"—");
 const photo=$("detail-photo");photo.replaceChildren();
 if(r.photoUrl&&!r.persisted){const im=document.createElement("img");im.src=r.photoUrl;im.alt=tr("photo");photo.append(im)}
 else photo.textContent=tr("photo");
}
function openDetail(row){S.selected=row;renderDetail();navigate("applicant-detail")}
$("detail-back").addEventListener("click",()=>navigate("applicants"));
$("detail-print").addEventListener("click",()=>{if(!S.selected)return;window.print()});
$("detail-edit").addEventListener("click",()=>{
 if(!S.selected||S.selected.status!=="pending"){notice(tr("editLocked"));return}
 if(S.selected.persisted){notice("การแก้ไขรายการที่บันทึกใน API ต้องใช้ audit-safe update endpoint");return}
 S.draftEditing=S.selected;showModal(S.selected);
});
$("detail-delete").addEventListener("click",()=>{
 const r=S.selected;if(!r)return;
 if(r.persisted){notice(tr("deleteUnavailable"));return}
 if(!confirm(tr("confirmDelete")))return;
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
 if(r?.extra){for(const [key,val] of Object.entries({...r.extra,full_name:r.name})){
  const field=form.elements.namedItem(key);if(field&&field.type!=="file")field.value=String(val??"");
 }}else if(r)form.elements.namedItem("full_name").value=r.name;
 if(typeof $("applicant-dialog").showModal==="function")$("applicant-dialog").showModal();
}
$("add-applicant").addEventListener("click",()=>showModal());
function closeModal(){$("applicant-dialog").close();S.draftEditing=null}
$("modal-close").addEventListener("click",closeModal);
$("modal-cancel").addEventListener("click",closeModal);
const keys=["english_name","national_id","dob","gender","phone","address","issued","expires","position","education","expected_salary","available_date","work_history"];
async function draftFromForm(){
 const form=$("applicant-form"),name=String(form.elements.namedItem("full_name").value??"").trim();
 if(name.length<2||name.length>180||!form.elements.namedItem("consent").checked)throw Error(tr("privacyConfirm"));
 const extra={};for(const key of keys)extra[key]=String(form.elements.namedItem(key)?.value??"").trim();
 const photo=form.elements.namedItem("photo")?.files?.[0];if(photo&&
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
  if(S.draftEditing?.persisted)throw Error("The audit-safe edit API is not yet available");
  const saved=await request("POST","/api/hr/applications",{
   organization_id:S.context.organization_id,applicant_name:data.name,
   source:"hr_manual",idempotency_key:crypto.randomUUID(),consent_confirmed:true
  });
  if(!saved?.id)throw Error("No application reference received");
  // No national ID, address, image, DOB or other PII is sent by this endpoint.
  if(data.photo)notice(tr("saveLimit"));
  closeModal();await refreshView();const row=S.records.find(x=>x.id===saved.id);
  if(row)openDetail(row);
  notice(tr("serverSave"));
 }catch(err){alert(err.message)}finally{btn.disabled=false}
});
$("applicant-search").addEventListener("input",renderApplicants);
$("applicant-status").addEventListener("change",renderApplicants);
$("refresh-applicants").addEventListener("click",()=>void refreshView());
$("language").value=S.language;translate();navigate("dashboard",{silent:true});
if(!isOnline()){$("hr-login-button").disabled=true;notice(tr("apiNotReady"));}
window.addEventListener("beforeunload",()=>{for(const r of S.localDrafts)releasePhoto(r)});
