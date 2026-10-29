import {applyCors,reply,parseBody,asUuid} from "../../lib/http.js";
import {rpc,requireSession} from "../../lib/supabase.js";
export default async function handler(req,res){
  if(!applyCors(req,res))return;
  if(!["GET","POST"].includes(req.method))return reply(res,405,{error:"method_not_allowed"});
  const session=await requireSession(req,res);if(!session)return;
  if(req.method==="GET"){
    const id=asUuid(new URL(req.url,"https://local.invalid").searchParams.get("organization_id"));
    if(!id)return reply(res,422,{error:"invalid_scope"});
    const result=await rpc("attendance_hr_list_applications",
      {p_organization_id:id,p_limit:100},session.token);
    return reply(res,result.status,result.ok?{data:result.data}:result.data);
  }
  try{
    const b=parseBody(req),org=asUuid(b.organization_id);
    const name=String(b.applicant_name??"").trim();
    const key=String(b.idempotency_key??"");
    const source=String(b.source??"hr_manual");
    if(!org||name.length<2||name.length>180
      ||!["hr_manual","android_hr","web_application"].includes(source)
      ||!/^[A-Za-z0-9._:-]{12,128}$/.test(key)
      ||b.consent_confirmed!==true)
      return reply(res,422,{error:"invalid_payload"});
    const result=await rpc("attendance_hr_submit_application",{
      p_organization_id:org,p_applicant_name:name,p_source:source,
      p_idempotency_key:key,p_consent_confirmed:true
    },session.token);
    return reply(res,result.status,result.ok?{data:result.data}:result.data);
  }catch{return reply(res,422,{error:"invalid_payload"});}
}
