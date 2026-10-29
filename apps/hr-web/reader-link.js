/* Session-only card handoff: HR creates an ephemeral public key, Android never logs in.
 * Card data must arrive encrypted for the HR browser only; API cannot read plaintext.
 */
(()=>{
 const el=id=>document.getElementById(id),MAX_IMAGE=130000;
 const state={id:null,key:null,expires:0,abort:false,photo:null,previewUrl:null};
 let loop=null;
 function stateUi(title,description,{active=false,done=false,code=null}={}){
  const box=el("reader-session");
  box.hidden=false;box.classList.toggle("done",done);
  el("reader-session-title").textContent=title;
  el("reader-session-description").textContent=description;
  el("reader-indicator").className="reader-indicator "+(active?"online":"busy");
  el("reader-pairing-code").hidden=!code;el("reader-pairing-code").textContent=code||"";
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
 }
 function wipe(){
  const oldId=state.id,org=S.context?.organization_id;
  if(oldId&&org&&signedIn()&&state.expires>Date.now()){
   void request("POST","/api/hr/reader/consume",
    {organization_id:org,session_id:oldId,cancel:true}).catch(()=>{});
  }
  if(loop){clearInterval(loop);loop=null}
  state.abort=true;state.id=null;state.key=null;state.expires=0;
  if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null}
  state.photo=null;window.readerPhotoForDraft=null;window.readerPhotoPreviewUrl=null;
  el("reader-session").hidden=true;
  el("reader-indicator").className="reader-indicator";
 }
 window.cancelReaderSession=wipe;
 async function start(){
  if(!signedIn()){stateUi(tr("loginRequired"),tr("readerApiOffline"));return}
  if(!apiBase.startsWith("https://")){stateUi(tr("readerApiOffline"),"Attendance API is not configured.");return}
  wipe();state.abort=false;
  stateUi(tr("readerConnecting"),tr("readerWaiting"));
  try{
   state.key=await crypto.subtle.generateKey({name:"RSA-OAEP",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["encrypt","decrypt"]);
   const spki=await crypto.subtle.exportKey("spki",state.key.publicKey);
   const result=await request("POST","/api/hr/reader/sessions",{
    organization_id:S.context.organization_id,public_key_spki:encode(spki)
   });
   if(state.abort)return;
   if(!result?.session_id||!result?.pairing_code||!Number.isFinite(Date.parse(result.expires_at)))
    throw Error("reader_session_invalid");
   state.id=result.session_id;state.expires=Date.parse(result.expires_at);
   stateUi(tr("readerWaiting"),"กรอกรหัสบน Android HR หลังเปิดหน้านี้ · หมดอายุอัตโนมัติ",
    {code:result.pairing_code});
   loop=setInterval(()=>void poll(),2000);
   await poll();
  }catch(e){stateUi(tr("readerApiOffline"),e.message)}
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
    state.id=null;
   }
   if(result?.status==="cancelled"||result?.status==="expired")wipe();
  }catch(e){stateUi(tr("readerConnecting"),e.message)}
  finally{inFlight=false}
 }
 el("read-card").addEventListener("click",()=>void start());
 el("reader-cancel").addEventListener("click",wipe);
 const d=el("applicant-dialog");
 d.addEventListener("close",wipe);
 el("preview-card").addEventListener("click",()=>{
  const form=el("applicant-form");
  const read=name=>String(form.elements.namedItem(name)?.value??"").trim();
  const masked=read("national_id").replace(/^(\d{1})(\d{8})(\d{4})$/,"$1-XXXX-XXXXX-$3");
  el("id-view-number").textContent=masked||"X-XXXX-XXXXX-XX-X";
  const dl=el("card-preview-fields");dl.replaceChildren();
  for(const [label,value] of [
   ["ชื่อ-นามสกุล",read("full_name")],["Name",read("english_name")],
   ["Date of Birth",read("dob")],["ที่อยู่ตามบัตร",read("address")],
   ["Date of Issue",read("issued")],["Date of Expiry",read("expires")]
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
