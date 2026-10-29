import test from "node:test";
import assert from "node:assert/strict";
import employeeHandler from "../apps/api/api/hr/employees.js";
import applicantHandler from "../apps/api/api/hr/applications.js";
import confirmHandler from "../apps/api/api/hr/employees/confirm.js";
import updateApplicant from "../apps/api/api/hr/applications/update.js";
import archiveApplicant from "../apps/api/api/hr/applications/archive.js";
import readerSessions from "../apps/api/api/hr/reader/sessions.js";
import readerClaim from "../apps/api/api/reader/claim.js";
import readerPublish from "../apps/api/api/reader/publish.js";
import eventHandler from "../apps/api/api/hr/time-events.js";
const ORG_A="20000000-0000-4000-8000-000000000001";
const TOKEN="fake.jwt.signature"; // Synthetic test only; no project secrets.
function res(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},
  end(v){this.body=v;this.ended=true}};}
function req(method,url,opts={}){return {method,url,headers:{
  origin:"https://hr.example.test",authorization:"Bearer "+TOKEN,...opts.headers},body:opts.body};}
function configure(){process.env.ATTENDANCE_SUPABASE_URL="https://staging-api-mock.invalid";
 process.env.ATTENDANCE_SUPABASE_PUBLISHABLE_KEY="synthetic-publishable-test-only";
 process.env.ATTENDANCE_ALLOWED_ORIGINS="https://hr.example.test";}
function fakeResponse(status,data){return {ok:status>=200&&status<300,status,
 json:async()=>data};}
async function withMock(mock,operation){const prev=globalThis.fetch;configure();globalThis.fetch=mock;
 try{return await operation();}finally{globalThis.fetch=prev;}}
test("HR staff roster is fetched with bearer auth via scoped RPC",async()=>{
 const visits=[];
 await withMock(async(url,init)=>{
   visits.push({url:String(url),auth:init.headers.Authorization,apikey:init.headers.apikey});
   if(String(url).endsWith("/auth/v1/user"))
     return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
   if(String(url).endsWith("/rpc/attendance_hr_list_employees")){
     assert.deepEqual(JSON.parse(init.body),{p_organization_id:ORG_A,p_limit:100});
     return fakeResponse(200,[{code:"E001",name:"Synthetic Person",status:"active",has_login:true}]);
   }
   throw new Error("unexpected call");
 },async()=>{
    const r=res();await employeeHandler(req("GET","/api/hr/employees?organization_id="+ORG_A),r);
    assert.equal(r.statusCode,200);
    assert.equal(JSON.parse(r.body).data[0].code,"E001");
    assert.equal(r.headers["Access-Control-Allow-Origin"],"https://hr.example.test");
 });
 assert.equal(visits.length,2);
 assert.equal(visits.every(v=>v.auth==="Bearer "+TOKEN),true);
 assert.equal(visits.some(v=>v.auth.includes("service_role")),false);
});
test("cross-tenant HR call fails closed with no returned staff names",async()=>{
 await withMock(async(url)=>{
   if(String(url).endsWith("/auth/v1/user"))
     return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
   return fakeResponse(403,{message:"attendance_hr_forbidden"});
 },async()=>{
   const r=res();await employeeHandler(req("GET","/api/hr/employees?organization_id="+ORG_A),r);
   assert.equal(r.statusCode,403);
   assert.deepEqual(JSON.parse(r.body),{error:"attendance_hr_forbidden"});
 });
});
test("missing bearer and wrong origin are denied before touching Auth",async()=>{
 let count=0;
 await withMock(async()=>{count++;throw new Error("network must not run");},async()=>{
   let r=res();
   await eventHandler(req("GET","/api/hr/time-events?organization_id="+ORG_A,
     {headers:{authorization:""}}),r);
   assert.equal(r.statusCode,401);
   r=res();
   await eventHandler(req("GET","/api/hr/time-events?organization_id="+ORG_A,
     {headers:{origin:"https://other-tenant.invalid"}}),r);
   assert.equal(r.statusCode,403);
 });
 assert.equal(count,0);
});
test("HR candidate requires affirmative consent before any backend call",async()=>{
 let count=0;
 await withMock(async()=>{count++;throw new Error("network must not run");},async()=>{
   const r=res();await applicantHandler(req("POST","/api/hr/applications",
     {headers:{authorization:""},body:{organization_id:ORG_A,
      applicant_name:"Synthetic Candidate",source:"hr_manual",
      idempotency_key:"fake-test-candidate-001",consent_confirmed:false}}),r);
   assert.equal(r.statusCode,401);
 });
 assert.equal(count,0);
});
test("HR candidate RPC sends only reviewed minimal fields, never chip data",async()=>{
 let payload;
 await withMock(async(url,init)=>{
   if(String(url).endsWith("/auth/v1/user"))
     return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
   if(String(url).endsWith("/rpc/attendance_hr_submit_application")){
     payload=JSON.parse(init.body);
     return fakeResponse(200,{id:"50000000-0000-4000-8000-000000000001",status:"pending"});
   }
   throw new Error("unexpected path");
 },async()=>{
   const r=res();
   await applicantHandler(req("POST","/api/hr/applications",{body:{
     organization_id:ORG_A,applicant_name:"Synthetic Candidate",
     source:"hr_manual",idempotency_key:"fake-test-candidate-001",consent_confirmed:true,
     untrustedPhoto:"unapproved",untrustedIdentity:"unapproved"}}),r);
   assert.equal(r.statusCode,200);
 });
 assert.equal(payload.p_applicant_name,"Synthetic Candidate");
 assert.equal(Object.keys(payload).length,5);
 assert.equal(JSON.stringify(payload).includes("unapproved"),false);
});

