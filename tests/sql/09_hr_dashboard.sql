-- Authorized org aggregates and denial for employee/wrong org; synthetic-only database fixtures.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare r jsonb;
begin
 r:=public.attendance_hr_dashboard('20000000-0000-4000-8000-000000000001');
 if (r->>'employees')::integer<1 then raise exception 'FAILED HR aggregate employee count: %',r; end if;
 if jsonb_array_length(r->'attendance_series')<>7 then raise exception 'FAILED 7-day chart series';end if;
 if r->'salary'<>'null'::jsonb then raise exception 'FAILED unverified payroll exposed';end if;
 begin
  perform public.attendance_hr_dashboard('20000000-0000-4000-8000-000000000002');
  raise exception 'FAILED cross-org HR dashboard access';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$begin
 begin
  perform public.attendance_hr_dashboard('20000000-0000-4000-8000-000000000001');
  raise exception 'FAILED employee HR dashboard access';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
