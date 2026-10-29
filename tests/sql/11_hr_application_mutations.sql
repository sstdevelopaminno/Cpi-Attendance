-- Restricted applicant correction/archive. Synthetic fixture, disposable CI only.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$begin
 begin
  perform public.attendance_hr_update_application(
   '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000001','No Access');
  raise exception 'FAILED employee HR application edit';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_hr_archive_application(
   '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000001','duplicate');
  raise exception 'FAILED cross-tenant archive access';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare v jsonb;v_id uuid;
begin
 v:=public.attendance_hr_submit_application(
  '20000000-0000-4000-8000-000000000001',
  'Synthetic Review Person','hr_manual','secure-archive-test-001',true);
 v_id:=(v->>'id')::uuid;
 perform public.attendance_hr_update_application(
  '20000000-0000-4000-8000-000000000001',v_id,'Corrected Synthetic Person');
 if not exists (
  select 1 from jsonb_array_elements(public.attendance_hr_list_applications(
   '20000000-0000-4000-8000-000000000001')) x
  where x->>'id'=v_id::text and x->>'name'='Corrected Synthetic Person'
 ) then raise exception 'FAILED corrected name unavailable to HR';end if;
 begin
  perform public.attendance_hr_archive_application(
   '20000000-0000-4000-8000-000000000001',v_id,'invalid');
  raise exception 'FAILED unapproved archive reason accepted';
 exception when invalid_parameter_value then null;end;
 perform public.attendance_hr_archive_application(
  '20000000-0000-4000-8000-000000000001',v_id,'entered_in_error');
 if exists (
  select 1 from jsonb_array_elements(public.attendance_hr_list_applications(
   '20000000-0000-4000-8000-000000000001')) x
  where x->>'id'=v_id::text
 ) then raise exception 'FAILED archived application still shown';end if;
 begin
  perform public.attendance_hr_archive_application(
   '20000000-0000-4000-8000-000000000001',v_id,'duplicate');
  raise exception 'FAILED double archive';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.attendance_hr_update_application(
   '20000000-0000-4000-8000-000000000001',v_id,'Incorrect');
  raise exception 'FAILED archived record edit';
 exception when invalid_parameter_value then null;end;
end;$$;
reset role;
do $$begin
 if not exists(select 1 from attendance.audit_entries where action_code='application_corrected')
 or not exists(select 1 from attendance.audit_entries where action_code='application_archived')
 then raise exception 'FAILED correction/archive audit trail';end if;
end;$$;
