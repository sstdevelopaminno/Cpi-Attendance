-- Audited minimal HR correction / archive, draft only. Must run after recruitment migration.
alter table attendance.applications add column if not exists archived_at timestamptz;
alter table attendance.applications add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table attendance.applications add constraint attendance_applications_archive_consistent
 check ((archived_at is null and archived_by is null) or (archived_at is not null and archived_by is not null));

-- Replace the earlier list function to exclude archived records (soft deletion).
create or replace function public.attendance_hr_list_applications(
 p_organization_id uuid,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.uid() is null or p_limit is null or p_limit not between 1 and 200
 or not exists (
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then
  raise exception using errcode='42501',message='attendance_hr_forbidden';
 end if;
 select coalesce(jsonb_agg(data order by created_at desc),'[]'::jsonb) into v_result
 from (
  select a.created_at,jsonb_build_object('id',a.id,'name',a.applicant_name,
   'source',a.source,'status',a.status,'created_at',a.created_at,
   'employee_id',a.employee_id) as data
  from attendance.applications a
  where a.organization_id=p_organization_id and a.archived_at is null
  order by a.created_at desc limit p_limit
 ) applications;
 return v_result;
end;
$$;
revoke all on function public.attendance_hr_list_applications(uuid,integer) from public,anon;
grant execute on function public.attendance_hr_list_applications(uuid,integer) to authenticated;

-- Minimize audited changes: only applicant name may be corrected before approval.
create or replace function public.attendance_hr_update_application(
 p_organization_id uuid,p_application_id uuid,p_applicant_name text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_name text := trim(p_applicant_name); v_row attendance.applications%rowtype;
begin
 if auth.uid() is null or not exists (
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if p_applicant_name is null or length(v_name) not between 2 and 180 then
  raise exception using errcode='22023',message='invalid_applicant_name';end if;
 select * into v_row from attendance.applications a
  where a.id=p_application_id and a.organization_id=p_organization_id for update;
 if not found or v_row.archived_at is not null or v_row.status<>'pending' then
  raise exception using errcode='22023',message='application_locked_or_missing';end if;
 if v_row.applicant_name is distinct from v_name then
  update attendance.applications set applicant_name=v_name where id=v_row.id;
  insert into attendance.audit_entries (
   organization_id,actor_user_id,action_code,subject_type,subject_id,details
  ) values(p_organization_id,auth.uid(),'application_corrected','application',v_row.id,
   jsonb_build_object('changed_fields',jsonb_build_array('applicant_name')));
 end if;
 return jsonb_build_object('id',v_row.id,'status','pending');
end;
$$;
revoke all on function public.attendance_hr_update_application(uuid,uuid,text) from public,anon;
grant execute on function public.attendance_hr_update_application(uuid,uuid,text) to authenticated;

create or replace function public.attendance_hr_archive_application(
 p_organization_id uuid,p_application_id uuid,p_reason text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_row attendance.applications%rowtype;
begin
 if auth.uid() is null or not exists (
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if p_reason is null or p_reason not in ('withdrawn','duplicate','entered_in_error') then
  raise exception using errcode='22023',message='archive_reason_required';end if;
 select * into v_row from attendance.applications a
  where a.organization_id=p_organization_id and a.id=p_application_id for update;
 if not found or v_row.archived_at is not null or v_row.status<>'pending' then
  raise exception using errcode='22023',message='application_locked_or_missing';end if;
 update attendance.applications set archived_at=clock_timestamp(),archived_by=auth.uid()
 where organization_id=p_organization_id and id=p_application_id;
 insert into attendance.audit_entries(
  organization_id,actor_user_id,action_code,subject_type,subject_id,details
 ) values(p_organization_id,auth.uid(),'application_archived','application',p_application_id,
 jsonb_build_object('reason',p_reason));
 return jsonb_build_object('id',v_row.id,'archived',true);
end;
$$;
revoke all on function public.attendance_hr_archive_application(uuid,uuid,text) from public,anon;
grant execute on function public.attendance_hr_archive_application(uuid,uuid,text) to authenticated;
