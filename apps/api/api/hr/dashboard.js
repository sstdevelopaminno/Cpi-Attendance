import {applyCors,reply,asUuid} from "../../lib/http.js";
import {rpc,requireSession} from "../../lib/supabase.js";
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="GET")return reply(res,405,{error:"method_not_allowed"});
 const session=await requireSession(req,res);if(!session)return;
 const org=asUuid(new URL(req.url,"https://local.invalid").searchParams.get("organization_id"));
 if(!org)return reply(res,422,{error:"invalid_scope"});
 const r=await rpc("attendance_hr_dashboard",{p_organization_id:org},session.token);
 return reply(res,r.status,r.ok?{data:r.data}:r.data);
}