import {createHash} from "node:crypto";
import {applyCors,reply,asUuid} from "../../lib/http.js";
import {rpc} from "../../lib/supabase.js";
const hash=value=>createHash("sha256").update(value).digest("hex");
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
 if(!process.env.ATTENDANCE_SUPABASE_SERVICE_KEY)
  return reply(res,503,{error:"reader_server_not_configured"});
 try{
  if(Number(req.headers?.["content-length"]??"0")>260000)
   return reply(res,413,{error:"reader_payload_too_large"});
  const b=typeof req.body==="string"?JSON.parse(req.body):req.body;
  if(!b||typeof b!=="object"||Array.isArray(b))
   return reply(res,422,{error:"invalid_payload"});
  const id=asUuid(b.session_id),secret=String(b.device_secret??""),
   enc=b.payload;
  if(!id||!/^[a-f0-9]{32}$/.test(secret)||!enc||typeof enc!=="object"||Array.isArray(enc))
   return reply(res,422,{error:"invalid_payload"});
  if(Object.keys(enc).sort().join(",")!=="ciphertext,iv,wrapped_key"||
    ![enc.ciphertext,enc.iv,enc.wrapped_key].every(v=>typeof v==="string"&&/^[A-Za-z0-9+/=]+$/.test(v))||
    enc.ciphertext.length>230000||enc.wrapped_key.length>700||enc.iv.length>40)
   return reply(res,422,{error:"reader_envelope_invalid"});
  const r=await rpc("attendance_reader_device_publish",{
   p_id:id,p_device_hash:hash(secret),p_envelope:enc
  },null,{admin:true});
  return reply(res,r.status,r.ok?{data:r.data}:r.data);
 }catch{return reply(res,422,{error:"invalid_payload"});}
}
