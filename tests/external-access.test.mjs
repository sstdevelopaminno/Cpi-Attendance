import assert from "node:assert/strict";
import test from "node:test";
import {authorizeExternalGrant,publicAttendanceEvent} from "../packages/integration/src/external-access.mjs";
const a="20000000-0000-4000-8000-000000000001",b="20000000-0000-4000-8000-000000000002";
const grant={organizationId:a,status:"active",revoked:false,features:["ATT_EXTERNAL_API"],
 scopes:["attendance:read","attendance:write"],expiresAtMs:2000000000000};
test("external HR client can omit HR Web and use scoped read only",()=>{
 assert.equal(authorizeExternalGrant({trustedGrant:grant,requestedOrganizationId:a,scope:"attendance:read",nowMs:1900000000000}).allowed,true);
 assert.equal(authorizeExternalGrant({trustedGrant:grant,requestedOrganizationId:b,scope:"attendance:read",nowMs:1900000000000}).allowed,false);
});
test("revoked, expired, unlicensed or wrong scope denied",()=>{
 const f=(g,s="attendance:read")=>authorizeExternalGrant({trustedGrant:g,requestedOrganizationId:a,scope:s,nowMs:1900000000000});
 assert.equal(f({...grant,revoked:true}).allowed,false);
 assert.equal(f({...grant,expiresAtMs:1}).allowed,false);
 assert.equal(f({...grant,features:[]}).allowed,false);
 assert.equal(f(grant,"payroll:read").allowed,false);
});
test("outbound event excludes arbitrary untrusted source fields",()=>{
 const record=publicAttendanceEvent({organizationId:a,eventId:"10000000-0000-4000-8000-000000000001",
 employeeId:"30000000-0000-4000-8000-000000000001",eventType:"check_in",
 occurredAt:"2026-10-29T01:00:00.000Z",method:"qr",untrustedCustomField:"private"});
 assert.equal(record.event_type,"check_in");
 assert.equal("untrustedCustomField" in record,false);
 assert.equal(Object.isFrozen(record),true);
});
