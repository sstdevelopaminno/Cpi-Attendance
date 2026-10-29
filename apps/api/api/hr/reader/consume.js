import {applyCors,reply,parseBody,asUuid} from "../../../lib/http.js";
import {rpc,requireSession} from "../../../lib/supabase.js";
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
 const session=await requireSession(req,res);if(!session)return;
 try{
  const body=parseBody(req),org=asUuid(body.organization_id),id=asUuid(body.session_id);
  if(!org||!id)return reply(res,422,{error:"invalid_payload"});
  const r=await rpc("attendance_hr_reader_finish",{p_org:org,p_id:id,p_cancel:body.cancel===true},session.token);
  return reply(res,r.status,r.ok?{data:r.data}:r.data);
 }catch{return reply(res,422,{error:"invalid_payload"});}
}
