-- Phase 3: audited leave requests; staged for review (not production).
alter table attendance.leave_requests add column if not exists decision_note text;

create or replace function public.attendance_request_leave(
  p_organization_id uuid,p_leave_type text,p_start_date date,p_end_date date,
  p_note text default null
) returns jsonb
language plpgsql security definer
set search_path='' as $$
declare v_actor uuid:=auth.uid();
        v_emp uuid;v_id uuid;v_now timestamptz:=clock_timestamp();
begin
  if v_actor is null then
    raise exception using errcode='42501',message='attendance_login_required';
  end if;
  if p_leave_type is null or p_leave_type !~ '^[a-z_]{3,40}$'
     or p_start_date is null or p_end_date is null
     or p_end_date<p_start_date or p_end_date>p_start_date+89
     or char_length(coalesce(p_note,''))>1000 then
    raise exception using errcode='22023',message='attendance_invalid_leave_request';
  end if;
  select e.id into v_emp from attendance.employees e
   join attendance.org_memberships m on m.organization_id=e.organization_id
     and m.auth_user_id=e.auth_user_id and m.status='active'
   join attendance.organizations o on o.id=e.organization_id
   where e.organization_id=p_organization_id and e.auth_user_id=v_actor
     and e.employment_status='active' and o.status='active';
  if v_emp is null then
    raise exception using errcode='42501',message='attendance_employee_not_bound';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||v_emp::text||':leave',0));
  if exists(select 1 from attendance.leave_requests l
    where l.organization_id=p_organization_id and l.employee_id=v_emp
      and l.request_status in ('pending','approved')
      and l.start_date<=p_end_date and l.end_date>=p_start_date)
    then raise exception using errcode='23505',message='attendance_overlapping_leave';
  end if;
  insert into attendance.leave_requests
  (organization_id,employee_id,leave_type,start_date,end_date,employee_note,created_at)
  values(p_organization_id,v_emp,p_leave_type,p_start_date,p_end_date,p_note,v_now)
  returning id into v_id;
  insert into attendance.audit_entries
    (organization_id,actor_user_id,action_code,subject_type,subject_id,details)
  values(p_organization_id,v_actor,'leave_submitted','attendance.leave_requests',v_id,
    jsonb_build_object('start_date',p_start_date,'end_date',p_end_date,'leave_type',p_leave_type));
  return jsonb_build_object('id',v_id,'status','pending');
end;
$$;
revoke all on function public.attendance_request_leave(uuid,text,date,date,text)
  from public,anon;
grant execute on function public.attendance_request_leave(uuid,text,date,date,text) to authenticated;

create or replace function public.attendance_review_leave(
  p_organization_id uuid,p_request_id uuid,p_decision text,p_reason text default null
) returns jsonb
language plpgsql security definer
set search_path='' as $$
declare v_actor uuid:=auth.uid();
        v_leave attendance.leave_requests%rowtype;
begin
  if v_actor is null or not exists (
    select 1 from attendance.org_memberships m
    join attendance.organizations o on o.id=m.organization_id
    where m.organization_id=p_organization_id and m.auth_user_id=v_actor
      and m.status='active' and o.status='active'
      and m.role in ('owner','hr_admin')
  ) then
    raise exception using errcode='42501',message='attendance_leave_review_forbidden';
  end if;
  if p_decision not in ('approved','rejected') or p_decision is null
      or char_length(coalesce(p_reason,''))>1000 then
    raise exception using errcode='22023',message='attendance_invalid_leave_decision';
  end if;
  select * into v_leave from attendance.leave_requests
    where id=p_request_id and organization_id=p_organization_id for update;
  if not found then
    raise exception using errcode='42501',message='attendance_leave_not_found';
  end if;
  if v_leave.request_status<>'pending' then
    raise exception using errcode='22023',message='attendance_leave_already_decided';
  end if;
  if exists (select 1 from attendance.employees e
       where e.id=v_leave.employee_id and e.auth_user_id=v_actor) then
    raise exception using errcode='42501',message='attendance_self_approval_forbidden';
  end if;
  update attendance.leave_requests
    set request_status=p_decision,approved_by=v_actor,decided_at=clock_timestamp(),
      decision_note=p_reason
    where id=v_leave.id;
  insert into attendance.audit_entries
    (organization_id,actor_user_id,action_code,subject_type,subject_id,details)
  values (p_organization_id,v_actor,'leave_'||p_decision,
    'attendance.leave_requests',v_leave.id,
    jsonb_build_object('decision',p_decision,'note',p_reason));
  return jsonb_build_object('id',v_leave.id,'status',p_decision);
end;
$$;
revoke all on function public.attendance_review_leave(uuid,uuid,text,text) from public,anon;
grant execute on function public.attendance_review_leave(uuid,uuid,text,text) to authenticated;

create or replace function public.attendance_my_leave_requests(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_emp uuid;v_items jsonb;
begin
  select e.id into v_emp from attendance.employees e
  join attendance.org_memberships m on m.organization_id=e.organization_id
    and m.auth_user_id=e.auth_user_id and m.status='active'
  where e.organization_id=p_organization_id and e.auth_user_id=v_actor
    and e.employment_status='active';
  if v_emp is null then raise exception using errcode='42501',message='attendance_employee_not_bound';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',l.id,'leave_type',l.leave_type,'start_date',l.start_date,
      'end_date',l.end_date,'status',l.request_status,'decided_at',l.decided_at)
    order by l.created_at desc),'[]'::jsonb)
   into v_items from attendance.leave_requests l
   where l.organization_id=p_organization_id and l.employee_id=v_emp;
  return v_items;
end;
$$;
revoke all on function public.attendance_my_leave_requests(uuid) from public,anon;
grant execute on function public.attendance_my_leave_requests(uuid) to authenticated;
