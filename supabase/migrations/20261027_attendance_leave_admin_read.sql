-- Read-only HR pending-leave queue, scoped by verified organization membership.
create or replace function public.attendance_pending_leaves(p_organization_id uuid)
returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from attendance.org_memberships m
    join attendance.organizations o on o.id=m.organization_id
    where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
      and m.status='active' and o.status='active'
      and m.role in ('owner','hr_admin')
  ) then
    raise exception using errcode='42501',message='attendance_leaves_admin_forbidden';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id,'employee_code',e.employee_code,'full_name',e.full_name,
    'leave_type',l.leave_type,'start_date',l.start_date,'end_date',l.end_date,
    'employee_note',l.employee_note,'status',l.request_status,'requested_at',l.created_at)
    order by l.created_at asc),'[]'::jsonb)
  into v_rows from (
    select * from attendance.leave_requests
    where organization_id=p_organization_id and request_status='pending'
    order by created_at asc limit 100
  ) l join attendance.employees e
    on e.organization_id=l.organization_id and e.id=l.employee_id;
  return v_rows;
end;
$$;
revoke all on function public.attendance_pending_leaves(uuid) from public,anon;
grant execute on function public.attendance_pending_leaves(uuid) to authenticated;
