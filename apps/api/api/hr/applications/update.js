import {applyCors,reply,parseBody,asUuid} from "../../../lib/http.js";
import {rpc,requireSession} from "../../../lib/supabase.js";
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
 const session=await requireSession(req,res);if(!session)return;
 try{
  const body=parseBody(req),org=asUuid(body.organization_id),id=asUuid(body.application_id);
  const name=String(body.applicant_name??"").trim();
  if(!org||!id||name.length<2||name.length>180)return reply(res,422,{error:"invalid_payload"});
  const result=await rpc("attendance_hr_update_application",
   {p_organization_id:org,p_application_id:id,p_applicant_name:name},session.token);
  return reply(res,result.status,result.ok?{data:result.data}:result.data);
 }catch{return reply(res,422,{error:"invalid_payload"});}
}