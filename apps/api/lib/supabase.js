import { reply, tokenFromRequest, configured } from "./http.js";
export async function rpc(name,body,token,{admin=false}={}) {
  if(!configured()) return {ok:false,status:503,data:{error:"api_not_configured"}};
  const base=process.env.ATTENDANCE_SUPABASE_URL.replace(/\/$/,"");
  const key=admin?process.env.ATTENDANCE_SUPABASE_SERVICE_KEY:process.env.ATTENDANCE_SUPABASE_PUBLISHABLE_KEY;
  if(!key)return {ok:false,status:503,data:{error:"api_not_configured"}};
  const response=await fetch(`${base}/rest/v1/rpc/${name}`,{
    method:"POST",headers:{"Content-Type":"application/json","apikey":key,
      "Authorization":`Bearer ${admin?key:token}`},
    body:JSON.stringify(body),signal:AbortSignal.timeout(8000)
  });
  if(!response.ok) {
    // Avoid revealing Postgres internal messages and schema, incl. org information.
    const payload=await response.json().catch(()=>({}));
    const code=String(payload.message??"").replace(/[^a-z0-9_]/gi,"").slice(0,65);
    const status=code==="attendance_qr_expired_or_invalid"?410:
      code==="attendance_login_rate_limited"?429:
      response.status===403||response.status===401?403:
      response.status===409?409:422;
    return {ok:false,status,data:{error:code.startsWith("attendance_")?code:"request_rejected"}};
  }
  return {ok:true,status:200,data:await response.json().catch(()=>null)};
}
export async function requireSession(req,res) {
  if(!configured()){reply(res,503,{error:"api_not_configured"});return null;}
  const token=tokenFromRequest(req);
  if(!token){reply(res,401,{error:"login_required"});return null;}
  const base=process.env.ATTENDANCE_SUPABASE_URL.replace(/\/$/,"");
  const key=process.env.ATTENDANCE_SUPABASE_PUBLISHABLE_KEY;
  const response=await fetch(`${base}/auth/v1/user`,{
    headers:{"apikey":key,"Authorization":`Bearer ${token}`},
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok){reply(res,401,{error:"login_required"});return null;}
  const user=await response.json().catch(()=>null);
  if(!user?.id){reply(res,401,{error:"login_required"});return null;}
  return {token,userId:user.id};
}
