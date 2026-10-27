import { createHmac,timingSafeEqual } from "node:crypto";
// Only the authenticated backend signs/validates messages. Never run this in PWA.
const canonical=(timestamp,eventId,rawBody)=>`${timestamp}.${eventId}.${rawBody}`;
export function signWebhook({secret,timestamp,eventId,rawBody}){
  if(typeof secret!=="string"||secret.length<32)throw new TypeError("invalid_webhook_secret");
  if(!Number.isSafeInteger(timestamp)||timestamp<0)throw new TypeError("invalid_timestamp");
  if(!/^[0-9a-f-]{36}$/i.test(eventId))throw new TypeError("invalid_event_id");
  if(typeof rawBody!=="string"||rawBody.length>1000000)throw new TypeError("invalid_payload");
  return "v1="+createHmac("sha256",secret).update(canonical(timestamp,eventId,rawBody)).digest("hex");
}
export function verifyWebhook({secret,timestamp,eventId,rawBody,signature,now=Date.now(),ttlSeconds=300}){
  if(!Number.isSafeInteger(timestamp)||Math.abs(Math.floor(now/1000)-timestamp)>ttlSeconds)return false;
  if(typeof signature!=="string"||!/^v1=[0-9a-f]{64}$/.test(signature))return false;
  let expected;
  try{expected=signWebhook({secret,timestamp,eventId,rawBody});}catch{return false;}
  const a=Buffer.from(expected),b=Buffer.from(signature);
  return a.length===b.length&&timingSafeEqual(a,b);
}
// Verify signature before recording eventId in a DB uniqueness table to stop
// replay inside the valid 5-minute time window.
