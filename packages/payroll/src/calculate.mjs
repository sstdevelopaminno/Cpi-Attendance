// Draft payroll calculator. Amounts are integer satang; statutory rules MUST be
// supplied from a jurisdiction/version-approved policy, never assumed by code.
function integer(value,name,min=0,max=100000000000){
  if(!Number.isSafeInteger(value)||value<min||value>max)
    throw new TypeError("invalid_"+name);
  return BigInt(value);
}
function roundDivision(numerator,denominator){
  return (numerator+denominator/2n)/denominator;
}
function toSafeInteger(value){
  if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER))
    throw new RangeError("payroll_amount_overflow");
  return Number(value);
}
export function calculateDraftPay({
  dailyWageSatang,approvedDays,hourlyWageSatang,approvedOvertimeMinutes,
  overtimeMultiplierBps,bonusesSatang=[],deductionsSatang=[]
}) {
  const daily=integer(dailyWageSatang,"daily_wage");
  const days=integer(approvedDays,"approved_days",0,366);
  const hourly=integer(hourlyWageSatang,"hourly_wage");
  const minutes=integer(approvedOvertimeMinutes,"overtime_minutes",0,50000);
  // 10000 bps = 1.00x; HR must provide the statutory/contractual multiplier.
  const multiplier=integer(overtimeMultiplierBps,"overtime_multiplier",0,100000);
  if(!Array.isArray(bonusesSatang)||!Array.isArray(deductionsSatang)
    ||bonusesSatang.length>100||deductionsSatang.length>100)throw new TypeError("invalid_payroll_items");
  const basic=daily*days;
  const overtime=roundDivision(hourly*minutes*multiplier,60n*10000n);
  const bonuses=bonusesSatang.reduce((v,n)=>v+integer(n,"bonus"),0n);
  const deductions=deductionsSatang.reduce((v,n)=>v+integer(n,"deduction"),0n);
  const gross=basic+overtime+bonuses;
  if(deductions>gross)throw new RangeError("deductions_exceed_gross");
  return Object.freeze({
    basicSatang:toSafeInteger(basic),
    overtimeSatang:toSafeInteger(overtime),
    bonusesSatang:toSafeInteger(bonuses),
    grossSatang:toSafeInteger(gross),
    deductionsSatang:toSafeInteger(deductions),
    netSatang:toSafeInteger(gross-deductions),
    status:"draft",
    payable:false
  });
}
const atDate=(iso)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw new TypeError("invalid_date");
  const date=new Date(iso+"T00:00:00Z");
  if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==iso)
    throw new TypeError("invalid_date");
  return date;
};
const iso=(date)=>date.toISOString().slice(0,10);
export function payPeriodFor(dateIso,{cycle="weekly",weekStart=1,monthStartDay=1,anchorDate}={}) {
  const date=atDate(dateIso);
  let start,end;
  if(cycle==="weekly"){
    if(!Number.isInteger(weekStart)||weekStart<0||weekStart>6)
      throw new TypeError("invalid_week_start");
    const offset=(date.getUTCDay()-weekStart+7)%7;
    start=new Date(date);start.setUTCDate(date.getUTCDate()-offset);
    end=new Date(start);end.setUTCDate(start.getUTCDate()+6);
  } else if(cycle==="biweekly"){
    if(!anchorDate)throw new TypeError("missing_anchor_date");
    const anchor=atDate(anchorDate);
    const days=Math.floor((date-anchor)/86400000);
    const offset=Math.floor(days/14)*14;
    start=new Date(anchor);start.setUTCDate(anchor.getUTCDate()+offset);
    end=new Date(start);end.setUTCDate(start.getUTCDate()+13);
  } else if(cycle==="monthly"){
    if(!Number.isInteger(monthStartDay)||monthStartDay<1||monthStartDay>28)
      throw new TypeError("invalid_month_start");
    const year=date.getUTCFullYear(),month=date.getUTCMonth();
    start=new Date(Date.UTC(year,month+(date.getUTCDate()<monthStartDay?-1:0),monthStartDay));
    end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,monthStartDay-1));
  } else throw new TypeError("unsupported_cycle");
  return {cycle,startDate:iso(start),endDate:iso(end)};
}
