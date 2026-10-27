export function applyCors(req,res,allowedOrigins=process.env.ATTENDANCE_ALLOWED_ORIGINS??"") {
  const origin=String(req.headers?.origin??"").trim();
  const allowed=new Set(allowedOrigins.split(",").map(s=>s.trim()).filter(Boolean));
  if (origin && !allowed.has(origin)) {
    reply(res,403,{error:"origin_forbidden"});
    return false;
  }
  if(origin){
    res.setHeader("Access-Control-Allow-Origin",origin);
    res.setHeader("Vary","Origin");
    res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  }
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method==="OPTIONS"){res.statusCode=204;res.end();return false;}
  return true;
}
export function reply(res,status,data) {
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(data));
}
export function parseBody(req) {
  if(Number(req.headers?.["content-length"]??"0")>4096) throw new Error("payload_too_large");
  if(typeof req.body==="string") return JSON.parse(req.body);
  if(req.body && typeof req.body==="object" && !Array.isArray(req.body)) return req.body;
  throw new Error("invalid_json");
}
export function tokenFromRequest(req) {
  const value=String(req.headers?.authorization??"");
  const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(value);
  return match?match[1]:null;
}
export function asUuid(input) {
  const value=String(input??"");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:null;
}
export function configured() {
  const base=process.env.ATTENDANCE_SUPABASE_URL;
  const key=process.env.ATTENDANCE_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(base?.startsWith("https://") && key);
}
