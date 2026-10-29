import test from "node:test";
import assert from "node:assert/strict";
import employeeHandler from "../apps/api/api/hr/employees.js";
import applicantHandler from "../apps/api/api/hr/applications.js";
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
