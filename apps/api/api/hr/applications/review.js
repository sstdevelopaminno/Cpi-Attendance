import {applyCors,reply,parseBody,asUuid} from "../../../lib/http.js";
import {rpc,requireSession} from "../../../lib/supabase.js";
export default async function handler(req,res){
  if(!applyCors(req,res))return;
  if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
  const session=await requireSession(req,res);if(!session)return;
  try{
    const b=parseBody(req),org=asUuid(b.organization_id),app=asUuid(b.application_id);
    const decision=String(b.decision??""),code=String(b.employee_code??"");
    if(!org||!app||!["approved","rejected"].includes(decision)
      ||(decision==="approved"&&!/^[A-Za-z0-9._-]{2,48}$/.test(code)))
      return reply(res,422,{error:"invalid_payload"});
    const result=await rpc("attendance_hr_decide_application",{
      p_organization_id:org,p_application_id:app,
      p_decision:decision,p_employee_code:decision==="approved"?code:null
    },session.token);
    return reply(res,result.status,result.ok?{data:result.data}:result.data);
  }catch{return reply(res,422,{error:"invalid_payload"});}
}
