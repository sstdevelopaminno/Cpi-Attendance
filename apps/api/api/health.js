import { applyCors,reply } from "../lib/http.js";
export default async function handler(req,res) {
  if(!applyCors(req,res)) return;
  if(req.method!=="GET")return reply(res,405,{error:"method_not_allowed"});
  return reply(res,200,{service:"Cpi Attendance API",status:"foundation",ready:false});
}
