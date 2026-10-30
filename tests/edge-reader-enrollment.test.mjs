import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

// Execute the ACTUAL Supabase Edge handler with synthetic upstream responses.
// All external requests are intercepted. No real accounts, tokens, card data,
// Supabase projects, staging deployments or production writes are involved.
const ORG="20000000-0000-4000-8000-000000000001";
const OTHER="20000000-0000-4000-8000-000000000002";
const HR="10000000-0000-4000-8000-000000000001";
const TOKEN="test-only-token-with-sufficient-length-0001";
const SERVICE="synthetic-service-role-test-only";
const PUBLISHABLE="synthetic-publishable-test-only";
const PASSWORD="synthetic-password-12345";
const CODE="876543";
const DEVICE="a".repeat(32);
const source=readFileSync("supabase/functions/attendance-api/index.ts","utf8");

function createEdge({account=HR,activeOrg=ORG,allowEnroll=true}={}){
  let handler=null;
  const calls=[];
  const upstream=async(url,init={})=>{
    const href=String(url),body=init.body?JSON.parse(init.body):{};
    const path=new URL(href).pathname;
    calls.push({path,body: path.includes("/rpc/")?body:{},authenticated:!!init.headers?.Authorization});
    const json=(status,data)=>new Response(JSON.stringify(data),{
      status,headers:{"content-type":"application/json"}
    });
    if(path.endsWith("/rpc/attendance_allow_login"))return json(200,true);
    if(path.endsWith("/rpc/attendance_hr_resolve_login")){
      assert.deepEqual(body,{p_organization_code:CODE,p_login_code:"HR0001"});
      return json(200,{auth_user_id:HR});
    }
    if(path.endsWith("/auth/v1/admin/users/"+HR))return json(200,{email:"hr-owner@example.invalid"});
    if(path.endsWith("/auth/v1/token")){
      if(body.email!=="hr-owner@example.invalid"||body.password!==PASSWORD)
        return json(400,{error:"invalid_grant"});
      return json(200,{access_token:TOKEN,expires_in:3600});
    }
    if(path.endsWith("/auth/v1/user"))
      return init.headers?.Authorization==="Bearer "+TOKEN
        ?json(200,{id:account}):json(401,{error:"invalid_session"});
    if(path.endsWith("/rpc/attendance_login_context")){
      assert.equal(init.headers.Authorization,"Bearer "+TOKEN);
      return json(200,{organization_id:ORG,organization_code:CODE,role:"owner",max_android_devices:1});
    }
    if(path.endsWith("/rpc/attendance_reader_device_enroll")){
      assert.equal(init.headers.Authorization,"Bearer "+TOKEN);
      if(!allowEnroll||body.p_org!==activeOrg||account!==HR)
        return json(403,{message:"reader_device_denied"});
      return json(200,{
        enrolled:true,organization_id:ORG,hr_user_id:account,
        device_id:"70000000-0000-4000-8000-000000000001"
      });
    }
    throw Error("Unexpected mock upstream path: "+path);
  };
  vm.runInNewContext(source,{
    Deno:{
      env:{get(name){
        if(name==="SUPABASE_URL")return "https://staging-synthetic.supabase.invalid";
        if(name==="SUPABASE_ANON_KEY")return PUBLISHABLE;
        if(name==="SUPABASE_SERVICE_ROLE_KEY")return SERVICE;
        return null;
      }},
      serve(fn){handler=fn}
    },
    fetch:upstream,crypto:webcrypto,TextEncoder,URL,Response,Request,AbortSignal,
    Uint8Array,JSON,Array,Object,String,Number,Error,SyntaxError
  },{filename:"attendance-api/index.ts",timeout:1000});
  assert.equal(typeof handler,"function");
  const call=async(path,body={},bearerToken="")=>{
    const headers={"Content-Type":"application/json"};
    if(bearerToken)headers.Authorization="Bearer "+bearerToken;
    const response=await handler(new Request(
      "https://attendance.local/functions/v1/attendance-api"+path,{
        method:"POST",headers,body:JSON.stringify(body)
      }));
    return {status:response.status,body:await response.json()};
  };
  const health=async()=>{
    const response=await handler(new Request(
      "https://attendance.local/functions/v1/attendance-api/api/health",
      {method:"GET"}));
    return {status:response.status,body:await response.json()};
  };
  return {call,calls,health};
}

