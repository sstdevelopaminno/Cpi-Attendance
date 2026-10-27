import { applyCors,reply,parseBody,asUuid } from "../../lib/http.js";
import { rpc,requireSession } from "../../lib/supabase.js";
export default async function handler(req,res) {
  if(!applyCors(req,res))return;
  if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
  const session=await requireSession(req,res);if(!session)return;
  try {
    const b=parseBody(req);
    const organizationId=asUuid(b.organization_id),siteId=asUuid(b.site_id);
    if(!organizationId||!siteId)return reply(res,422,{error:"invalid_scope"});
    const result=await rpc("attendance_issue_qr",
      {p_organization_id:organizationId,p_site_id:siteId},session.token);
    return reply(res,result.status,result.ok?{data:result.data}:result.data);
  }catch{return reply(res,422,{error:"invalid_payload"});}
}
