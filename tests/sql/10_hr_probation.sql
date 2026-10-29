-- Phase A1 verification: approved recruitment != completed probation.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$begin
 begin
  perform public.attendance_hr_confirm_probation(
   '20000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001');
  raise exception 'FAILED employee confirmed their own probation';
 exception when insufficient_privilege then null; end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_hr_confirm_probation(
   '20000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001');
  raise exception 'FAILED cross-tenant HR approved probation';
 exception when insufficient_privilege then null; end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare v_list jsonb; v_id uuid; v_result jsonb;
begin
 v_list:=public.attendance_hr_list_employees('20000000-0000-4000-8000-000000000001');
 select (x->>'id')::uuid into v_id
 from jsonb_array_elements(v_list) x where x->>'code'='E002';
 if v_id is null then raise exception 'FAILED missing approved applicant'; end if;
 if not exists(select 1 from jsonb_array_elements(v_list) x
   where x->>'code'='E002' and x->>'probation_status'='pending') then
    raise exception 'FAILED applicant auto-confirmed probation';
 end if;
 v_result:=public.attendance_hr_confirm_probation(
  '20000000-0000-4000-8000-000000000001',v_id);
 if v_result->>'probation_status'<>'confirmed' then raise exception 'FAILED probation confirmation';end if;
 begin
  perform public.attendance_hr_confirm_probation(
   '20000000-0000-4000-8000-000000000001',v_id);
  raise exception 'FAILED double probation confirmation';
 exception when invalid_parameter_value then null;end;
 if not exists(select 1 from attendance.audit_entries
  where action_code='probation_confirmed' and subject_id=v_id) then
  raise exception 'FAILED confirmation audit not written';
 end if;
 if not exists(select 1 from jsonb_array_elements(public.attendance_hr_list_employees(
  '20000000-0000-4000-8000-000000000001')) x
  where x->>'code'='E002' and x->>'probation_status'='confirmed') then
  raise exception 'FAILED confirmed employee hidden';
 end if;
end;
$$;
reset role;
