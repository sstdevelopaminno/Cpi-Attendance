-- Auth aliases are deterministic HMAC-derived only by trusted API server;
-- passwords are verified by Supabase Auth, NEVER stored in this schema.
create table if not exists attendance.login_rate_limits (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table attendance.login_rate_limits enable row level security;
revoke all on attendance.login_rate_limits from public,anon,authenticated;

create or replace function public.attendance_allow_login(p_fingerprint text)
returns boolean
language plpgsql security definer
set search_path=''
as $$
declare
  v_count integer;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='invalid_login_fingerprint';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('attendance:login:'||p_fingerprint,0));
  insert into attendance.login_rate_limits (fingerprint,attempts,window_started_at)
    values (p_fingerprint,1,clock_timestamp())
  on conflict (fingerprint) do update
    set attempts=case when attendance.login_rate_limits.window_started_at<
       clock_timestamp()-interval '15 minutes'
       then 1 else attendance.login_rate_limits.attempts+1 end,
      window_started_at=case when attendance.login_rate_limits.window_started_at<
       clock_timestamp()-interval '15 minutes'
       then clock_timestamp() else attendance.login_rate_limits.window_started_at end,
      updated_at=clock_timestamp()
  returning attempts into v_count;
  -- Fails before performing password verification, including on the 9th attempt.
  if v_count>8 then
    raise exception using errcode='P0001',message='attendance_login_rate_limited';
  end if;
  return true;
end;
$$;
revoke all on function public.attendance_allow_login(text) from public,anon,authenticated;
grant execute on function public.attendance_allow_login(text) to service_role;

create or replace function public.attendance_login_context(p_organization_code text)
returns jsonb
language plpgsql stable security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_org attendance.organizations%rowtype;
  v_membership attendance.org_memberships%rowtype;
  v_employee attendance.employees%rowtype;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='attendance_login_required';
  end if;
  select * into v_org from attendance.organizations
    where code=p_organization_code and status='active';
  if not found then
    raise exception using errcode='42501',message='attendance_org_forbidden';
  end if;
  select * into v_membership from attendance.org_memberships m
    where m.organization_id=v_org.id and m.auth_user_id=v_actor and m.status='active';
  if not found then
    raise exception using errcode='42501',message='attendance_org_forbidden';
  end if;
  select * into v_employee from attendance.employees e
    where e.organization_id=v_org.id and e.auth_user_id=v_actor
      and e.employment_status='active';
  return jsonb_build_object(
    'organization_id',v_org.id,
    'organization_code',v_org.code,
    'organization_name',v_org.legal_name,
    'role',v_membership.role,
    'employee_id',case when v_employee.id is null then null else v_employee.id end,
    'employee_code',v_employee.employee_code,
    'full_name',v_employee.full_name
  );
end;
$$;
revoke all on function public.attendance_login_context(text) from public,anon;
grant execute on function public.attendance_login_context(text) to authenticated;
