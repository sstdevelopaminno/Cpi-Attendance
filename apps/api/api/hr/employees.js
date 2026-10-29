import {applyCors,reply,asUuid} from "../../lib/http.js";
import {rpc,requireSession} from "../../lib/supabase.js";
export default async function handler(req,res){
  if(!applyCors(req,res))return;
  if(req.method!=="GET")return reply(res,405,{error:"method_not_allowed"});
  const session=await requireSession(req,res);if(!session)return;
  const id=asUuid(new URL(req.url,"https://local.invalid").searchParams.get("organization_id"));
  if(!id)return reply(res,422,{error:"invalid_scope"});
  const result=await rpc("attendance_hr_list_employees",
    {p_organization_id:id,p_limit:100},session.token);
  return reply(res,result.status,result.ok?{data:result.data}:result.data);
}
