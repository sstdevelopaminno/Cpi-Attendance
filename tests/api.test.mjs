import assert from "node:assert/strict";
import test from "node:test";
import { applyCors,asUuid,parseBody,tokenFromRequest } from "../apps/api/lib/http.js";
import { deriveAuthEmail } from "../apps/api/api/auth/login.js";

function response(){
  return {statusCode:200,headers:{},setHeader(key,value){this.headers[key]=value;},
    end(value){this.body=value;this.ended=true;}};
}
test("CORS permits only explicit organization webapp origin",()=>{
  const allowed="https://hr.example.com,https://employee.example.com";
  const okay=response();
  assert.equal(applyCors({method:"POST",headers:{origin:"https://employee.example.com"}},okay,allowed),true);
  assert.equal(okay.headers["Access-Control-Allow-Origin"],"https://employee.example.com");
  const deny=response();
  assert.equal(applyCors({method:"POST",headers:{origin:"https://attacker.example.com"}},deny,allowed),false);
  assert.equal(deny.statusCode,403);
});
test("CORS preflight no side effects",()=>{
  const r=response();
  assert.equal(applyCors({method:"OPTIONS",headers:{origin:"https://employee.example.com"}},r,"https://employee.example.com"),false);
  assert.equal(r.statusCode,204);
});
test("auth alias is stable per organization but never equals employee code",()=>{
  const secret="z".repeat(40);
  const a=deriveAuthEmail("ORG_A","EMP1",secret,"auth.example.com");
  assert.equal(a,deriveAuthEmail("ORG_A","EMP1",secret,"auth.example.com"));
  assert.notEqual(a,deriveAuthEmail("ORG_B","EMP1",secret,"auth.example.com"));
  assert.ok(!a.includes("EMP1"));
  assert.throws(()=>deriveAuthEmail("ORG_A","EMP1","short","auth.example.com"));
});
test("input and token parsing rejects malformed scope and JWTs",()=>{
  assert.equal(asUuid("not-a-uuid"),null);
  assert.equal(tokenFromRequest({headers:{authorization:"Bearer secret.jwt.signature"}}),"secret.jwt.signature");
  assert.equal(tokenFromRequest({headers:{authorization:"Basic abc"}}),null);
  assert.throws(()=>parseBody({headers:{"content-length":"10000"},body:{a:1}}));
});
