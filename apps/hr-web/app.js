const apiBase=String(window.CPI_ATTENDANCE_API_BASE??"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const state={token:"",expiresAt:0,context:null,interval:null};
function show(id,value){$(id).hidden=!value;}
function message(text){$("hr-message").textContent=text;}
function signedIn(){return Boolean(state.token&&state.context&&Date.now()<state.expiresAt);}
async function api(method,path,body){
  if(path!=="/api/auth/login"&&!signedIn())throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const response=await fetch(apiBase+path,{method,headers:{"Content-Type":"application/json",
    ...(state.token?{Authorization:"Bearer "+state.token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error??"request_failed");
  return payload.data;
}
function endQr(){if(state.interval)clearInterval(state.interval);state.interval=null;$("qr-preview").replaceChildren();}
function logout(){endQr();state.token="";state.context=null;state.expiresAt=0;show("hr-login",true);show("hr-console",false);}
$("hr-login-form").addEventListener("submit",async e=>{
  e.preventDefault();$("hr-login-button").disabled=true;message("กำลังเข้าสู่ระบบ...");
  try{
    const data=await api("POST","/api/auth/login",{
      organization_code:$("hr-org-code").value.trim(),
      employee_code:$("hr-user-code").value.trim(),
      password:$("hr-password").value});
    if(!["owner","hr_admin","manager"].includes(data?.context?.role))
      throw new Error("บัญชีนี้ไม่มีสิทธิ์บริหาร HR");
    state.token=data.access_token;state.context=data.context;
    state.expiresAt=Date.now()+Math.min(data.expires_in??3600,3600)*1000-20000;
    $("hr-password").value="";
    $("hr-organization").textContent=data.context.organization_name;
    show("hr-login",false);show("hr-console",true);
    message("เข้าสู่ระบบสำเร็จ — เลือกสาขาเพื่อเปิด QR Kiosk");
    const sites=await api("GET","/api/attendance/sites?organization_id="+
      encodeURIComponent(data.context.organization_id));
    $("site-select").replaceChildren();
    for(const s of (Array.isArray(sites)?sites:[])){
      const option=document.createElement("option");
      option.value=s.id;option.textContent=s.name+" ("+s.code+")";
      $("site-select").append(option);
    }
  }catch(error){logout();message("เข้าสู่ระบบไม่สำเร็จ: "+error.message);}
  finally{$("hr-login-button").disabled=false;}
});
$("hr-logout").addEventListener("click",()=>{logout();message("ออกจากระบบแล้ว");});
async function issueQr(){
  if(!signedIn()||!$("site-select").value){message("กรุณาเลือกสาขาที่ลงทะเบียนไว้");return;}
  try{
    const data=await api("POST","/api/attendance/qr",{
      organization_id:state.context.organization_id,site_id:$("site-select").value});
    const nonce=String(data?.nonce??"");
    if(!/^[0-9a-f]{64}$/.test(nonce))throw new Error("ไม่ได้รับรหัส QR ที่ถูกต้อง");
    const qr=window.qrcode(0,"M");qr.addData(nonce);qr.make();
    $("qr-preview").innerHTML=qr.createSvgTag(5,2); // Locally bundled MIT QR library, hex-only input.
    $("qr-expiry").textContent="QR หมดอายุ: "+new Date(data.expires_at).toLocaleTimeString("th-TH",{timeZone:"Asia/Bangkok"});
    message("แสดง QR สำหรับพนักงานในบริษัท — เปลี่ยนรหัสทุก 25 วินาที");
  }catch(error){endQr();message("ออก QR ไม่สำเร็จ: "+error.message);}
}
$("issue-qr").addEventListener("click",()=>{
  endQr();void issueQr();state.interval=setInterval(()=>{if(document.visibilityState==="visible")void issueQr();},25000);
});
$("stop-qr").addEventListener("click",()=>{endQr();message("ปิด QR Kiosk แล้ว");});
$("site-select").addEventListener("change",endQr);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")endQr();});
if(!/^https:\/\//.test(apiBase)){$("hr-login-button").disabled=true;message("ระบบอยู่ระหว่างตั้งค่า API — ยังไม่เปิดเข้าสู่ระบบจริง");}
