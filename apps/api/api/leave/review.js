import { applyCors,reply,parseBody,asUuid } from "../../lib/http.js";
import { rpc,requireSession } from "../../lib/supabase.js";
export default async function handler(req,res){
  if(!applyCors(req,res))return;
  if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
  const session=await requireSession(req,res);if(!session)return;
  try{
    const b=parseBody(req),org=asUuid(b.organization_id),id=asUuid(b.request_id);
    if(!org||!id||!["approved","rejected"].includes(b.decision)
       ||String(b.reason??"").length>1000)return reply(res,422,{error:"invalid_payload"});
    const result=await rpc("attendance_review_leave",{
      p_organization_id:org,p_request_id:id,p_decision:b.decision,p_reason:String(b.reason??"")
    },session.token);
    return reply(res,result.status,result.ok?{data:result.data}:result.data);
  }catch{return reply(res,422,{error:"invalid_payload"});}
}
