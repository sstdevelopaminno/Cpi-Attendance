import {createHash} from "node:crypto";
import {applyCors,reply,parseBody,asUuid} from "../../lib/http.js";
import {rpc} from "../../lib/supabase.js";
const hash=value=>createHash("sha256").update(value).digest("hex");
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
 if(!process.env.ATTENDANCE_SUPABASE_SERVICE_KEY)
  return reply(res,503,{error:"reader_server_not_configured"});
 try{
  const b=parseBody(req),id=asUuid(b.session_id),secret=String(b.device_secret??"");
  if(!id||!/^[a-f0-9]{32}$/.test(secret))return reply(res,422,{error:"invalid_payload"});
  const r=await rpc("attendance_reader_device_progress",
   {p_id:id,p_device_hash:hash(secret)},null,{admin:true});
  return reply(res,r.status,r.ok?{data:r.data}:r.data);
 }catch{return reply(res,422,{error:"invalid_payload"});}
}
