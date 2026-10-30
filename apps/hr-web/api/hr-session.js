// Same-origin cookie boundary for HR Web. No Supabase secret or HR password
// is stored here. A rotated Supabase refresh token stays in HttpOnly Secure cookie.
const API="https://wznixoeezgyhtwurcswb.supabase.co/functions/v1/attendance-api";
const COOKIE="__Host-cpi_hr_session";
const allowOrg=s=>typeof s==="string"&&/^[0-9]{6}$/.test(s);
const sameOrigin=req=>{
 const host=String(req.headers.host||"");
 const origin=String(req.headers.origin||"");
 return host.endsWith(".vercel.app")&&(!origin||origin==="https://"+host);
};
const headers={"Cache-Control":"no-store, no-cache, must-revalidate","Pragma":"no-cache",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const packed=info=>Buffer.from(JSON.stringify(info),"utf8").toString("base64url");
const unpacked=req=>{
 const cookies=String(req.headers.cookie||"").split(";").map(x=>x.trim());
 const entry=cookies.find(x=>x.startsWith(COOKIE+"="));
 if(!entry)return null;
 try{
  const raw=JSON.parse(Buffer.from(entry.slice(COOKIE.length+1),"base64url").toString("utf8"));
  return allowOrg(raw.org)&&typeof raw.refresh==="string"&&raw.refresh.length>=30&&raw.refresh.length<=2500&&
   typeof raw.hr==="string"&&/^[A-Z0-9]{6}$/.test(raw.hr)?raw:null;
 }catch{return null}
};
const cookie=(data,maxAge)=>COOKIE+"="+(data?packed(data):"deleted")+
 "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age="+maxAge;
async function rotate(refresh,org,op="refresh"){
 const response=await fetch(API+"/api/auth/"+op,{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({refresh_token:refresh,organization_code:org}),
  signal:AbortSignal.timeout(13000)
 });
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.data)return null;
 return result.data;
}
module.exports = async function handler(req,res){
 try{
 for(const [key,val] of Object.entries(headers))res.setHeader(key,val);
 if(!sameOrigin(req)){res.status(403).json({error:"origin_forbidden"});return}
 if(!["GET","POST","DELETE"].includes(req.method)){
  res.setHeader("Allow","GET, POST, DELETE");res.status(405).json({error:"method_not_allowed"});return;
 }
 if(req.method==="POST"){
  const data=req.body&&typeof req.body==="object"?req.body:{};
  if(!allowOrg(data.org)||!/^[A-Z0-9]{6}$/.test(data.hr||"")||
     typeof data.refresh_token!=="string"||data.refresh_token.length<30||
     data.refresh_token.length>2500){
    res.status(422).json({error:"invalid_session"});return;
  }
  // Use the refresh token once, validate a live authorized tenant, and rotate.
  const token=await rotate(data.refresh_token,data.org);
  if(!token||!["owner","hr_admin"].includes(token.context?.role)){
   res.status(401).json({error:"session_invalid"});return;
  }
  res.setHeader("Set-Cookie",cookie({
   org:data.org,hr:data.hr,refresh:token.refresh_token},2592000));
  res.status(200).json({access_token:token.access_token,expires_in:token.expires_in,
   context:token.context,hr_code:data.hr});return;
 }
 const state=unpacked(req);
 if(req.method==="DELETE"){
  res.setHeader("Set-Cookie",cookie(null,0));
  if(state)await rotate(state.refresh,state.org,"logout").catch(()=>null);
  res.status(200).json({logged_out:true});return;
 }
 if(!state){res.status(401).json({error:"no_session"});return}
 const token=await rotate(state.refresh,state.org).catch(()=>null);
 if(!token||!["owner","hr_admin"].includes(token.context?.role)){
  res.setHeader("Set-Cookie",cookie(null,0));
  res.status(401).json({error:"session_expired"});return;
 }
 res.setHeader("Set-Cookie",cookie({
  org:state.org,hr:state.hr,refresh:token.refresh_token},2592000));
 res.status(200).json({access_token:token.access_token,expires_in:token.expires_in,
  context:token.context,hr_code:state.hr});
 }catch{
  // Do not expose session cookies or refresh material in errors.
  res.status(503).json({error:"session_unavailable"});
 }
}