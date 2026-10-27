import assert from "node:assert/strict";
import test from "node:test";
import {cardFingerprint,validateKioskAssertion} from "../packages/kiosk/src/card-contract.mjs";
test("card fingerprint never returns or embeds a national ID",()=>{
  const secret="secret".repeat(8),id="1234567890123";
  const fingerprint=cardFingerprint({identityNumber:id,tenantSecret:secret});
  assert.equal(fingerprint.length,64);
  assert.ok(!fingerprint.includes(id));
  assert.notEqual(fingerprint,cardFingerprint({identityNumber:id,tenantSecret:"other".repeat(8)}));
});
test("hardware assertion does not by itself authenticate staff",()=>{
  assert.equal(validateKioskAssertion({deviceId:"missing",cardFingerprint:"x",observedAt:0,signature:""}),false);
  assert.throws(()=>cardFingerprint({identityNumber:"123",tenantSecret:"secret".repeat(8)}));
});
