import { applyCors,reply,parseBody,asUuid } from "../../lib/http.js";
import { rpc,requireSession } from "../../lib/supabase.js";
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"));
export default async function handler(req,res){
  if(!applyCors(req,res))return;
  if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
  const session=await requireSession(req,res);if(!session)return;
  try{
    const b=parseBody(req);
    const id=asUuid(b.organization_id);
    if(!id||!/^[a-z_]{3,40}$/.test(String(b.leave_type??""))
       ||!validDate(b.start_date)||!validDate(b.end_date)
       ||String(b.note??"").length>1000)return reply(res,422,{error:"invalid_payload"});
    const result=await rpc("attendance_request_leave",{
      p_organization_id:id,p_leave_type:b.leave_type,
      p_start_date:b.start_date,p_end_date:b.end_date,p_note:String(b.note??"")
    },session.token);
    return reply(res,result.status,result.ok?{data:result.data}:result.data);
  }catch{return reply(res,422,{error:"invalid_payload"});}
}
