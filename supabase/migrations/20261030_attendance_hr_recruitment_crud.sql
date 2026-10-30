-- Tenant-scoped HR recruitment corrections and reversible staff status changes.
-- No hard deletes: applicant records are archived; employee records are retained
-- for payroll, attendance and audit integrity. No card data is persisted.
create or replace function public.attendance_hr_update_application(
 p_organization_id uuid,p_application_id uuid,p_applicant_name text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text:=trim(p_applicant_name);v attendance.applications%rowtype;
begin
 if auth.uid() is null or not exists(
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if p_applicant_name is null or length(v_name) not between 2 and 180 then
  raise exception using errcode='22023',message='invalid_applicant_name';end if;
 select * into v from attendance.applications a
  where a.id=p_application_id and a.organization_id=p_organization_id for update;
 if not found or v.archived_at is not null then
  raise exception using errcode='22023',message='application_locked_or_missing';end if;
 if v.applicant_name is distinct from v_name then
  update attendance.applications set applicant_name=v_name
   where organization_id=p_organization_id and id=v.id;
  if v.status='approved' and v.employee_id is not null then
   update attendance.employees set full_name=v_name,updated_at=clock_timestamp()
    where organization_id=p_organization_id and id=v.employee_id;
  end if;
  insert into attendance.audit_entries(organization_id,actor_user_id,action_code,
   subject_type,subject_id,details)
  values(p_organization_id,auth.uid(),'application_corrected','application',v.id,
   jsonb_build_object('changed_fields',jsonb_build_array('applicant_name'),
    'status',v.status));
 end if;
 return jsonb_build_object('id',v.id,'status',v.status,'updated',true);
end;$$;
revoke all on function public.attendance_hr_update_application(uuid,uuid,text) from public,anon;
grant execute on function public.attendance_hr_update_application(uuid,uuid,text) to authenticated;

create or replace function public.attendance_hr_archive_application(
 p_organization_id uuid,p_application_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.applications%rowtype;
begin
 if auth.uid() is null or not exists(
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
    and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if p_reason is null or p_reason not in ('withdrawn','duplicate','entered_in_error') then
  raise exception using errcode='22023',message='archive_reason_required';end if;
 select * into v from attendance.applications a
  where a.organization_id=p_organization_id and a.id=p_application_id for update;
 if not found or v.archived_at is not null then
  raise exception using errcode='22023',message='application_locked_or_missing';end if;
 -- An approved application is linked to a staff record. It may only leave
 -- recruitment lists once that staff record has been explicitly terminated.
 if v.status='approved' and (
   v.employee_id is null or not exists(
    select 1 from attendance.employees e where e.id=v.employee_id
     and e.organization_id=p_organization_id and e.employment_status='terminated'
   )
 ) then raise exception using errcode='22023',message='employee_must_be_terminated_first';end if;
 update attendance.applications set archived_at=clock_timestamp(),archived_by=auth.uid()
  where id=v.id and organization_id=p_organization_id;
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,
  subject_type,subject_id,details)
 values(p_organization_id,auth.uid(),'application_archived','application',v.id,
  jsonb_build_object('reason',p_reason,'previous_state',v.status));
 return jsonb_build_object('id',v.id,'archived',true);
end;$$;
revoke all on function public.attendance_hr_archive_application(uuid,uuid,text) from public,anon;
grant execute on function public.attendance_hr_archive_application(uuid,uuid,text) to authenticated;

create or replace function public.attendance_hr_manage_employee(
 p_organization_id uuid,p_employee_id uuid,p_action text,p_full_name text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.employees%rowtype;v_new_name text:=trim(p_full_name);
 v_new_status text;
begin
 if auth.uid() is null or not exists(
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 select * into v from attendance.employees e
  where e.organization_id=p_organization_id and e.id=p_employee_id for update;
 if not found then raise exception using errcode='22023',message='employee_not_found';end if;
 if p_action='rename' then
  if p_full_name is null or length(v_new_name) not between 2 and 180
  then raise exception using errcode='22023',message='invalid_employee_name';end if;
  if v.full_name is distinct from v_new_name then
   update attendance.employees set full_name=v_new_name,updated_at=clock_timestamp()
    where organization_id=p_organization_id and id=p_employee_id;
   update attendance.applications set applicant_name=v_new_name
    where organization_id=p_organization_id and employee_id=p_employee_id
     and archived_at is null;
  end if;
 elsif p_action in ('activate','deactivate','terminate') then
  v_new_status:=case p_action when 'activate' then 'active'
    when 'deactivate' then 'inactive' else 'terminated' end;
  if v.employment_status='terminated' and v_new_status<>'terminated' then
   raise exception using errcode='22023',message='employee_rehire_requires_new_workflow';end if;
  update attendance.employees set employment_status=v_new_status,
   updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=p_employee_id;
 elsif p_action='reopen_probation' then
  if v.employment_status<>'active' or v.probation_status<>'confirmed'
  then raise exception using errcode='22023',message='probation_not_confirmed';end if;
  update attendance.employees set probation_status='pending',
   probation_confirmed_at=null,probation_confirmed_by=null,
   updated_at=clock_timestamp()
   where organization_id=p_organization_id and id=p_employee_id;
 else
  raise exception using errcode='22023',message='invalid_employee_action';
 end if;
 insert into attendance.audit_entries(organization_id,actor_user_id,
   action_code,subject_type,subject_id,details)
 values(p_organization_id,auth.uid(),'employee_'||p_action,'employee',p_employee_id,
  jsonb_build_object('previous_employment_status',v.employment_status,
   'previous_probation_status',v.probation_status));
 return jsonb_build_object('employee_id',p_employee_id,'action',p_action,'updated',true);
end;$$;
revoke all on function public.attendance_hr_manage_employee(uuid,uuid,text,text) from public,anon;
grant execute on function public.attendance_hr_manage_employee(uuid,uuid,text,text) to authenticated;
