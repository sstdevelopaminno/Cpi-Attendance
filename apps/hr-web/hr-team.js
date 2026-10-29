/* Tenant Owner manages staff invitations; no passwords, tokens or email lists persisted. */
(()=>{
 "use strict";
 const el=id=>document.getElementById(id);
 const panel=el("hr-team-panel"),list=el("hr-team-list"),form=el("hr-team-invite-form");
 const status=message=>{el("hr-team-status").textContent=message};
 const isOwner=()=>signedIn()&&S.context?.role==="owner";
 async function refresh(){
   panel.hidden=!isOwner();
   list.replaceChildren();
   if(!isOwner())return;
   try{
     const users=await request("GET","/api/hr/team?organization_id="+
       encodeURIComponent(S.context.organization_id));
     if(!Array.isArray(users))throw Error("team_list_unavailable");
     for(const member of users){
       const row=document.createElement("li");
       const description=document.createElement("span");
       description.textContent=String(member.hr_code)+" · "+String(member.role)+
         " · "+(member.status==="active"?"ใช้งาน":"ปิดใช้งาน");
       row.append(description);
       if(member.role==="hr_admin"&&member.status==="active"){
         const disable=document.createElement("button");
         disable.className="btn ghost";disable.type="button";disable.textContent="ปิดสิทธิ์";
         disable.addEventListener("click",async()=>{
           if(!isOwner()||!confirm("ปิดสิทธิ์ HR "+String(member.hr_code)+" และอุปกรณ์ที่ผูกไว้?"))return;
           disable.disabled=true;status("กำลังปิดสิทธิ์...");
           try{
             await request("POST","/api/hr/team/disable",{
               organization_id:S.context.organization_id,hr_code:member.hr_code
             });
             status("ปิดสิทธิ์แล้ว");await refresh();
           }catch(e){status("ดำเนินการไม่สำเร็จ: "+e.message);disable.disabled=false}
         });
         row.append(disable);
       }
       list.append(row);
     }
     if(!users.length)status("องค์กรยังไม่มีบัญชี HR");
   }catch(e){status("ไม่สามารถอ่านรายชื่อ HR: "+e.message)}
 }
 form.addEventListener("submit",async e=>{
   e.preventDefault();if(!isOwner())return;
   const code=el("hr-team-code").value.trim().toUpperCase();
   const email=el("hr-team-email").value.trim().toLowerCase();
   if(!/^[A-Z0-9]{6}$/.test(code)||!/^\S+@\S+\.\S+$/.test(email)){
     status("ตรวจรหัส HR 6 ตัวและอีเมลให้ถูกต้อง");return;
   }
   const button=el("hr-team-invite-button");button.disabled=true;
   status("กำลังส่งอีเมลเชิญ HR...");
   try{
     await request("POST","/api/hr/team/invite",{
       organization_id:S.context.organization_id,hr_code:code,email
     });
     form.reset();status("ส่งคำเชิญแล้ว HR ผู้รับต้องตั้งรหัสผ่านในอีเมลก่อนใช้งาน");
     await refresh();
   }catch(e){
     status(e.message==="hr_invite_email_unavailable"?
       "ส่งคำเชิญไม่ได้ อีเมลอาจเป็นสมาชิก Supabase อยู่แล้ว":("ส่งคำเชิญไม่สำเร็จ: "+e.message));
   }finally{button.disabled=false}
 });
 document.addEventListener("cpi-hr-signed-in",()=>void refresh());
 document.addEventListener("cpi-hr-signed-out",()=>{panel.hidden=true;list.replaceChildren();form.reset();status("")});
 document.querySelector('[data-view="settings"]')?.addEventListener("click",()=>{
   if(isOwner())void refresh();
 });
})();
