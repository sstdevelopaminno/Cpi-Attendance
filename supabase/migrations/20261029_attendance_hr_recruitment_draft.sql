-- Draft only. Apply exclusively to disposable PostgreSQL integration test first.
-- Requires reviewed Attendance core migrations; do NOT execute against Communications production.
create table if not exists attendance.applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  applicant_name text not null check (char_length(trim(applicant_name)) between 2 and 180),
  source text not null default 'hr_manual' check (source in ('hr_manual','android_hr','web_application')),
  consent_recorded_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  employee_id uuid,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{12,128}$'),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id,employee_id) references attendance.employees(organization_id,id) on delete restrict,
  unique (organization_id,idempotency_key)
);
create index if not exists idx_att_applications_pending
  on attendance.applications(organization_id,status,created_at desc);
alter table attendance.applications enable row level security;
revoke all on attendance.applications from public,anon,authenticated;

-- Callers supply an org UUID only as a request target; membership is verified from auth.uid().
-- Managers are deliberately excluded until site-level scope is implemented.
create or replace function public.attendance_hr_list_employees(
  p_organization_id uuid, p_limit integer default 100
) returns jsonb language plpgsql stable security definer
set search_path='' as $$
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
  select coalesce(jsonb_agg(row_data order by employee_code),'[]'::jsonb) into v_result
  from (
    select e.employee_code,
      jsonb_build_object('id',e.id,'code',e.employee_code,'name',e.full_name,
        'status',e.employment_status,'has_login',e.auth_user_id is not null) row_data
    from attendance.employees e
    where e.organization_id=p_organization_id
    order by e.employee_code limit p_limit
  ) roster;
  return v_result;
end;
$$;
revoke all on function public.attendance_hr_list_employees(uuid,integer) from public,anon;
grant execute on function public.attendance_hr_list_employees(uuid,integer) to authenticated;

create or replace function public.attendance_hr_list_applications(
  p_organization_id uuid, p_limit integer default 100
) returns jsonb language plpgsql stable security definer
set search_path='' as $$
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
  select coalesce(jsonb_agg(data order by created_at desc),'[]'::jsonb)
  into v_result from (
    select a.created_at,
      jsonb_build_object('id',a.id,'name',a.applicant_name,'source',a.source,
        'status',a.status,'created_at',a.created_at,'employee_id',a.employee_id) as data
    from attendance.applications a
    where a.organization_id=p_organization_id
    order by a.created_at desc limit p_limit
  ) applicants;
  return v_result;
end;
$$;
revoke all on function public.attendance_hr_list_applications(uuid,integer) from public,anon;
grant execute on function public.attendance_hr_list_applications(uuid,integer) to authenticated;

-- No national ID, photo, address, or raw chip payload is accepted.
-- User consent is tracked with a server-generated timestamp, never a client assertion.
create or replace function public.attendance_hr_submit_application(
  p_organization_id uuid, p_applicant_name text, p_source text, p_idempotency_key text,
  p_consent_confirmed boolean
) returns jsonb language plpgsql volatile security definer
set search_path='' as $$
declare v_saved attendance.applications%rowtype; v_name text := trim(p_applicant_name);
begin
  if auth.uid() is null or not exists (
    select 1 from attendance.org_memberships m
    join attendance.organizations o on o.id=m.organization_id
    where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
      and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
  ) then raise exception using errcode='42501',message='attendance_hr_forbidden'; end if;
  if p_applicant_name is null or length(v_name) not between 2 and 180
    or p_source not in ('hr_manual','android_hr','web_application')
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{12,128}$'
    or p_consent_confirmed is distinct from true then
    raise exception using errcode='22023',message='attendance_application_invalid';
  end if;
  insert into attendance.applications
    (organization_id,applicant_name,source,consent_recorded_at,submitted_by,idempotency_key)
  values (p_organization_id,v_name,p_source,clock_timestamp(),auth.uid(),p_idempotency_key)
  on conflict (organization_id,idempotency_key) do nothing
  returning * into v_saved;
  if not found then
    select * into v_saved from attendance.applications a
      where a.organization_id=p_organization_id and a.idempotency_key=p_idempotency_key;
    if v_saved.applicant_name<>v_name or v_saved.source<>p_source
      or v_saved.submitted_by<>auth.uid() then
      raise exception using errcode='23505',message='attendance_application_idempotency_conflict';
    end if;
  else
    insert into attendance.audit_entries
      (organization_id,actor_user_id,action_code,subject_type,subject_id)
    values (p_organization_id,auth.uid(),'application_submitted','application',v_saved.id);
  end if;
  return jsonb_build_object('id',v_saved.id,'status',v_saved.status);
