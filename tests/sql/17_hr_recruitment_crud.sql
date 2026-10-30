-- Disposable PostgreSQL regression for owned HR recruitment CRUD.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_hr_manage_employee(
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001','deactivate');
  raise exception 'FAILED cross-tenant employee update';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare app jsonb;review jsonb;app_id uuid;emp_id uuid;
begin
 app:=public.attendance_hr_submit_application(
  '20000000-0000-4000-8000-000000000001',
  'Synthetic HR Applicant','hr_manual','crud-acceptance-20261030-001',true);
 app_id:=(app->>'id')::uuid;
 review:=public.attendance_hr_decide_application(
  '20000000-0000-4000-8000-000000000001',
  app_id,'approved','HRCRUD030');
 emp_id:=(review->>'employee_id')::uuid;
 if emp_id is null then raise exception 'FAILED approval did not create employee';end if;

 perform public.attendance_hr_update_application(
  '20000000-0000-4000-8000-000000000001',app_id,'Corrected HR Applicant');
 if (select x->>'name' from jsonb_array_elements(public.attendance_hr_list_employees('20000000-0000-4000-8000-000000000001')) x where x->>'id'=emp_id::text)<>'Corrected HR Applicant'
 then raise exception 'FAILED approved application name not mirrored to employee';end if;
 begin
  perform public.attendance_hr_archive_application(
    '20000000-0000-4000-8000-000000000001',app_id,'duplicate');
  raise exception 'FAILED archived approved active staff';
 exception when invalid_parameter_value then null;end;

 perform public.attendance_hr_manage_employee(
  '20000000-0000-4000-8000-000000000001',emp_id,'deactivate');
 if (select x->>'status' from jsonb_array_elements(public.attendance_hr_list_employees('20000000-0000-4000-8000-000000000001')) x where x->>'id'=emp_id::text)<>'inactive'
 then raise exception 'FAILED employee deactivate';end if;
 perform public.attendance_hr_manage_employee(
  '20000000-0000-4000-8000-000000000001',emp_id,'activate');
 perform public.attendance_hr_confirm_probation(
  '20000000-0000-4000-8000-000000000001',emp_id);
 perform public.attendance_hr_manage_employee(
  '20000000-0000-4000-8000-000000000001',emp_id,'reopen_probation');
 if (select x->>'probation_status' from jsonb_array_elements(public.attendance_hr_list_employees('20000000-0000-4000-8000-000000000001')) x where x->>'id'=emp_id::text)<>'pending'
 then raise exception 'FAILED reopen probation';end if;
 perform public.attendance_hr_manage_employee(
  '20000000-0000-4000-8000-000000000001',emp_id,'rename','Edited Staff Person');
 if (select x->>'name' from jsonb_array_elements(public.attendance_hr_list_applications('20000000-0000-4000-8000-000000000001')) x where x->>'id'=app_id::text)<>'Edited Staff Person'
 then raise exception 'FAILED staff rename not mirrored';end if;
 perform public.attendance_hr_manage_employee(
  '20000000-0000-4000-8000-000000000001',emp_id,'terminate');
 begin
  perform public.attendance_hr_manage_employee(
    '20000000-0000-4000-8000-000000000001',emp_id,'activate');
  raise exception 'FAILED terminated employee reactivation';
 exception when invalid_parameter_value then null;end;
 perform public.attendance_hr_archive_application(
  '20000000-0000-4000-8000-000000000001',app_id,'withdrawn');
 if exists(select 1 from jsonb_array_elements(public.attendance_hr_list_applications('20000000-0000-4000-8000-000000000001')) x
   where x->>'id'=app_id::text)
 then raise exception 'FAILED soft archive of terminated applicant';end if;
 if not exists(select 1 from jsonb_array_elements(public.attendance_hr_list_employees('20000000-0000-4000-8000-000000000001')) x
   where x->>'id'=emp_id::text)
 then raise exception 'FAILED hard-deleted employee';end if;
end;$$;
reset role;
do $$begin
 if not exists(select 1 from attendance.audit_entries
   where action_code='employee_terminate')
 then raise exception 'FAILED termination audit';end if;
 if not exists(select 1 from attendance.audit_entries
   where action_code='employee_reopen_probation')
 then raise exception 'FAILED probation rollback audit';end if;
end;$$;
