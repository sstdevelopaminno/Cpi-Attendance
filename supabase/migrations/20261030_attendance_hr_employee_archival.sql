-- Employee list removal is an auditable archive, never a destructive delete.
-- Preserve attendance, payroll and the associated recruitment application.
alter table attendance.employees
 add column if not exists archived_at timestamptz,
 add column if not exists archived_by uuid;

create or replace function public.attendance_hr_list_employees(
 p_organization_id uuid,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.uid() is null or p_limit is null or p_limit not between 1 and 200
 or not exists(
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 select coalesce(jsonb_agg(row_data order by employee_code),'[]'::jsonb)
 into v_result from (
  select e.employee_code,jsonb_build_object(
   'id',e.id,'code',e.employee_code,'name',e.full_name,
   'status',e.employment_status,'probation_status',e.probation_status,
   'probation_confirmed_at',e.probation_confirmed_at,
   'has_login',e.auth_user_id is not null,
   'application_id',(select a.id from attendance.applications a
     where a.organization_id=e.organization_id and a.employee_id=e.id
     order by a.created_at desc limit 1)
  ) row_data
  from attendance.employees e
  where e.organization_id=p_organization_id and e.archived_at is null
  order by e.employee_code limit p_limit
 ) roster;
 return v_result;
end;$$;
revoke all on function public.attendance_hr_list_employees(uuid,integer) from public,anon;
grant execute on function public.attendance_hr_list_employees(uuid,integer) to authenticated;

create or replace function public.attendance_hr_archive_employee(
 p_organization_id uuid,p_employee_id uuid,p_terminate boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.employees%rowtype;
begin
 if auth.uid() is null or not exists(
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 select * into v from attendance.employees e
 where e.id=p_employee_id and e.organization_id=p_organization_id for update;
 if not found or v.archived_at is not null
 then raise exception using errcode='22023',message='employee_not_found_or_archived';end if;
 if v.employment_status<>'terminated' and p_terminate is distinct from true
 then raise exception using errcode='22023',message='terminate_before_archive_required';end if;
 update attendance.employees set employment_status='terminated',
  archived_at=clock_timestamp(),archived_by=auth.uid(),
  updated_at=clock_timestamp()
 where id=p_employee_id and organization_id=p_organization_id;
 insert into attendance.audit_entries(
  organization_id,actor_user_id,action_code,subject_type,subject_id,details)
 values(p_organization_id,auth.uid(),'employee_archived','employee',p_employee_id,
  jsonb_build_object('previous_employment_status',v.employment_status,
   'previous_probation_status',v.probation_status,
   'terminated_by_action',v.employment_status<>'terminated'));
 return jsonb_build_object('employee_id',p_employee_id,'archived',true,
  'employment_status','terminated');
end;$$;
revoke all on function public.attendance_hr_archive_employee(uuid,uuid,boolean) from public,anon;
grant execute on function public.attendance_hr_archive_employee(uuid,uuid,boolean) to authenticated;


-- Recruitment archive is not termination. An approved application can be
-- hidden independently while its linked employee remains employed and auditable.
create or replace function public.attendance_hr_archive_application(
 p_organization_id uuid,p_application_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.applications%rowtype;
begin
 if auth.uid() is null or not exists(
  select 1 from attendance.org_memberships m join attendance.organizations o
   on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if p_reason is null or p_reason not in ('withdrawn','duplicate','entered_in_error')
 then raise exception using errcode='22023',message='archive_reason_required';end if;
 select * into v from attendance.applications a
  where a.id=p_application_id and a.organization_id=p_organization_id for update;
 if not found or v.archived_at is not null
 then raise exception using errcode='22023',message='application_locked_or_missing';end if;
 update attendance.applications set archived_at=clock_timestamp(),archived_by=auth.uid()
  where id=p_application_id and organization_id=p_organization_id;
 insert into attendance.audit_entries(
  organization_id,actor_user_id,action_code,subject_type,subject_id,details)
 values(p_organization_id,auth.uid(),'application_archived','application',p_application_id,
  jsonb_build_object('reason',p_reason,'previous_state',v.status,
   'linked_employee_retained',v.employee_id is not null));
 return jsonb_build_object('id',p_application_id,'archived',true);
end;$$;
revoke all on function public.attendance_hr_archive_application(uuid,uuid,text) from public,anon;
grant execute on function public.attendance_hr_archive_application(uuid,uuid,text) to authenticated;

-- Authorized HR can still view the linked recruitment history after archive.
create or replace function public.attendance_hr_get_application_record(
 p_org uuid,p_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v attendance.applications%rowtype;
begin
 if auth.uid() is null or not exists(
  select 1 from attendance.org_memberships m join attendance.organizations o
   on o.id=m.organization_id
  where m.organization_id=p_org and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 select * into v from attendance.applications a
  where a.organization_id=p_org and a.id=p_id;
 if not found then raise exception using errcode='22023',message='application_not_found';end if;
 return jsonb_build_object('id',v.id,'name',v.applicant_name,
  'source',v.source,'status',v.status,'created_at',v.created_at,
  'employee_id',v.employee_id,'archived',v.archived_at is not null);
end;$$;
revoke all on function public.attendance_hr_get_application_record(uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_get_application_record(uuid,uuid) to authenticated;

create or replace function public.attendance_hr_get_application_profile(p_org uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.application_private_profiles%rowtype;
begin
 if auth.uid() is null or not exists(
   select 1 from attendance.org_memberships m join attendance.organizations o
   on o.id=m.organization_id where m.organization_id=p_org and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if not exists(select 1 from attendance.applications a
  where a.id=p_id and a.organization_id=p_org)
 then raise exception using errcode='22023',message='application_not_found';end if;
 select * into v from attendance.application_private_profiles
 where organization_id=p_org and application_id=p_id;
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,
   subject_type,subject_id)
 values(p_org,auth.uid(),'application_private_viewed','application',p_id);
 if v.application_id is null
 then return jsonb_build_object('fields','{}'::jsonb,'photo',null);end if;
 return jsonb_build_object('fields',v.fields,'photo',
  case when v.photo_bytes is null then null else
   jsonb_build_object('mime',v.photo_mime,'base64',encode(v.photo_bytes,'base64')) end);
end;$$;
revoke all on function public.attendance_hr_get_application_profile(uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_get_application_profile(uuid,uuid) to authenticated;