end;
$$;
revoke all on function public.attendance_hr_submit_application(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.attendance_hr_submit_application(uuid,text,text,text,boolean) to authenticated;

create or replace function public.attendance_hr_decide_application(
  p_organization_id uuid,p_application_id uuid,p_decision text,p_employee_code text
) returns jsonb language plpgsql volatile security definer
set search_path='' as $$
declare v_row attendance.applications%rowtype; v_employee uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from attendance.org_memberships m
    join attendance.organizations o on o.id=m.organization_id
    where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
      and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
  ) then raise exception using errcode='42501',message='attendance_hr_forbidden'; end if;
  if p_decision not in ('approved','rejected') or p_decision is null
    or (p_decision='approved' and
        (p_employee_code is null or p_employee_code !~ '^[A-Za-z0-9._-]{2,48}$')) then
    raise exception using errcode='22023',message='attendance_application_decision_invalid';
  end if;
  select * into v_row from attendance.applications a
    where a.id=p_application_id and a.organization_id=p_organization_id for update;
  if not found or v_row.status<>'pending' then
    raise exception using errcode='22023',message='attendance_application_not_pending';
  end if;
  if p_decision='approved' then
    insert into attendance.employees (organization_id,employee_code,full_name)
    values (p_organization_id,p_employee_code,v_row.applicant_name)
    returning id into v_employee;
  end if;
  update attendance.applications set status=p_decision,employee_id=v_employee,
    reviewed_at=clock_timestamp(),reviewed_by=auth.uid()
  where id=v_row.id;
  insert into attendance.audit_entries
    (organization_id,actor_user_id,action_code,subject_type,subject_id,
     details)
  values (p_organization_id,auth.uid(),'application_'||p_decision,
    'application',v_row.id,
    jsonb_build_object('employee_id',v_employee));
  return jsonb_build_object('application_id',v_row.id,'status',p_decision,
    'employee_id',v_employee,'login_provisioned',false);
end;
$$;
revoke all on function public.attendance_hr_decide_application(uuid,uuid,text,text) from public,anon;
grant execute on function public.attendance_hr_decide_application(uuid,uuid,text,text) to authenticated;

-- Future device-proof and entitlement tables are intentionally not in this migration:
-- each mobile kiosk must be provisioned by trusted IT and authorization reviewed first.

-- Employee mobile self-service: return only authenticated employee's own shifts.
create or replace function public.attendance_my_shifts(
  p_organization_id uuid,p_limit integer default 30
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_employee uuid; v_result jsonb;
begin
  if auth.uid() is null or p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode='42501',message='attendance_employee_forbidden';
  end if;
  select e.id into v_employee
  from attendance.employees e
  join attendance.org_memberships m on m.organization_id=e.organization_id
       and m.auth_user_id=e.auth_user_id
  join attendance.organizations o on o.id=e.organization_id
  where e.organization_id=p_organization_id and e.auth_user_id=auth.uid()
    and e.employment_status='active' and m.status='active' and o.status='active';
  if v_employee is null then
    raise exception using errcode='42501',message='attendance_employee_forbidden';
  end if;
  select coalesce(jsonb_agg(row_data order by scheduled_start_at),'[]'::jsonb)
  into v_result from (
    select s.scheduled_start_at,
      jsonb_build_object('starts_at',s.scheduled_start_at,'ends_at',s.scheduled_end_at,
        'shift_label',t.label,'site_name',site.name) row_data
    from attendance.shift_assignments s
    join attendance.shift_templates t on t.id=s.shift_template_id and t.organization_id=s.organization_id
    left join attendance.sites site on site.id=s.site_id and site.organization_id=s.organization_id
    where s.organization_id=p_organization_id and s.employee_id=v_employee
      and s.scheduled_end_at>=clock_timestamp()-interval '2 days'
    order by s.scheduled_start_at asc limit p_limit
  ) upcoming;
  return v_result;
end;
$$;
revoke all on function public.attendance_my_shifts(uuid,integer) from public,anon;
grant execute on function public.attendance_my_shifts(uuid,integer) to authenticated;

-- HR dashboard: no manager-wide access until branch-scoped staff assignments exist.
create or replace function public.attendance_hr_list_events(
  p_organization_id uuid,p_limit integer default 75
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
  select coalesce(jsonb_agg(row_data order by occurred_at desc),'[]'::jsonb)
  into v_result from (
    select ev.occurred_at,
      jsonb_build_object('id',ev.id,'employee_code',emp.employee_code,
        'employee_name',emp.full_name,'event_type',ev.event_type,
        'occurred_at',ev.occurred_at,'method',ev.method,'evidence_status',ev.evidence_status) row_data
    from attendance.time_events ev
    join attendance.employees emp on emp.id=ev.employee_id
       and emp.organization_id=ev.organization_id
    where ev.organization_id=p_organization_id
    order by ev.occurred_at desc limit p_limit
  ) recent;
  return v_result;
end;
$$;
revoke all on function public.attendance_hr_list_events(uuid,integer) from public,anon;
grant execute on function public.attendance_hr_list_events(uuid,integer) to authenticated;
