(()=>{"use strict";
 const base=String(window.CPI_ATTENDANCE_API_BASE||"").replace(/\/$/,"");
 const fragment=new URLSearchParams(location.hash.slice(1));
 const token=fragment.get("access_token")||"";
 // Clear invite token from the browser's address bar immediately.
 history.replaceState(null,"",location.pathname);
 const msg=document.getElementById("welcome-message"),form=document.getElementById("welcome-form");
 if(!token||token.length<100){
  form.hidden=true;
  const err=fragment.get("error_code")||fragment.get("error")||"";
  msg.textContent=(err==="otp_expired"||err==="access_denied")?
   "ลิงก์คำเชิญหมดอายุหรือเคยใช้แล้ว กรุณากลับไปหน้า HR และกดส่งอีเมลตั้งรหัสใหม่":
   "ไม่พบรหัสยืนยันที่ใช้งานได้ กรุณากลับไปหน้า HR เพื่อขออีเมลตั้งรหัสใหม่";
  return;
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  const pw=document.getElementById("welcome-password").value;
  const check=document.getElementById("welcome-confirm").value;
  if(pw.length<12||pw.length>128||!/[a-zA-Z]/.test(pw)||!/[0-9]/.test(pw)||pw!==check){
   msg.textContent="กรุณาใช้รหัสผ่านอย่างน้อย 12 ตัวอักษร มีทั้งตัวอักษรและตัวเลข และกรอกให้ตรงกัน";return;
  }
  const button=form.querySelector("button");button.disabled=true;
  msg.textContent="กำลังเปิดบัญชี HR อย่างปลอดภัย…";
  try{
   const r=await fetch(base+"/api/auth/complete-invite",{
    method:"POST",headers:{"Authorization":"Bearer "+token,
      "Content-Type":"application/json"},body:JSON.stringify({password:pw}),cache:"no-store"
   });
   if(!r.ok)throw Error("คำเชิญหมดอายุหรือยังไม่ได้รับการอนุมัติ");
   form.reset();form.hidden=true;msg.textContent="ตั้งค่ารหัสผ่านสำเร็จ ใช้รหัสองค์กร 6 หลัก รหัส HR และรหัสผ่านใหม่นี้เพื่อเข้าสู่ระบบ";
  }catch(e){msg.textContent=e.message;button.disabled=false}
 });
})();