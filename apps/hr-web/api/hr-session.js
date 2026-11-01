import { Buffer } from "node:buffer";

const API="https://wznixoeezgyhtwurcswb.supabase.co/functions/v1/attendance-api";
const COOKIE="__Host-cpi_hr_session";
const baseHeaders={"Cache-Control":"no-store, no-cache, must-revalidate",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const allowOrg=s=>typeof s==="string"&&/^[0-9]{6}$/.test(s);
const makeCookie=(value,maxAge)=>
 COOKIE+"="+(value?Buffer.from(JSON.stringify(value),"utf8").toString("base64url"):"deleted")+
 "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age="+maxAge;
function json(data,status=200,cookie){
 return new Response(JSON.stringify(data),{status,headers:{
  ...baseHeaders,"Content-Type":"application/json; charset=utf-8",
  ...(cookie?{"Set-Cookie":cookie}:{})
 }});
}
function allowed(request){
 const url=new URL(request.url);
 return url.protocol==="https:"&&url.hostname.endsWith(".vercel.app")&&
  (!request.headers.get("origin")||request.headers.get("origin")===url.origin);
}
function readSession(request){
 const line=request.headers.get("cookie")||"";
 const pair=line.split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="));
 if(!pair)return null;
 try{
  const raw=JSON.parse(Buffer.from(pair.slice(COOKIE.length+1),"base64url").toString("utf8"));
  return allowOrg(raw.org)&&/^[A-Z0-9]{6}$/.test(raw.hr)&&
   typeof raw.refresh==="string"&&raw.refresh.length>=30&&raw.refresh.length<=2500?raw:null;
 }catch{return null}
}
async function rotate(refresh,org,action="refresh"){
 try{
  const response=await fetch(API+"/api/auth/"+action,{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({refresh_token:refresh,organization_code:org}),
   signal:AbortSignal.timeout(13000)
  });
  const payload=await response.json().catch(()=>null);
  return response.ok&&payload?.data?payload.data:null;
 }catch{return null}
}
function sessionResponse(token,org,hr){
 return json({access_token:token.access_token,expires_in:token.expires_in,
   context:token.context,hr_code:hr},200,makeCookie(
   {org,hr,refresh:token.refresh_token},2592000));
}
export async function GET(request){
 if(!allowed(request))return json({error:"origin_forbidden"},403);
 const state=readSession(request);
 if(!state)return json({error:"no_session"},401);
 const token=await rotate(state.refresh,state.org);
 if(!token||!["owner","hr_admin"].includes(token.context?.role))
  return json({error:"session_expired"},401,makeCookie(null,0));
 return sessionResponse(token,state.org,state.hr);
}
export async function POST(request){
 if(!allowed(request))return json({error:"origin_forbidden"},403);
 const size=Number(request.headers.get("content-length")||"0");
 if(size>5000)return json({error:"invalid_session"},422);
 let data;try{data=await request.json()}catch{return json({error:"invalid_session"},422)}
 if(!allowOrg(data?.org)||!/^[A-Z0-9]{6}$/.test(data?.hr||"")||
  typeof data?.refresh_token!=="string"||data.refresh_token.length<30||data.refresh_token.length>2500)
  return json({error:"invalid_session"},422);
 const token=await rotate(data.refresh_token,data.org);
 if(!token||!["owner","hr_admin"].includes(token.context?.role))
  return json({error:"session_invalid"},401);
 return sessionResponse(token,data.org,data.hr);
}
export async function DELETE(request){
 if(!allowed(request))return json({error:"origin_forbidden"},403);
 const state=readSession(request);
 if(state)await rotate(state.refresh,state.org,"logout");
 return json({logged_out:true},200,makeCookie(null,0));
}
