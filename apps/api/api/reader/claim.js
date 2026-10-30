import {applyCors,reply} from "../../lib/http.js";
export default async function handler(req,res){
 if(!applyCors(req,res))return;
 if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
 return reply(res,410,{error:"reader_pairing_retired"});
}
