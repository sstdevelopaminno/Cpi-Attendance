import assert from "node:assert/strict";
import test from "node:test";
import {calculateDraftPay,payPeriodFor} from "../packages/payroll/src/calculate.mjs";
test("weekly pay draft uses integer satang, not floating rounding",()=>{
  const result=calculateDraftPay({
    dailyWageSatang:60000,approvedDays:6,
    hourlyWageSatang:7500,approvedOvertimeMinutes:240,
    overtimeMultiplierBps:15000,bonusesSatang:[20000],deductionsSatang:[10000]
  });
  assert.equal(result.basicSatang,360000);
  assert.equal(result.overtimeSatang,45000);
  assert.equal(result.grossSatang,425000);
  assert.equal(result.netSatang,415000);
  assert.equal(result.payable,false);
  assert.equal(result.status,"draft");
});
test("policy calculations are not hardcoded and reject invalid inputs",()=>{
  assert.throws(()=>calculateDraftPay({
    dailyWageSatang:10000,approvedDays:1.5,
    hourlyWageSatang:0,approvedOvertimeMinutes:0,overtimeMultiplierBps:10000
  }));
  assert.throws(()=>calculateDraftPay({
    dailyWageSatang:10000,approvedDays:1,
    hourlyWageSatang:0,approvedOvertimeMinutes:0,
    overtimeMultiplierBps:10000,deductionsSatang:[20000]
  }));
});
test("weekly, biweekly and company day-26 payroll boundaries",()=>{
  assert.deepEqual(payPeriodFor("2026-10-27",{cycle:"weekly",weekStart:1}),
    {cycle:"weekly",startDate:"2026-10-26",endDate:"2026-11-01"});
  assert.deepEqual(payPeriodFor("2026-10-27",{cycle:"monthly",monthStartDay:26}),
    {cycle:"monthly",startDate:"2026-10-26",endDate:"2026-11-25"});
  assert.deepEqual(payPeriodFor("2026-10-25",{cycle:"monthly",monthStartDay:26}),
    {cycle:"monthly",startDate:"2026-09-26",endDate:"2026-10-25"});
  assert.deepEqual(payPeriodFor("2026-10-27",{cycle:"biweekly",anchorDate:"2026-10-19"}),
    {cycle:"biweekly",startDate:"2026-10-19",endDate:"2026-11-01"});
});
test("invalid dates and impossible parameters are rejected",()=>{
  assert.throws(()=>payPeriodFor("2026-02-30"));
  assert.throws(()=>payPeriodFor("2026-10-27",{cycle:"monthly",monthStartDay:31}));
});
