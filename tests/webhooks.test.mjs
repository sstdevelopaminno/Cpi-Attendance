import assert from "node:assert/strict";
import test from "node:test";
import {signWebhook,verifyWebhook} from "../packages/integration/src/webhooks.mjs";
const args={secret:"a".repeat(48),timestamp:1793095200,
eventId:"c7baad8e-19ca-4dc5-8b6c-0a90c500fb31",rawBody:'{"event":"punch.accepted"}'};
test("validly signed webhook passes verification",()=>{
  const signature=signWebhook(args);
  assert.equal(verifyWebhook({...args,signature,now:args.timestamp*1000}),true);
});
test("tampering, stale timestamps, malformed signatures fail",()=>{
  const signature=signWebhook(args);
  assert.equal(verifyWebhook({...args,signature,rawBody:"{}",now:args.timestamp*1000}),false);
  assert.equal(verifyWebhook({...args,signature,now:(args.timestamp+301)*1000}),false);
  assert.equal(verifyWebhook({...args,signature:"v1=abcd",now:args.timestamp*1000}),false);
});
