import {applyCors,reply,parseBody,asUuid} from "../../../lib/http.js";
import {rpc,requireSession} from "../../../lib/supabase.js";
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
 const session=await requireSession(req,res);if(!session)return;
 try{
  const input=parseBody(req);
  const org=asUuid(input.organization_id),employee=asUuid(input.employee_id);
  if(!org||!employee)return reply(res,422,{error:"invalid_payload"});
  const result=await rpc("attendance_hr_confirm_probation",
   {p_organization_id:org,p_employee_id:employee},session.token);
  return reply(res,result.status,result.ok?{data:result.data}:result.data);
 }catch{return reply(res,422,{error:"invalid_payload"});}
}