-- Reversible-visible-archive behavior, synthetic test data only.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare app jsonb;review jsonb;application_id uuid;employee_id uuid;history jsonb;
begin
 app:=public.attendance_hr_submit_application(
  '20000000-0000-4000-8000-000000000001',
  'Synthetic Archive Staff','hr_manual','archive-staff-test-20261030-001',true);
 application_id:=(app->>'id')::uuid;
 review:=public.attendance_hr_decide_application(
  '20000000-0000-4000-8000-000000000001',application_id,'approved','TESTARCH19');
 employee_id:=(review->>'employee_id')::uuid;
 if employee_id is null then raise exception 'FAILED approve staff';end if;
 if not exists(select 1 from jsonb_array_elements(public.attendance_hr_list_employees(
   '20000000-0000-4000-8000-000000000001')) e
   where e->>'id'=employee_id::text and e->>'application_id'=application_id::text)
 then raise exception 'FAILED recruitment history link';end if;
 -- Hiding a processed application does not terminate or delete the employee.
 perform public.attendance_hr_archive_application(
   '20000000-0000-4000-8000-000000000001',application_id,'entered_in_error');
 history:=public.attendance_hr_get_application_record(
   '20000000-0000-4000-8000-000000000001',application_id);
 if history->>'archived'<>'true' then raise exception 'FAILED archived history still readable';end if;
 if not exists(select 1 from jsonb_array_elements(public.attendance_hr_list_employees(
   '20000000-0000-4000-8000-000000000001')) e
   where e->>'id'=employee_id::text and e->>'status'='active')
 then raise exception 'FAILED employee retained on applicant archive';end if;
 begin
  perform public.attendance_hr_archive_employee(
    '20000000-0000-4000-8000-000000000001',employee_id,false);
  raise exception 'FAILED archived still-active employee without explicit termination';
 exception when invalid_parameter_value then null;end;
 perform public.attendance_hr_archive_employee(
   '20000000-0000-4000-8000-000000000001',employee_id,true);
 if exists(select 1 from jsonb_array_elements(public.attendance_hr_list_employees(
   '20000000-0000-4000-8000-000000000001')) e where e->>'id'=employee_id::text)
 then raise exception 'FAILED archived employee hidden';end if;
 perform set_config('test.hr_archived_employee',employee_id::text,false);
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_hr_get_application_record(
   '20000000-0000-4000-8000-000000000001',
   (select id from attendance.applications where idempotency_key='archive-staff-test-20261030-001'));
  raise exception 'FAILED cross-tenant historical read';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$begin
 if not exists(select 1 from attendance.employees where
    id=current_setting('test.hr_archived_employee')::uuid
    and archived_at is not null and employment_status='terminated')
 then raise exception 'FAILED database history retained';end if;
 if not exists(select 1 from attendance.audit_entries where action_code='employee_archived')
 then raise exception 'FAILED audit of staff archival';end if;
end;$$;