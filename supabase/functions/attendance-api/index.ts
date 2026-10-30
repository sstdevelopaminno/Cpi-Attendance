// Cpi Attendance tenant HR API · Supabase Edge Runtime
// HR data access is ALWAYS verified with Supabase Auth + tenant-scoped SQL RPCs.
// No staff records, national IDs or raw chip photos are ever logged here.
// Android signs in using the same HR account as the browser, then enrolls
// an HR-bound Keystore device capability. Only encrypted card data is sent.
const DB = Deno.env.get("SUPABASE_URL") || "";
const PUB = (() => {
  try {return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || Deno.env.get("SUPABASE_ANON_KEY") || "";}
  catch {return Deno.env.get("SUPABASE_ANON_KEY") || "";}
})();
const ADMIN = (() => {
  try {return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";}
  catch {return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";}
})();
const ORIGIN = "https://cpi-attendance-hr.vercel.app";
const typeJson = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const uuid = s => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const hex32 = s => typeof s === "string" && /^[0-9a-f]{32}$/.test(s);
const safeText=(x,n)=>typeof x==="string"&&x.length<=n?x:"";
function reply(status,data,origin="") {
  return new Response(JSON.stringify(data),{status,headers:{...typeJson,...(origin?{
    "Access-Control-Allow-Origin":origin,"Vary":"Origin"
  }:{})}});
}
async function digest(s){
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("");
}
async function fingerprint(s){
  if(!ADMIN)return "";
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(ADMIN),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const mac=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(s));
  return Array.from(new Uint8Array(mac),x=>x.toString(16).padStart(2,"0")).join("");
}
async function input(req,maxBytes=4096){
  if(Number(req.headers.get("content-length")||"0")>maxBytes)throw Error("body_too_large");
  const raw=await req.text();
  if(new TextEncoder().encode(raw).byteLength>maxBytes)throw Error("body_too_large");
  const v=JSON.parse(raw);
  if(!v||typeof v!=="object"||Array.isArray(v))throw Error("invalid_payload");
  return v;
}
function bearer(req){
  const raw=req.headers.get("Authorization")||"";
  return /^Bearer ([A-Za-z0-9._~-]{24,4096})$/.exec(raw)?.[1]||"";
}
async function rpc(name,args,token=""){
  if(!DB||!PUB||!ADMIN)return {ok:false,status:503,error:"api_not_configured"};
  const key=token?PUB:ADMIN;
  const headers={"Content-Type":"application/json","apikey":key};
  if(token)headers.Authorization="Bearer "+token;
  const res=await fetch(DB+"/rest/v1/rpc/"+name,{
    method:"POST",headers,body:JSON.stringify(args),signal:AbortSignal.timeout(8500)
  });
  let data;try{data=await res.json()}catch{data=null}
  if(!res.ok){
    const message=String(data?.message||"").replace(/[^a-z0-9_]/gi,"").slice(0,70);
    const status=res.status===401||res.status===403?403:
     message.includes("rate_limited")?429:
     message.includes("forbidden")||message.includes("denied")?403:
     message.includes("missing")?404:422;
    return {ok:false,status,error:message.startsWith("attendance_")||message.startsWith("reader_")?message:"request_rejected"};
  }
  return {ok:true,status:200,data};
}
async function hrAuth(req){
  const token=bearer(req);
  if(!token||!DB||!PUB)return null;
  const res=await fetch(DB+"/auth/v1/user",{
    headers:{"apikey":PUB,"Authorization":"Bearer "+token},
    signal:AbortSignal.timeout(8000)
  });
  if(!res.ok)return null;
  const user=await res.json().catch(()=>null);
  return user?.id?token:null;
}
const responseRpc=(r,origin)=>reply(r.status,r.ok?{data:r.data}:{error:r.error},origin);
Deno.serve(async req=>{
  const origin=req.headers.get("origin")||"";
  if(origin&&origin!==ORIGIN)return reply(403,{error:"origin_forbidden"});
  if(req.method==="OPTIONS"){
    return new Response(null,{status:204,headers:{
      ...typeJson,"Access-Control-Allow-Origin":origin||ORIGIN,
      "Access-Control-Allow-Headers":"Authorization,Content-Type",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Max-Age":"600","Vary":"Origin"
    }});
  }
  const path=new URL(req.url).pathname.split("/attendance-api")[1]||"/";
  const query=new URL(req.url).searchParams;
  if((path==="/health"||path==="/api/health")&&req.method==="GET"){
    // Never announce v0.7 readiness when only the Edge code was deployed.
    // The service-only RPC is created by the HR-bound database migration.
    const readerProtocol=DB&&PUB&&ADMIN
      ?await rpc("attendance_reader_protocol_version",{}).catch(()=>null):null;
    const readerReady=readerProtocol?.ok===true&&readerProtocol.data==="v1";
    return reply(200,{status:"online",service:"Cpi Attendance HR API",mode:"tenant-authenticated",
      dbReady:!!(DB&&PUB&&ADMIN),
      capabilities:{hr_bound_android_enrollment:readerReady?"v1":"unavailable",manual_claim:false}},origin);
  }
  if(!DB||!PUB||!ADMIN)return reply(503,{error:"api_not_configured"},origin);
  try{
    if(path==="/api/auth/login"){
      if(req.method!=="POST")return reply(405,{error:"method_not_allowed"},origin);
      const b=await input(req);
      const org=safeText(b.organization_code,6).trim();
      const hrCode=safeText(b.employee_code,6).trim().toUpperCase();
      const password=safeText(b.password,128);
      if(!/^[0-9]{6}$/.test(org)||!/^[A-Z0-9]{6}$/.test(hrCode)||
       password.length<12)return reply(401,{error:"invalid_credentials"},origin);
      // Rate limit before resolving alias to avoid HR account enumeration.
      for(const s of ["acct:"+org+":"+hrCode,"acct-ip:"+org+":"+hrCode+":"+
       (req.headers.get("x-forwarded-for")||"unknown").slice(0,90)]){
       const lim=await rpc("attendance_allow_login",{p_fingerprint:await fingerprint(s)});
       if(!lim.ok)return reply(lim.status===429?429:503,
        {error:lim.status===429?"login_rate_limited":"login_unavailable"},origin);
      }
      const lookup=await rpc("attendance_hr_resolve_login",{
        p_organization_code:org,p_login_code:hrCode
      });
      if(!lookup.ok||!lookup.data?.auth_user_id)
       return reply(401,{error:"invalid_credentials"},origin);
      // Lookup is server-only; neither email nor platform secret reaches a browser.
      const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||ADMIN;
      const userResponse=await fetch(DB+"/auth/v1/admin/users/"+lookup.data.auth_user_id,{
        method:"GET",headers:{"apikey":legacy,"Authorization":"Bearer "+legacy},
        signal:AbortSignal.timeout(8000)
      });
      const user=userResponse.ok?await userResponse.json().catch(()=>null):null;
      const email=user?.email||user?.user?.email;
      if(!email)return reply(503,{error:"account_lookup_unavailable"},origin);
      const auth=await fetch(DB+"/auth/v1/token?grant_type=password",{
       method:"POST",headers:{"Content-Type":"application/json","apikey":PUB},
       body:JSON.stringify({email,password}),signal:AbortSignal.timeout(9000)
      });
      if(!auth.ok)return reply(401,{error:"invalid_credentials"},origin);
      const tokens=await auth.json().catch(()=>null);
      if(!tokens?.access_token)return reply(401,{error:"invalid_credentials"},origin);
      const ctx=await rpc("attendance_login_context",{p_organization_code:org},tokens.access_token);
      if(!ctx.ok)return reply(403,{error:"account_not_authorized"},origin);
      // Return the verified principal of this organization-scoped HR login.
      // Android compares this against the server enrollment acknowledgement.
      return reply(200,{data:{access_token:tokens.access_token,
       expires_in:tokens.expires_in||3600,
       context:{...ctx.data,hr_user_id:lookup.data.auth_user_id}}},origin);
    }
    if(path==="/api/auth/request-password-setup"){
      if(req.method!=="POST")return reply(405,{error:"method_not_allowed"},origin);
      const b=await input(req,1200);
      const org=safeText(b.organization_code,6).trim();
      const code=safeText(b.employee_code,6).trim().toUpperCase();
      if(!/^[0-9]{6}$/.test(org)||!/^[A-Z0-9]{6}$/.test(code))
       return reply(422,{error:"invalid_scope"},origin);
      // Generic response by design: never disclose a tenant's user list.
      const generic={data:{request_received:true}};
      for(const marker of ["reset:"+org+":"+code,
       "reset-ip:"+org+":"+code+":"+(req.headers.get("x-forwarded-for")||"unknown").slice(0,90)]){
        const lim=await rpc("attendance_allow_login",{p_fingerprint:await fingerprint(marker)});
        if(!lim.ok)return reply(lim.status===429?429:503,
          {error:lim.status===429?"too_many_requests":"recovery_unavailable"},origin);
      }
      const lookup=await rpc("attendance_hr_resolve_login",{
       p_organization_code:org,p_login_code:code
      });
      if(!lookup.ok||!lookup.data?.auth_user_id)return reply(200,generic,origin);
      const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||ADMIN;
      const usr=await fetch(DB+"/auth/v1/admin/users/"+lookup.data.auth_user_id,{
       headers:{"apikey":legacy,"Authorization":"Bearer "+legacy},
       signal:AbortSignal.timeout(8000)
      });
      if(!usr.ok)return reply(200,generic,origin);
      const data=await usr.json().catch(()=>null);
      const email=data?.email||data?.user?.email;
      if(typeof email!=="string"||!email.includes("@"))return reply(200,generic,origin);
      await fetch(DB+"/auth/v1/recover?redirect_to="+encodeURIComponent(ORIGIN+"/welcome.html"),{
       method:"POST",headers:{"Content-Type":"application/json","apikey":PUB},
       body:JSON.stringify({email}),signal:AbortSignal.timeout(8000)
      }).catch(()=>null);
      return reply(200,generic,origin);
    }
    if(path==="/api/auth/complete-invite"){
      if(req.method!=="POST")return reply(405,{error:"method_not_allowed"},origin);
      const jwt=await hrAuth(req);
      if(!jwt)return reply(401,{error:"invite_session_invalid"},origin);
      const b=await input(req,1200),pw=safeText(b.password,128);
      if(pw.length<12||pw.length>128||!/[A-Za-z]/.test(pw)||!/[0-9]/.test(pw))
       return reply(422,{error:"weak_password"},origin);
      const response=await fetch(DB+"/auth/v1/user",{
       method:"PUT",headers:{"Content-Type":"application/json",
         "apikey":PUB,"Authorization":"Bearer "+jwt},
       body:JSON.stringify({password:pw}),signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)return reply(422,{error:"invite_password_update_failed"},origin);
      return reply(200,{data:{password_updated:true}},origin);
    }
    const isDevice=path.startsWith("/api/reader/");
    const token=(!isDevice||path==="/api/reader/enroll")?await hrAuth(req):null;
    if((!isDevice||path==="/api/reader/enroll")&&!token)
      return reply(401,{error:"login_required"},origin);
    const org=req.method==="GET"?query.get("organization_id"):null;
    if(!isDevice&&req.method==="GET"){
      if(!uuid(org))return reply(422,{error:"invalid_scope"},origin);
      const entitlement=await rpc("attendance_hr_package_valid",{p_organization_id:org});
      if(!entitlement.ok||entitlement.data!==true)
       return reply(403,{error:"subscription_inactive"},origin);
    }
    if(req.method==="GET"&&["/api/hr/applications","/api/hr/employees","/api/hr/dashboard"].includes(path)){
      if(!uuid(org))return reply(422,{error:"invalid_scope"},origin);
      const name=path==="/api/hr/applications"?"attendance_hr_list_applications":
       path==="/api/hr/employees"?"attendance_hr_list_employees":"attendance_hr_dashboard";
      const args=name==="attendance_hr_dashboard"?{p_organization_id:org}:{p_organization_id:org,p_limit:100};
      return responseRpc(await rpc(name,args,token),origin);
    }
    if(path==="/api/hr/team"&&req.method==="GET"){
      if(!uuid(org))return reply(422,{error:"invalid_scope"},origin);
      return responseRpc(await rpc("attendance_hr_list_members",{p_org:org},token),origin);
    }
    if(path==="/api/hr/reader/devices"&&req.method==="GET"){
      if(!uuid(org))return reply(422,{error:"invalid_scope"},origin);
      return responseRpc(await rpc("attendance_hr_reader_devices",{p_org:org},token),origin);
    }
    if(path==="/api/hr/reader/sessions"&&req.method==="GET"){
      const org=query.get("organization_id"),id=query.get("session_id");
      if(!uuid(org)||!uuid(id))return reply(422,{error:"invalid_scope"},origin);
      return responseRpc(await rpc("attendance_hr_reader_poll",{p_org:org,p_id:id},token),origin);
    }
    if(req.method!=="POST")return reply(405,{error:"method_not_allowed"},origin);
    const b=await input(req,path==="/api/reader/publish"?260000:4096);
    if(isDevice){
      if(!hex32(b.device_secret))return reply(422,{error:"invalid_payload"},origin);
      const hash=await digest(b.device_secret);
      if(path==="/api/reader/enroll"){
        if(!uuid(b.organization_id))return reply(422,{error:"invalid_scope"},origin);
        if(b.previous_device_secret!=null&&!hex32(b.previous_device_secret))
          return reply(422,{error:"invalid_payload"},origin);
        return responseRpc(await rpc("attendance_reader_device_enroll",
          {p_org:b.organization_id,p_device_hash:hash,
           p_previous_hash:b.previous_device_secret?await digest(b.previous_device_secret):null},
          token),origin);
      }
      if(path==="/api/reader/claim")
        return reply(410,{error:"reader_pairing_retired"},origin);
      if(path==="/api/reader/next"){
        return responseRpc(await rpc("attendance_reader_device_next",
          {p_device_hash:hash}),origin);
      }
      if(path==="/api/reader/status"){
        if(!uuid(b.session_id))return reply(422,{error:"invalid_payload"},origin);
        return responseRpc(await rpc("attendance_reader_device_status",
          {p_id:b.session_id,p_device_hash:hash}),origin);
      }
      if(!uuid(b.session_id))return reply(422,{error:"invalid_payload"},origin);
      if(path==="/api/reader/progress")
       return responseRpc(await rpc("attendance_reader_device_progress",{
        p_id:b.session_id,p_device_hash:hash}),origin);
      if(path==="/api/reader/publish"){
        const enc=b.payload;
        if(!enc||typeof enc!=="object"||Array.isArray(enc)||
         Object.keys(enc).sort().join(",")!=="ciphertext,iv,wrapped_key"||
         ![enc.ciphertext,enc.iv,enc.wrapped_key].every(v=>typeof v==="string"&&/^[A-Za-z0-9+/=]+$/.test(v))||
         enc.ciphertext.length>230000||enc.wrapped_key.length>700||enc.iv.length>40)
         return reply(422,{error:"reader_envelope_invalid"},origin);
        return responseRpc(await rpc("attendance_reader_device_publish",{
         p_id:b.session_id,p_device_hash:hash,p_envelope:enc}),origin);
      }
      return reply(404,{error:"not_found"},origin);
    }
    if(!uuid(b.organization_id))return reply(422,{error:"invalid_scope"},origin);
    const o=b.organization_id;
    const entitlement=await rpc("attendance_hr_package_valid",{p_organization_id:o});
    if(!entitlement.ok||entitlement.data!==true)
      return reply(403,{error:"subscription_inactive"},origin);
    if(path==="/api/hr/team/invite"){
      const code=safeText(b.hr_code,6).trim().toUpperCase();
      const email=safeText(b.email,254).trim().toLowerCase();
      if(!/^[A-Z0-9]{6}$/.test(code)||!/^\S+@\S+\.\S+$/.test(email))
        return reply(422,{error:"invalid_payload"},origin);
      const approved=await rpc("attendance_hr_assert_manager",{p_org:o},token);
      if(!approved.ok)return responseRpc(approved,origin);
      const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||ADMIN;
      const invitation=await fetch(DB+"/auth/v1/invite?redirect_to="+
       encodeURIComponent(ORIGIN+"/welcome.html"),{
        method:"POST",headers:{"Content-Type":"application/json",
          "apikey":legacy,"Authorization":"Bearer "+legacy},
        body:JSON.stringify({email}),signal:AbortSignal.timeout(10000)
      });
      if(!invitation.ok)return reply(409,{error:"hr_invite_email_unavailable"},origin);
      const invited=await invitation.json().catch(()=>null);
      const user=invited?.user||invited;
      if(!uuid(user?.id)||String(user.email||"").toLowerCase()!==email)
        return reply(503,{error:"hr_invite_identity_unavailable"},origin);
      const result=await rpc("attendance_hr_invite_member",{
        p_org:o,p_member:user.id,p_hr_code:code,p_email:email
      },token);
      return responseRpc(result,origin);
    }
    if(path==="/api/hr/team/disable"){
      const code=safeText(b.hr_code,6).trim().toUpperCase();
      if(!/^[A-Z0-9]{6}$/.test(code))return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_disable_member",{
        p_org:o,p_hr_code:code
      },token),origin);
    }
    if(path==="/api/hr/team/enable"){
      const code=safeText(b.hr_code,6).trim().toUpperCase();
      if(!/^[A-Z0-9]{6}$/.test(code))return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_enable_member",{
        p_org:o,p_hr_code:code
      },token),origin);
    }
    if(path==="/api/hr/reader/sessions"){
      const pub=safeText(b.public_key_spki,1400);
      if(pub.length<250||!/^[A-Za-z0-9+/=]+$/.test(pub))
       return reply(422,{error:"invalid_payload"},origin);
      const bytes=crypto.getRandomValues(new Uint8Array(16));
      const pairing=Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
      const r=await rpc("attendance_hr_reader_start",{
        p_org:o,p_id:crypto.randomUUID(),p_code_hash:await digest(pairing),p_public_key:pub
      },token);
      return responseRpc(r,origin); // Random session code is internal only, never shown or accepted.
    }
    if(path==="/api/hr/reader/consume"){
      if(!uuid(b.session_id))return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_reader_finish",{
       p_org:o,p_id:b.session_id,p_cancel:b.cancel===true},token),origin);
    }
    if(path==="/api/hr/reader/revoke"){
      if(!uuid(b.device_id))return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_reader_revoke",{
        p_org:o,p_device:b.device_id
      },token),origin);
    }
    if(path==="/api/hr/reader/saved"){
      if(!uuid(b.session_id)||!uuid(b.application_id))
        return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_reader_saved",{
       p_org:o,p_id:b.session_id,p_application:b.application_id
      },token),origin);
    }
    if(path==="/api/hr/applications"){
      const name=safeText(b.applicant_name,180).trim(),key=safeText(b.idempotency_key,128);
      if(name.length<2||!/^[A-Za-z0-9._:-]{12,128}$/.test(key)||
       b.consent_confirmed!==true||b.source!=="hr_manual")
       return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_submit_application",{
       p_organization_id:o,p_applicant_name:name,p_source:"hr_manual",
       p_idempotency_key:key,p_consent_confirmed:true},token),origin);
    }
    if(path==="/api/hr/applications/review"){
      const decision=safeText(b.decision,20),code=safeText(b.employee_code,48);
      if(!uuid(b.application_id)||!["approved","rejected"].includes(decision)||
       (decision==="approved"&&!/^[A-Za-z0-9._-]{2,48}$/.test(code)))
       return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_decide_application",{
       p_organization_id:o,p_application_id:b.application_id,p_decision:decision,
       p_employee_code:decision==="approved"?code:null},token),origin);
    }
    if(path==="/api/hr/applications/update"){
      const name=safeText(b.applicant_name,180).trim();
      if(!uuid(b.application_id)||name.length<2)return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_update_application",{
       p_organization_id:o,p_application_id:b.application_id,p_applicant_name:name},token),origin);
    }
    if(path==="/api/hr/applications/archive"){
      if(!uuid(b.application_id)||!["withdrawn","duplicate","entered_in_error"].includes(b.reason))
       return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_archive_application",{
       p_organization_id:o,p_application_id:b.application_id,p_reason:b.reason},token),origin);
    }
    if(path==="/api/hr/employees/confirm"){
      if(!uuid(b.employee_id))return reply(422,{error:"invalid_payload"},origin);
      return responseRpc(await rpc("attendance_hr_confirm_probation",{
       p_organization_id:o,p_employee_id:b.employee_id},token),origin);
    }
    return reply(404,{error:"not_found"},origin);
  }catch(err){
    // Do not reflect raw exception strings that could reveal schema or identity data.
    return reply(err instanceof SyntaxError?422:503,
      {error:err instanceof SyntaxError?"invalid_payload":"service_unavailable"},origin);
  }
});