test("actual Edge handler authenticates HR and enrolls device with matching tenant + HR",async()=>{
  const edge=createEdge();
  const login=await edge.call("/api/auth/login",{
    organization_code:CODE,employee_code:"HR0001",password:PASSWORD
  });
  assert.equal(login.status,200,JSON.stringify({response:login.body,upstreamPaths:edge.calls.map(c=>c.path)}));
  assert.equal(login.body.data.context.organization_id,ORG);
  assert.equal(login.body.data.context.hr_user_id,HR);
  assert.equal(login.body.data.access_token,TOKEN);
  const enrolled=await edge.call("/api/reader/enroll",{
    organization_id:ORG,device_secret:DEVICE
  },login.body.data.access_token);
  assert.equal(enrolled.status,200);
  assert.equal(enrolled.body.data.enrolled,true);
  assert.equal(enrolled.body.data.organization_id,ORG);
  assert.equal(enrolled.body.data.hr_user_id,HR);
  assert.match(enrolled.body.data.device_id,/^[0-9a-f-]{36}$/);
  const enrollmentRpc=edge.calls.find(c=>c.path.endsWith("/rpc/attendance_reader_device_enroll"));
  assert.deepEqual(Object.keys(enrollmentRpc.body).sort(),
    ["p_device_hash","p_org","p_previous_hash"]);
  assert.equal(enrollmentRpc.body.p_org,ORG);
  assert.match(enrollmentRpc.body.p_device_hash,/^[0-9a-f]{64}$/);
  assert.equal(enrollmentRpc.body.p_previous_hash,null);
  assert.equal(enrollmentRpc.authenticated,true);
});

test("anonymous device cannot enroll; no enrollment RPC executes",async()=>{
  const edge=createEdge();
  const result=await edge.call("/api/reader/enroll",{
    organization_id:ORG,device_secret:DEVICE
  });
  assert.equal(result.status,401);
  assert.equal(result.body.error,"login_required");
  assert.equal(edge.calls.some(c=>c.path.endsWith("attendance_reader_device_enroll")),false);
});

test("cross-tenant enrollment and mismatched HR fail closed",async()=>{
  const otherTenant=createEdge({activeOrg:OTHER});
  const result=await otherTenant.call("/api/reader/enroll",{
    organization_id:ORG,device_secret:DEVICE
  },TOKEN);
  assert.equal(result.status,403);
  assert.equal(result.body.error,"reader_device_denied");
  const otherHr=createEdge({account:"10000000-0000-4000-8000-000000000002"});
  const another=await otherHr.call("/api/reader/enroll",{
    organization_id:ORG,device_secret:DEVICE
  },TOKEN);
  assert.equal(another.status,403);
  assert.equal(another.body.error,"reader_device_denied");
});

test("invalid device capability is rejected before RPC; manual pairing is retired",async()=>{
  const edge=createEdge();
  let result=await edge.call("/api/reader/enroll",{
    organization_id:ORG,device_secret:"not-a-device-secret"
  },TOKEN);
  assert.equal(result.status,422);
  assert.equal(result.body.error,"invalid_payload");
  result=await edge.call("/api/reader/claim",{
    device_secret:DEVICE,pairing_code:"b".repeat(32)
  });
  assert.equal(result.status,410);
  assert.equal(result.body.error,"reader_pairing_retired");
  assert.equal(edge.calls.some(c=>c.path.endsWith("attendance_reader_device_enroll")),false);
});

test("Edge health advertises v0.7 reader enrollment without user details",async()=>{
 const edge=createEdge();
 const result=await edge.health();
 assert.equal(result.status,200);
 assert.equal(result.body.dbReady,true);
 assert.equal(result.body.capabilities.hr_bound_android_enrollment,"v1");
 assert.equal(result.body.capabilities.manual_claim,false);
 assert.equal(edge.calls.length,0,"health must not query protected HR records");
 assert.equal(JSON.stringify(result.body).includes("access_token"),false);
});
