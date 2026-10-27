import { applyCors,reply,parseBody,asUuid } from "../../lib/http.js";
import { rpc,requireSession } from "../../lib/supabase.js";
export default async function handler(req,res) {
  if(!applyCors(req,res))return;
  if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
  const session=await requireSession(req,res);if(!session)return;
  try{
    const b=parseBody(req);
    const organizationId=asUuid(b.organization_id);
    if(!organizationId||!["check_in","check_out"].includes(b.event_type)
      ||!/^[a-zA-Z0-9._:-]{12,128}$/.test(String(b.idempotency_key??""))
      || !/^[0-9a-f]{64}$/.test(String(b.qr_nonce??"")))return reply(res,422,{error:"invalid_payload"});
    const lat=Number(b.latitude),lon=Number(b.longitude),accuracy=Number(b.accuracy_m);
    if(b.latitude==null||b.longitude==null||b.accuracy_m==null
       ||!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy))
      return reply(res,422,{error:"location_required"});
    const result=await rpc("attendance_record_punch",{
      p_organization_id:organizationId,p_event_type:b.event_type,
      p_idempotency_key:b.idempotency_key,p_qr_nonce:b.qr_nonce,
      p_lat:lat,p_lon:lon,p_accuracy_m:accuracy},session.token);
    return reply(res,result.status,result.ok?{data:result.data}:result.data);
  }catch{return reply(res,422,{error:"invalid_payload"});}
}