test("unpaired Android application source is denied despite valid HR bearer token",async()=>{
 let rpcCalled=false;
 await withMock(async(url)=>{
  if(String(url).endsWith("/auth/v1/user"))
   return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
  rpcCalled=true;throw new Error("Android source cannot reach RPC before device binding");
 },async()=>{
  const r=res();
  await applicantHandler(req("POST","/api/hr/applications",{body:{
   organization_id:ORG_A,applicant_name:"Synthetic Candidate",
   source:"android_hr",idempotency_key:"android-unpaired-00001",consent_confirmed:true
  }}),r);
  assert.equal(r.statusCode,403);
  assert.equal(JSON.parse(r.body).error,"android_device_not_enrolled");
 });
 assert.equal(rpcCalled,false);
});

test("HR probation confirmation requires an authorized identity and an employee UUID",async()=>{
 let payload=null;
 await withMock(async(url,init)=>{
  if(String(url).endsWith("/auth/v1/user"))
    return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
  if(String(url).endsWith("/rpc/attendance_hr_confirm_probation")){
   payload=JSON.parse(init.body);return fakeResponse(200,{probation_status:"confirmed"});
  }
  throw new Error("unexpected route");
 },async()=>{
  const result=res();
  await confirmHandler(req("POST","/api/hr/employees/confirm",{
   body:{organization_id:ORG_A,employee_id:"30000000-0000-4000-8000-000000000001",untrustedRole:"owner"}
  }),result);
  assert.equal(result.statusCode,200);
  assert.deepEqual(payload,{p_organization_id:ORG_A,p_employee_id:"30000000-0000-4000-8000-000000000001"});
 });
});
test("invalid probation confirmation scope returns 422 without a write",async()=>{
 let wasCalled=false;
 await withMock(async(url)=>{
  if(String(url).endsWith("/auth/v1/user"))return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
  wasCalled=true;throw Error("unexpected call");
 },async()=>{
  const result=res();await confirmHandler(req("POST","/api/hr/employees/confirm",{
   body:{organization_id:"not-a-uuid",employee_id:"fake"}
  }),result);
  assert.equal(result.statusCode,422);
 });
 assert.equal(wasCalled,false);
});

test("Applicant correction passes only reviewed name and scoped UUID to RPC",async()=>{
 let data;
 await withMock(async(url,init)=>{
  if(String(url).endsWith("/auth/v1/user"))
   return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
  if(String(url).endsWith("/rpc/attendance_hr_update_application")){
   data=JSON.parse(init.body);
   return fakeResponse(200,{id:"50000000-0000-4000-8000-000000000001",status:"pending"});
  }
  throw Error("Unexpected HTTP call");
 },async()=>{
  const r=res();await updateApplicant(req("POST","/api/hr/applications/update",{body:{
   organization_id:ORG_A,application_id:"50000000-0000-4000-8000-000000000001",
   applicant_name:"Synthetic New",national_id:"never-forward",card_photo:"never-forward"
  }}),r);
  assert.equal(r.statusCode,200);
 });
 assert.deepEqual(data,{
  p_organization_id:ORG_A,p_application_id:"50000000-0000-4000-8000-000000000001",
  p_applicant_name:"Synthetic New"
 });
});
test("Soft archive validates reason and never hard-deletes source data",async()=>{
 let data;
 await withMock(async(url,init)=>{
  if(String(url).endsWith("/auth/v1/user"))
    return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
  if(String(url).endsWith("/rpc/attendance_hr_archive_application")){
    data=JSON.parse(init.body);return fakeResponse(200,{archived:true});
  }
  throw Error("Unexpected HTTP call");
 },async()=>{
  const r=res();await archiveApplicant(req("POST","/api/hr/applications/archive",{body:{
   organization_id:ORG_A,application_id:"50000000-0000-4000-8000-000000000001",
   reason:"entered_in_error"
  }}),r);assert.equal(r.statusCode,200);
 });
 assert.deepEqual(data,{p_organization_id:ORG_A,
  p_application_id:"50000000-0000-4000-8000-000000000001",p_reason:"entered_in_error"});
});

