import {applyCors,reply,parseBody,asUuid} from "../../../lib/http.js";
import {rpc,requireSession} from "../../../lib/supabase.js";
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
 const session=await requireSession(req,res);if(!session)return;
 try{
  const body=parseBody(req),org=asUuid(body.organization_id),id=asUuid(body.application_id);
  const reason=String(body.reason??"");
  if(!org||!id||!["withdrawn","duplicate","entered_in_error"].includes(reason))
    return reply(res,422,{error:"invalid_payload"});
  const result=await rpc("attendance_hr_archive_application",
   {p_organization_id:org,p_application_id:id,p_reason:reason},session.token);
  return reply(res,result.status,result.ok?{data:result.data}:result.data);
 }catch{return reply(res,422,{error:"invalid_payload"});}
}