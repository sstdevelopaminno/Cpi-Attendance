import { createHmac } from "node:crypto";
import { applyCors,reply,parseBody,configured } from "../../lib/http.js";
import { rpc } from "../../lib/supabase.js";
export function deriveAuthEmail(orgCode,employeeCode,secret,domain) {
  if(!secret||secret.length<32||!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain??""))
    throw new Error("auth_derivation_not_configured");
  const digest=createHmac("sha256",secret).update(orgCode.toUpperCase()+"\x00"+employeeCode.toUpperCase()).digest("hex");
  return `employee-${digest.slice(0,48)}@${domain}`;
}
export default async function handler(req,res) {
  if(!applyCors(req,res))return;
  if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
  if(!configured()||!process.env.ATTENDANCE_SUPABASE_SERVICE_KEY
     ||!process.env.ATTENDANCE_AUTH_DERIVE_KEY
     ||!process.env.ATTENDANCE_AUTH_EMAIL_DOMAIN)
    return reply(res,503,{error:"api_not_configured"});
  try{
    const b=parseBody(req);
    const org=String(b.organization_code??"").trim().toUpperCase();
    const employee=String(b.employee_code??"").trim().toUpperCase();
    const password=String(b.password??"");
    if(!/^[A-Z0-9_-]{3,48}$/.test(org)||!/^[A-Z0-9._-]{2,48}$/.test(employee)
       ||password.length<12||password.length>128)
      return reply(res,401,{error:"invalid_credentials"});
    const secret=process.env.ATTENDANCE_AUTH_DERIVE_KEY;
    const address=deriveAuthEmail(org,employee,secret,process.env.ATTENDANCE_AUTH_EMAIL_DOMAIN);
    // Fingerprints are HMACs; neither employee codes nor IPs are written to login logs.
    const ip=String(req.headers?.["x-forwarded-for"]??"unknown").split(",")[0].trim().slice(0,80);
    const fingerprint=(prefix,value)=>createHmac("sha256",secret).update(prefix+"\x00"+value).digest("hex");
    const checks=[
      fingerprint("account",address),
      fingerprint("ipaccount",address+"\x00"+ip)
    ];
    for(const value of checks) {
      const gate=await rpc("attendance_allow_login",{p_fingerprint:value},null,{admin:true});
      if(!gate.ok) return reply(res,gate.status===429?429:503,
        {error:gate.status===429?"login_rate_limited":"login_unavailable"});
    }
    const base=process.env.ATTENDANCE_SUPABASE_URL.replace(/\/$/,"");
    const key=process.env.ATTENDANCE_SUPABASE_PUBLISHABLE_KEY;
    const response=await fetch(`${base}/auth/v1/token?grant_type=password`,{
      method:"POST",headers:{"Content-Type":"application/json","apikey":key},
      body:JSON.stringify({email:address,password}),signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)return reply(res,401,{error:"invalid_credentials"});
    const tokens=await response.json();
    if(!tokens?.access_token)return reply(res,401,{error:"invalid_credentials"});
    const context=await rpc("attendance_login_context",{p_organization_code:org},
      tokens.access_token);
    if(!context.ok) return reply(res,403,{error:"account_not_authorized"});
    // Deliberately omit refresh token. Session lives only in browser memory;
    // users must reauthenticate when JWT expires until secure cookie flow is built.
    return reply(res,200,{data:{access_token:tokens.access_token,
      expires_in:tokens.expires_in??3600,context:context.data}});
  } catch {
    return reply(res,503,{error:"login_unavailable"});
  }
}
