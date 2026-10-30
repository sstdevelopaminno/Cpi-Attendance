/* HR-authenticated handoff: browser and device are tied to the same tenant HR account.
 * Card data must arrive encrypted for the HR browser only; API cannot read plaintext.
 */
(()=>{
 const el=id=>document.getElementById(id),MAX_IMAGE=130000;
 const state={id:null,key:null,expires:0,abort:false,photo:null,previewUrl:null,savedSessionId:null};
 let loop=null;
 function showOverlay(){
  const overlay=el("reader-overlay");
  if(!overlay.open)overlay.showModal();
 }
 function stateUi(title,description,{active=false,done=false,problem=null,action=null,nextStep=null}={}){
  const overlay=el("reader-overlay");
  overlay.classList.toggle("complete",done);
  overlay.classList.toggle("error",problem==="error");
  overlay.classList.toggle("blocked",problem==="blocked");
  el("reader-overlay-title").textContent=title;
  el("reader-overlay-detail").textContent=description;
  const act=el("reader-overlay-action");
  act.hidden=!action;
  if(action){act.dataset.action=action;act.textContent=action==="signin"?"ไปเข้าสู่ระบบ HR":
    action==="consent"?"ไปยืนยันการรับข้อมูลบัตร":"ลองเชื่อมต่ออีกครั้ง"}
  const next=el("reader-next-step");
  next.hidden=!nextStep;
  next.textContent=nextStep||"";
  const box=el("reader-session");
  box.hidden=false;box.classList.toggle("done",done);
  el("reader-session-title").textContent=title;
  el("reader-session-description").textContent=description;
  el("reader-indicator").className="reader-indicator "+(active?"online":problem?"":"busy");
 }
 const decode=x=>{
  if(typeof x!=="string"||x.length>300000)throw Error("reader_payload_too_large");
  const binary=atob(x.replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
 };
 const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
 async function decrypt(payload){
  if(!state.key||!payload||typeof payload!=="object")throw Error("reader_session_invalid");
  const raw=await crypto.subtle.decrypt({name:"RSA-OAEP"},state.key.privateKey,decode(payload.wrapped_key));
  const aes=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(payload.iv)},aes,decode(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
 }
 function fill(data){
  if(!data||typeof data!=="object"||typeof data.full_name!=="string"||!data.full_name.trim())
    throw Error("reader_data_invalid");
  const form=el("applicant-form"),allow=[
   "full_name","english_name","national_id","dob","gender","address",
   "issued","expires","issuer","thai_prefix","english_prefix"
  ];
  for(const key of allow){
   if(typeof data[key]!=="string")continue;
   const field=form.elements.namedItem(key);
   if(!field||field.disabled||data[key].length>360)continue;
   if(key==="national_id"&&!/^\d{13}$/.test(data[key]))continue;
   field.value=data[key];
  }
  if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null}
  state.photo=null;
  const photo=data.photo;
  if(photo&&photo.media_type==="image/jpeg"&&typeof photo.base64==="string"&&photo.base64.length<=MAX_IMAGE){
   const bytes=decode(photo.base64);
   if(bytes.length>100000||bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)throw Error("reader_photo_invalid");
   state.photo=new File([bytes],"id-chip-photo.jpg",{type:"image/jpeg"});
   state.previewUrl=URL.createObjectURL(state.photo);
  }
  window.readerPhotoForDraft=state.photo;window.readerPhotoPreviewUrl=state.previewUrl;
  updateFormPhoto(state.previewUrl);
 }
 function updateFormPhoto(url){
  const root=el("applicant-photo-preview");
  if(!root)return;
  root.replaceChildren();
  if(url){
   const img=document.createElement("img");img.src=url;img.alt="รูปถ่ายจากชิป";
   root.append(img);
  }else root.textContent="รูปถ่ายจากชิป";
 }
 el("applicant-form").elements.namedItem("photo")?.addEventListener("change",event=>{
  const file=event.target.files?.[0];
  if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null}
  if(file&&file.type.startsWith("image/")){
   state.previewUrl=URL.createObjectURL(file);updateFormPhoto(state.previewUrl);
  }else updateFormPhoto(null);
 });
 function wipe(){
  const oldId=state.id,org=S.context?.organization_id;
  if(oldId&&org&&signedIn()&&state.expires>Date.now()){
   void request("POST","/api/hr/reader/consume",
    {organization_id:org,session_id:oldId,cancel:true}).catch(()=>{});
  }
  if(loop){clearInterval(loop);loop=null}
  state.abort=true;state.id=null;state.key=null;state.expires=0;state.savedSessionId=null;
  if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null}
  state.photo=null;window.readerPhotoForDraft=null;window.readerPhotoPreviewUrl=null;
  updateFormPhoto(null);
  el("reader-session").hidden=true;
  el("reader-indicator").className="reader-indicator";
 }
 window.cancelReaderSession=wipe;
 window.markReaderApplicationSaved=async(applicationId)=>{
  const id=state.savedSessionId;
  if(!id||!signedIn())return false;
  await request("POST","/api/hr/reader/saved",{
   organization_id:S.context.organization_id,session_id:id,application_id:applicationId
  });
  state.savedSessionId=null;
  return true;
 };
 async function start(){
  showOverlay();
  if(!signedIn()){
   stateUi("ยังไม่เข้าสู่ระบบ HR","ระบบไม่สามารถเปิดคำขออ่านบัตรโดยไม่มีบัญชี Owner/HR Admin ที่เข้าสู่ระบบแล้ว",
    {problem:"blocked",action:"signin",nextStep:"กรุณาเข้าสู่ระบบด้วยรหัสองค์กร รหัส HR และรหัสผ่านที่ได้รับสิทธิ์"});
   return;
  }
  if(!apiBase.startsWith("https://")){
   stateUi("Attendance API ยังไม่พร้อม","ไม่สามารถเปิดคำขออ่านบัตรได้ในขณะนี้",
    {problem:"error",nextStep:"กรุณาตรวจการเชื่อมต่อ API"});
   return;
  }
  const consent=el("applicant-form").elements.namedItem("consent");
  if(!consent?.checked){
   stateUi("ต้องยืนยันการแจ้งวัตถุประสงค์ก่อนอ่านบัตร",
    "กรุณาทำเครื่องหมายในช่องยืนยันการแจ้งวัตถุประสงค์ของผู้สมัคร ก่อนเปิดรับข้อมูลจากชิป",
    {problem:"blocked",action:"consent",nextStep:"ช่องยืนยันอยู่ในส่วนท้ายของฟอร์มเพิ่มผู้สมัครใหม่"});
   return;
  }
  wipe();state.abort=false;
  stateUi(tr("readerConnecting"),"กำลังสร้างคำขอของ HR ที่เข้าสู่ระบบ…");
  try{
   state.key=await crypto.subtle.generateKey({name:"RSA-OAEP",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["encrypt","decrypt"]);
   const spki=await crypto.subtle.exportKey("spki",state.key.publicKey);
   const result=await request("POST","/api/hr/reader/sessions",{
    organization_id:S.context.organization_id,public_key_spki:encode(spki)
   });
   if(state.abort)return;
   if(!result?.session_id||!Number.isFinite(Date.parse(result.expires_at)))
    throw Error("reader_session_invalid");
   state.id=result.session_id;state.expires=Date.parse(result.expires_at);
   stateUi(tr("readerWaiting"),"Android ที่เข้าสู่ระบบด้วยองค์กรและรหัส HR เดียวกันจะเชื่อมต่อเอง (คำขอหมดอายุใน 5 นาที)");
   loop=setInterval(()=>void poll(),2000);
   await poll();
  }catch(e){
   const message=String(e?.message||"request_rejected");
   const human=message==="login_required"?"เซสชัน HR หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง":
     message==="subscription_inactive"?"แพ็กเกจ HR ขององค์กรยังไม่ได้เปิดใช้งาน":
     message==="attendance_hr_forbidden"?"บัญชีนี้ไม่มีสิทธิ์เปิดรับข้อมูลจาก Android HR":
     message==="reader_session_invalid"?"เซิร์ฟเวอร์ไม่ได้ส่งคำขอกลับมา":
     "Attendance API ตอบกลับผิดพลาด: "+message;
   stateUi("ยังเปิดคำขออ่านบัตรไม่ได้",human,
    {problem:"error",action:message==="login_required"?"signin":"retry",
     nextStep:"ยังไม่มีคำขออ่านบัตร ระบบจึงไม่อนุญาตให้ Android อ่านหรือส่งข้อมูล"});
  }
 }
 let inFlight=false;
 async function poll(){
  if(!state.id||state.abort||inFlight)return;
  if(Date.now()>state.expires){stateUi("หมดเวลารออ่านบัตร","กรุณาเปิดการเชื่อมต่อใหม่");wipe();return}
  inFlight=true;
  try{
   const result=await request("GET","/api/hr/reader/sessions?organization_id="+
    encodeURIComponent(S.context.organization_id)+"&session_id="+encodeURIComponent(state.id));
   if(state.abort)return;
   if(result?.status==="paired"||result?.status==="reading")
    stateUi(result.status==="paired"?tr("readerPaired"):tr("readerReading"),
      "Android HR ได้รับสิทธิ์อ่านเฉพาะคำขอชั่วคราวนี้",{active:true});
   if(result?.status==="received"&&result?.payload){
    const card=await decrypt(result.payload);
    fill(card);
    stateUi(tr("readerReceived"),"ข้อมูลอยู่ในฟอร์มชั่วคราว กรุณาตรวจทานและกดบันทึก",{done:true});
    if(loop){clearInterval(loop);loop=null}
    await request("POST","/api/hr/reader/consume",{
     organization_id:S.context.organization_id,session_id:state.id
    }).catch(()=>{});
    state.savedSessionId=state.id;
    state.id=null;
   }
   if(result?.status==="cancelled"||result?.status==="expired")wipe();
  }catch(e){stateUi(tr("readerConnecting"),e.message)}
  finally{inFlight=false}
 }
 el("read-card").addEventListener("click",()=>void start());
 el("reader-overlay-action").addEventListener("click",()=>{
  const action=el("reader-overlay-action").dataset.action;
  if(action==="retry"){void start();return}
  el("reader-overlay").close();
  if(action==="signin"){
    if(el("applicant-dialog").open)el("applicant-dialog").close();
    const target=el("hr-login");target.scrollIntoView({behavior:"smooth",block:"center"});
    el("hr-org-code")?.focus({preventScroll:true});
  }else if(action==="consent"){
    const field=el("applicant-form").elements.namedItem("consent");
    field?.scrollIntoView({behavior:"smooth",block:"center"});field?.focus({preventScroll:true});
  }
 });
 el("reader-cancel").addEventListener("click",wipe);
 el("reader-overlay-close").addEventListener("click",()=>{
  el("reader-overlay").close();
  if(state.id)wipe();
 });
 el("reader-overlay").addEventListener("cancel",()=>{if(state.id)wipe()});
 const d=el("applicant-dialog");
 d.addEventListener("close",wipe);
 el("preview-card").addEventListener("click",()=>{
  const form=el("applicant-form");
  const read=name=>String(form.elements.namedItem(name)?.value??"").trim();
  const digits=read("national_id");
  const masked=/^\d{13}$/.test(digits)?"•••••••••"+digits.slice(-4):"";
  el("id-view-number").textContent=masked||"X-XXXX-XXXXX-XX-X";
  const dl=el("card-preview-fields");dl.replaceChildren();
  for(const [label,value] of [
   ["ชื่อ-นามสกุล (TH)",[read("thai_prefix"),read("full_name")].filter(Boolean).join(" ")],
   ["Name (EN)",[read("english_prefix"),read("english_name")].filter(Boolean).join(" ")],
   ["วันเกิด / Date of Birth",read("dob")],
   ["เพศ / Sex",read("gender")],
   ["ที่อยู่ตามบัตร / Address",read("address")],
   ["ผู้ออกบัตร / Issuer",read("issuer")],
   ["วันออกบัตร / Issue",read("issued")],
   ["หมดอายุ / Expiry",read("expires")]
  ]){
   const dt=document.createElement("dt"),dd=document.createElement("dd");
   dt.textContent=label;dd.textContent=value||"—";dl.append(dt,dd);
  }
  const image=el("card-preview-photo");image.replaceChildren();
  const file=form.elements.namedItem("photo")?.files?.[0]||state.photo;
  const url=file?URL.createObjectURL(file):null;
  if(url){
   const img=document.createElement("img");img.alt="ตัวอย่างรูปถ่าย";img.src=url;
   img.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});image.append(img);
  }else image.textContent=tr("photo");
  el("card-dialog").showModal();
 });
 const close=()=>el("card-dialog").close();
 el("card-dialog-close").addEventListener("click",close);
 el("card-dialog-done").addEventListener("click",close);
})();
