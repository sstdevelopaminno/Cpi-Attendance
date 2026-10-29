-- Run after tests/sql/05_leave_queue.sql. All identities are synthetic CI fixtures.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
begin
  begin
    perform public.attendance_hr_list_employees('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED employee read HR roster';
  exception when insufficient_privilege then null; end;
  begin
    perform public.attendance_hr_submit_application('20000000-0000-4000-8000-000000000001',
      'Fake Applicant','hr_manual','hr-app-test-000001',true);
    raise exception 'FAILED employee created application';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$
begin
  begin
    perform public.attendance_hr_list_applications('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED HR B read HR A applications';
  exception when insufficient_privilege then null; end;
  begin
    perform public.attendance_hr_decide_application('20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001','approved','E002');
    raise exception 'FAILED HR B reviewed HR A applicant';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare a jsonb; b jsonb; list jsonb; approved jsonb; roster jsonb;
begin
  a:=public.attendance_hr_submit_application('20000000-0000-4000-8000-000000000001',
    'Synthetic Candidate','android_hr','hr-app-test-000001',true);
  b:=public.attendance_hr_submit_application('20000000-0000-4000-8000-000000000001',
    'Synthetic Candidate','android_hr','hr-app-test-000001',true);
  if a->>'id' <> b->>'id' then raise exception 'FAILED idempotent application'; end if;
  begin
    perform public.attendance_hr_submit_application('20000000-0000-4000-8000-000000000001',
      'Changed Candidate','android_hr','hr-app-test-000001',true);
    raise exception 'FAILED changed idempotent payload allowed';
  exception when unique_violation then null; end;
  list:=public.attendance_hr_list_applications('20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(list)<>1 then raise exception 'FAILED application list: %',list; end if;
  approved:=public.attendance_hr_decide_application('20000000-0000-4000-8000-000000000001',
    (a->>'id')::uuid,'approved','E002');
  if approved->>'login_provisioned'<>'false' or approved->>'status'<>'approved' then
    raise exception 'FAILED approval context: %',approved; end if;
  roster:=public.attendance_hr_list_employees('20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(roster)<>2 then raise exception 'FAILED HR roster: %',roster; end if;
  if not exists (select 1 from attendance.employees
    where organization_id='20000000-0000-4000-8000-000000000001'
      and employee_code='E002' and auth_user_id is null)
    then raise exception 'FAILED employee account must remain unprovisioned'; end if;
  begin
    perform public.attendance_hr_decide_application('20000000-0000-4000-8000-000000000001',
      (a->>'id')::uuid,'approved','E003');
    raise exception 'FAILED double approval allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.attendance_hr_submit_application('20000000-0000-4000-8000-000000000001',
      'No Consent','hr_manual','hr-app-test-000002',false);
    raise exception 'FAILED consent bypass allowed';
  exception when invalid_parameter_value then null; end;
end; $$;
reset role;
do $$
begin
  if (select count(*) from attendance.applications)<>1 then
    raise exception 'FAILED unexpected candidate count'; end if;
  if exists (select 1 from attendance.applications
    where organization_id='20000000-0000-4000-8000-000000000002')
    then raise exception 'FAILED cross-org application inserted'; end if;
  raise notice 'PASS: role-scoped HR candidate -> approved employee, consent, idempotency, cross-tenant';
end; $$;
