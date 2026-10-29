import {randomBytes,randomUUID,createHash} from "node:crypto";
import {applyCors,reply,parseBody,asUuid} from "../../../lib/http.js";
import {rpc,requireSession} from "../../../lib/supabase.js";
const hash=value=>createHash("sha256").update(value).digest("hex");
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(!["GET","POST"].includes(req.method))return reply(res,405,{error:"method_not_allowed"});
 const session=await requireSession(req,res);if(!session)return;
 if(req.method==="GET"){
  const url=new URL(req.url,"https://local.invalid");
  const org=asUuid(url.searchParams.get("organization_id")),
   id=asUuid(url.searchParams.get("session_id"));
  if(!org||!id)return reply(res,422,{error:"invalid_scope"});
  const r=await rpc("attendance_hr_reader_poll",{p_org:org,p_id:id},session.token);
  return reply(res,r.status,r.ok?{data:r.data}:r.data);
 }
 try{
  const body=parseBody(req),org=asUuid(body.organization_id),pub=String(body.public_key_spki??"");
  if(!org||pub.length<250||pub.length>1400||!/^[A-Za-z0-9+/=]+$/.test(pub))
   return reply(res,422,{error:"invalid_payload"});
  const code=randomBytes(16).toString("hex"),id=randomUUID();
  const r=await rpc("attendance_hr_reader_start",{
   p_org:org,p_id:id,p_code_hash:hash(code),p_public_key:pub
  },session.token);
  return reply(res,r.status,r.ok?{data:r.data}:r.data); // Never reveal internal code
 }catch{return reply(res,422,{error:"invalid_payload"});}
}
