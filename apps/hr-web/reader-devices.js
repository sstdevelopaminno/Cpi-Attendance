/* Organization-scoped Android HR device management. No device capabilities or card data. */
(()=>{
 "use strict";
 const byId=id=>document.getElementById(id);
 const panel=byId("reader-devices-panel");
 const list=byId("reader-devices-list");
 const info=byId("reader-devices-status");
 const canManage=()=>signedIn()&&["owner","hr_admin"].includes(S.context?.role);
 let busy=false;
 async function refresh(){
  panel.hidden=!canManage();list.replaceChildren();
  if(!canManage()||busy)return;
  busy=true;info.textContent="กำลังตรวจสอบรายการเครื่อง Android HR...";
  try{
   const entries=await request("GET","/api/hr/reader/devices?organization_id="+
     encodeURIComponent(S.context.organization_id));
   if(!Array.isArray(entries))throw Error("device_list_invalid");
   const active=entries.filter(e=>e.status==="active");
   const limit=Number(S.context.max_android_devices)||0;
   info.textContent="ใช้งาน "+active.length+" / "+(limit||"—")+
     " เครื่อง · การปลดเครื่องจะทำให้เครื่องนั้นต้องเข้าสู่ระบบใหม่";
   for(const item of entries){
    const row=document.createElement("li");
    row.className="reader-device-item";
    const title=document.createElement("div");
    title.className="reader-device-label";
    const label=document.createElement("strong");
    label.textContent=String(item.label||"เครื่อง Android HR")+" · "+String(item.id||"").slice(0,8);
    const status=document.createElement("small");
    const last=item.last_seen_at?new Date(item.last_seen_at):null;
    status.textContent=(item.status==="active"?"กำลังใช้งาน":"ปิดสิทธิ์")+
      (last&&!Number.isNaN(last.getTime())?" · ติดต่อ "+last.toLocaleString("th-TH"):"");
    title.append(label,status);row.append(title);
    if(item.status==="active"){
     const button=document.createElement("button");
     button.type="button";button.className="btn ghost";button.textContent="ปลดเครื่อง";
     button.addEventListener("click",async()=>{
      if(!canManage()||!confirm("ยืนยันปลดสิทธิ์เครื่อง "+String(item.id||"").slice(0,8)+
       "? เครื่องนี้จะไม่สามารถรับคำขออ่านบัตรได้จนกว่าจะลงทะเบียนใหม่"))return;
      button.disabled=true;info.textContent="กำลังปลดสิทธิ์เครื่อง...";
      try{
       await request("POST","/api/hr/reader/revoke",{
        organization_id:S.context.organization_id,device_id:item.id
       });
       await refresh();
      }catch(err){info.textContent="ปลดเครื่องไม่สำเร็จ: "+String(err.message);button.disabled=false}
     });
     row.append(button);
    }
    list.append(row);
   }
  }catch(err){info.textContent="ยังอ่านรายการเครื่องไม่ได้: "+String(err.message)}
  finally{busy=false}
 }
 byId("reader-devices-refresh").addEventListener("click",()=>void refresh());
 document.addEventListener("cpi-hr-signed-in",()=>void refresh());
 document.addEventListener("cpi-hr-signed-out",()=>{
  panel.hidden=true;list.replaceChildren();info.textContent="";
 });
 document.querySelector('[data-view="settings"]')?.addEventListener("click",()=>{
  if(canManage())void refresh();
 });
})();
