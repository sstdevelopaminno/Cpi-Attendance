import assert from "node:assert/strict";
import test from "node:test";
import {resolvePosStaffAccess} from "../packages/integration/src/pos-adapter.mjs";
const org="20000000-0000-4000-8000-000000000001";
const grant={status:"active",revoked:false,expiresAtMs:2000000000000,
 features:["ATT_POS_ADDON"],attendanceOrganizationId:org};
const mapping={posTenantId:"POS_A",attendanceOrganizationId:org,
 sourceEmployeeCode:"STAFF001",attendanceEmployeeId:"30000000-0000-4000-8000-000000000001"};
const run=(g=grant,m=mapping,pos="POS_A")=>resolvePosStaffAccess({license:g,mapping:m,
 requestedPosTenantId:pos,attendanceOrganizationId:org,
 sourceEmployeeCode:"STAFF001",nowMs:1900000000000});
test("authorized POS staff mapping resolves to separate Attendance employee UUID",()=>{
 assert.equal(run().allowed,true);assert.equal(run().employeeId,mapping.attendanceEmployeeId);
});
test("POS add-on blocks tenant mismatch, expired subscription and missing module",()=>{
 assert.equal(run(grant,mapping,"POS_B").allowed,false);
 assert.equal(run({...grant,features:[]}).allowed,false);
 assert.equal(run({...grant,expiresAtMs:1}).allowed,false);
 assert.equal(run({...grant,revoked:true}).allowed,false);
 assert.equal(run(grant,{...mapping,attendanceEmployeeId:"bad"}).allowed,false);
});