test("HR initiates reader pairing: 128-bit code never stored in cleartext",async()=>{
 let recorded;
 await withMock(async(url,init)=>{
  if(String(url).endsWith("/auth/v1/user"))
   return fakeResponse(200,{id:"10000000-0000-4000-8000-000000000001"});
  if(String(url).endsWith("/rpc/attendance_hr_reader_start")){
   recorded=JSON.parse(init.body);
   return fakeResponse(200,{session_id:recorded.p_id,status:"waiting",expires_at:"2026-10-29T11:00:00Z"});
  }
  throw Error("unexpected upstream");
 },async()=>{
  const r=res();
  await readerSessions(req("POST","/api/hr/reader/sessions",{
   body:{organization_id:ORG_A,public_key_spki:"A".repeat(400)}
  }),r);
  assert.equal(r.statusCode,200);
  const data=JSON.parse(r.body).data;
  assert.match(data.pairing_code,/^[0-9a-f]{32}$/);
  assert.match(recorded.p_code_hash,/^[0-9a-f]{64}$/);
  assert.equal(recorded.p_code_hash.includes(data.pairing_code),false);
  assert.equal(recorded.p_org,ORG_A);
 });
});
test("Anonymous Android handoff is unavailable without server-only secret",async()=>{
 delete process.env.ATTENDANCE_SUPABASE_SERVICE_KEY;
 let called=false;
 await withMock(async()=>{called=true;throw Error("no upstream call allowed");},async()=>{
  const r=res();
  await readerClaim(req("POST","/api/reader/claim",{body:{
   pairing_code:"a".repeat(32),device_secret:"b".repeat(32)
  }}),r);
  assert.equal(r.statusCode,503);
 });
 assert.equal(called,false);
});
test("Device claim uses hashed capability and service credential only server-side",async()=>{
 process.env.ATTENDANCE_SUPABASE_SERVICE_KEY="synthetic-service-key-do-not-use";
 let upstream;
 try{
  await withMock(async(url,init)=>{
   upstream={url:String(url),headers:init.headers,body:JSON.parse(init.body)};
   return fakeResponse(200,{session_id:"60000000-0000-4000-8000-000000000001",public_key_spki:"A".repeat(400)});
  },async()=>{
   const r=res();
   await readerClaim(req("POST","/api/reader/claim",{body:{
    pairing_code:"a".repeat(32),device_secret:"b".repeat(32)
   }}),r);
   assert.equal(r.statusCode,200);
  });
  assert.match(upstream.url,/attendance_reader_device_claim$/);
  assert.equal(upstream.headers.Authorization,"Bearer synthetic-service-key-do-not-use");
  assert.match(upstream.body.p_code_hash,/^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(upstream.body).includes("aaaaaaaaaaaaaaaa"),false);
 }finally{delete process.env.ATTENDANCE_SUPABASE_SERVICE_KEY}
});
test("Reader publishing refuses any unencrypted identity object",async()=>{
 process.env.ATTENDANCE_SUPABASE_SERVICE_KEY="synthetic-service-key-do-not-use";
 try{
  await withMock(async()=>{throw Error("unencrypted card may not reach database");},async()=>{
   const r=res();
   await readerPublish(req("POST","/api/reader/publish",{body:{
    session_id:"60000000-0000-4000-8000-000000000001",
    device_secret:"b".repeat(32),payload:{full_name:"synthetic",national_id:"not permitted"}
   }}),r);
   assert.equal(r.statusCode,422);
   assert.equal(JSON.parse(r.body).error,"reader_envelope_invalid");
  });
 }finally{delete process.env.ATTENDANCE_SUPABASE_SERVICE_KEY}
});
