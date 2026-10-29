-- Attendance HR: recruiting approval is NOT the same as successful probation.
-- Created only in disposable integration CI until production authorization gates pass.
alter table attendance.employees add column if not exists probation_status text not null
 default 'pending' check (probation_status in ('pending','confirmed'));
alter table attendance.employees add column if not exists probation_confirmed_at timestamptz;
alter table attendance.employees add column if not exists probation_confirmed_by uuid
 references auth.users(id) on delete set null;
alter table attendance.employees add constraint attendance_probation_confirmation_consistent
 check (
  (probation_status='pending' and probation_confirmed_at is null and probation_confirmed_by is null)
  or (probation_status='confirmed' and probation_confirmed_at is not null and probation_confirmed_by is not null)
 );

-- Replacing the earlier list RPC preserves its signature and auth policy.
create or replace function public.attendance_hr_list_employees(
 p_organization_id uuid, p_limit integer default 100
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
 select coalesce(jsonb_agg(row_data order by employee_code),'[]'::jsonb)
 into v_result from (
  select e.employee_code,jsonb_build_object(
   'id',e.id,'code',e.employee_code,'name',e.full_name,
   'status',e.employment_status,'probation_status',e.probation_status,
   'probation_confirmed_at',e.probation_confirmed_at,
   'has_login',e.auth_user_id is not null
  ) row_data
  from attendance.employees e where e.organization_id=p_organization_id
  order by e.employee_code limit p_limit
 ) roster;
 return v_result;
end;
$$;
revoke all on function public.attendance_hr_list_employees(uuid,integer) from public,anon;
grant execute on function public.attendance_hr_list_employees(uuid,integer) to authenticated;

create or replace function public.attendance_hr_confirm_probation(
 p_organization_id uuid,p_employee_id uuid
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_employee attendance.employees%rowtype;
begin
 if auth.uid() is null or not exists (
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then
  raise exception using errcode='42501',message='attendance_hr_forbidden';
 end if;
 select * into v_employee from attendance.employees e
  where e.organization_id=p_organization_id and e.id=p_employee_id for update;
 if not found then
  raise exception using errcode='22023',message='employee_not_found';
 end if;
 if v_employee.employment_status<>'active' or v_employee.probation_status<>'pending' then
  raise exception using errcode='22023',message='probation_not_pending';
 end if;
 update attendance.employees set probation_status='confirmed',
   probation_confirmed_at=clock_timestamp(),
   probation_confirmed_by=auth.uid(),updated_at=clock_timestamp()
 where id=p_employee_id and organization_id=p_organization_id;
 insert into attendance.audit_entries (
  organization_id,actor_user_id,action_code,subject_type,subject_id,details
 ) values (
  p_organization_id,auth.uid(),'probation_confirmed','employee',p_employee_id,
  jsonb_build_object('previous_state','pending','new_state','confirmed')
 );
 return jsonb_build_object(
  'employee_id',p_employee_id,'probation_status','confirmed'
 );
end;
$$;
revoke all on function public.attendance_hr_confirm_probation(uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_confirm_probation(uuid,uuid) to authenticated;
