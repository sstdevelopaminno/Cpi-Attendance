const apiBase=String(window.CPI_ATTENDANCE_API_BASE??"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const state={token:"",context:null,expiresAt:0,stream:null,scanner:null,scanBusy:false,pendingKey:null};
function show(id,visible){if($(id))$(id).hidden=!visible;}
function message(text){$("app-message").textContent=text;}
function signedIn(){return Boolean(state.token&&state.context&&Date.now()<state.expiresAt);}
function resetSession(){state.token="";state.context=null;state.expiresAt=0;show("login-section",true);show("user-section",false);stopCamera();}
async function request(method,path,body){
  if(!signedIn()&&path!=="/api/auth/login")throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  const response=await fetch(apiBase+path,{
    method,headers:{"Content-Type":"application/json",...(state.token?{Authorization:"Bearer "+state.token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    cache:"no-store"
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(mapError(json.error));
  return json.data;
}
function mapError(code){
  const codes={invalid_credentials:"รหัสบริษัท รหัสพนักงาน หรือรหัสผ่านไม่ถูกต้อง",login_rate_limited:"เข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง",attendance_qr_expired_or_invalid:"QR หมดอายุ กรุณาสแกนใหม่",attendance_outside_geofence:"อยู่นอกพื้นที่ที่บริษัทกำหนด",attendance_location_insufficient:"GPS ไม่แม่นยำหรือยังไม่ได้รับอนุญาต",attendance_already_checked_in:"มีการบันทึกเข้างานแล้ว กรุณาออกงานก่อน",attendance_no_open_shift:"ยังไม่มีรายการเข้างาน",account_not_authorized:"บัญชีไม่มีสิทธิ์ใช้องค์กรนี้",login_required:"เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"};
  return codes[code]??"ไม่สามารถทำรายการได้ กรุณาติดต่อฝ่าย HR ("+String(code??"unknown")+")";
}
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const button=$("login-button");button.disabled=true;message("กำลังตรวจสอบบัญชี...");
  try{
    const data=await request("POST","/api/auth/login",{
      organization_code:$("org-code").value.trim(),
      employee_code:$("employee-code").value.trim(),
      password:$("password").value
    });
    if(!data?.context?.employee_id)throw new Error("บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน");
    state.token=data.access_token;state.context=data.context;
    state.expiresAt=Date.now()+Math.min(data.expires_in??3600,3600)*1000-20000;
    $("password").value="";
    $("employee-name").textContent=data.context.full_name??data.context.employee_code;
    $("organization-name").textContent=data.context.organization_name??data.context.organization_code;
    show("login-section",false);show("user-section",true);message("เข้าสู่ระบบสำเร็จ");
    await history();await leaveHistory();
  }catch(error){message(error.message);state.token="";state.context=null;}
  finally{button.disabled=false;}
});
$("logout").addEventListener("click",()=>{resetSession();message("ออกจากระบบแล้ว");});
async function history(){
  if(!signedIn())return;
  try{
    const rows=await request("GET","/api/attendance/history?organization_id="+encodeURIComponent(state.context.organization_id));
    const ul=$("history-list");ul.replaceChildren();
    for(const row of (Array.isArray(rows)?rows:[])){
      const li=document.createElement("li");
      const timestamp=Number.isFinite(Date.parse(row.occurred_at))?
        new Date(row.occurred_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"—";
      li.textContent=(row.event_type==="check_in"?"เข้างาน":row.event_type==="check_out"?"ออกงาน":row.event_type)+" · "+timestamp+
        (row.evidence_status==="review"?" · รอ HR ตรวจสอบ":"");
      ul.append(li);
    }
    if(ul.children.length===0){const li=document.createElement("li");li.textContent="ยังไม่มีประวัติ";ul.append(li);}
  }catch(error){message(error.message);}
}
$("refresh-history").addEventListener("click",history);
async function leaveHistory(){
  if(!signedIn())return;
  try{
    const rows=await request("GET","/api/leave/mine?organization_id="+encodeURIComponent(state.context.organization_id));
    const ul=$("leave-list");ul.replaceChildren();
    for(const row of (Array.isArray(rows)?rows:[])){
      const li=document.createElement("li");
      li.textContent=row.leave_type+" · "+row.start_date+" ถึง "+row.end_date+" · "+row.status;
      ul.append(li);
    }
    if(!ul.children.length){const li=document.createElement("li");li.textContent="ยังไม่มีคำขอลา";ul.append(li);}
  }catch(error){message(error.message);}
}
$("refresh-leaves").addEventListener("click",leaveHistory);
$("leave-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!signedIn())return;
  const button=$("leave-submit");button.disabled=true;
  try{
    await request("POST","/api/leave/request",{
      organization_id:state.context.organization_id,leave_type:$("leave-type").value,
      start_date:$("leave-start").value,end_date:$("leave-end").value,
      note:$("leave-note").value});
    message("ส่งใบลาแล้ว รอ HR พิจารณา");$("leave-note").value="";
    await leaveHistory();
  }catch(error){message(error.message);}
  finally{button.disabled=false;}
});
function extractNonce(text){
  const raw=String(text??"").trim();
  if(/^[0-9a-f]{64}$/.test(raw))return raw;
  // QR JSON is accepted only for a single nonce field; never follow QR URLs.
  try{const parsed=JSON.parse(raw);return /^[0-9a-f]{64}$/.test(parsed?.nonce)?parsed.nonce:null;}catch{return null;}
}
async function submitPunch(nonce){
  if(!signedIn())return message("กรุณาเข้าสู่ระบบ");
  if(!nonce)return message("QR ไม่ถูกต้อง ต้องเป็นรหัสจาก Kiosk ของบริษัท");
  if(state.scanBusy)return;
  state.scanBusy=true;
  $("punch-button").disabled=true;
  message("กำลังขอพิกัด GPS...");
  try{
    if(!navigator.geolocation)throw new Error("เครื่องนี้ไม่รองรับ GPS");
    const position=await new Promise((resolve,reject)=>
      navigator.geolocation.getCurrentPosition(resolve,reject,
        {enableHighAccuracy:true,maximumAge:0,timeout:14000}));
    const id=state.pendingKey??crypto.randomUUID();
    state.pendingKey=id;
    const result=await request("POST","/api/attendance/punch",{
      organization_id:state.context.organization_id,
      event_type:$("event-type").value,
      idempotency_key:id,qr_nonce:nonce,
      latitude:position.coords.latitude,
      longitude:position.coords.longitude,
      accuracy_m:position.coords.accuracy
    });
    state.pendingKey=null;
    message(result?.evidence_status==="review"?"บันทึกแล้ว — GPS ต้องให้ HR ตรวจสอบ":
      "บันทึกเวลาเรียบร้อย "+new Date(result.occurred_at).toLocaleTimeString("th-TH",{timeZone:"Asia/Bangkok"}));
    $("qr-nonce").value="";stopCamera();await history();
  }catch(error){
    if(error?.code===1)message("ต้องอนุญาตตำแหน่ง GPS ก่อนลงเวลา");
    else message(error?.message??"ไม่สามารถระบุตำแหน่งได้");
  }finally{state.scanBusy=false;$("punch-button").disabled=false;}
}
$("punch-button").addEventListener("click",()=>submitPunch(extractNonce($("qr-nonce").value)));
function stopCamera(){
  if(state.scanner)clearInterval(state.scanner);state.scanner=null;
  if(state.stream)state.stream.getTracks().forEach(t=>t.stop());state.stream=null;
  if($("scan-video")){$("scan-video").srcObject=null;show("scan-video",false);}
}
$("stop-camera").addEventListener("click",stopCamera);
$("start-camera").addEventListener("click",async()=>{
  if(!signedIn())return message("กรุณาเข้าสู่ระบบ");
  if(!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia)
    return message("เบราว์เซอร์นี้ยังไม่รองรับการอ่าน QR ด้วยกล้อง กรุณาใช้เบราว์เซอร์ที่รองรับหรือเครื่อง Kiosk");
  try{
    stopCamera();
    const detector=new BarcodeDetector({formats:["qr_code"]});
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
    state.stream=stream;
    const video=$("scan-video");video.srcObject=stream;show("scan-video",true);
    await video.play();
    message("เล็งกล้องไปที่ QR ของบริษัท");
    state.scanner=setInterval(async()=>{
      if(state.scanBusy||video.readyState<2)return;
      try{
        const codes=await detector.detect(video);
        for(const code of codes){
          const nonce=extractNonce(code.rawValue);
          if(nonce){stopCamera();$("qr-nonce").value=nonce;message("อ่าน QR แล้ว กดยืนยันการลงเวลา");break;}
        }
      }catch{stopCamera();message("ไม่สามารถอ่าน QR ได้");}
    },450);
  }catch{stopCamera();message("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการใช้กล้อง");}
});
if(!/^https:\/\//.test(apiBase)){
  message("ระบบยังอยู่ระหว่างตั้งค่า API — ไม่เปิดให้เข้าสู่ระบบจริง");
  $("login-button").disabled=true;
} else {message("เข้าสู่ระบบด้วยรหัสบริษัท รหัสพนักงาน และรหัสผ่าน");}
