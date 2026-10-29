-- Phase 2: trusted attendance RPCs with no direct table exposure.
-- Runs only in a disposable Postgres CI database until separately approved.
create table if not exists attendance.qr_challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  site_id uuid not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  nonce_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id,site_id) references attendance.sites(organization_id,id) on delete restrict
);
create index if not exists idx_att_qr_challenges_scope_expiry
  on attendance.qr_challenges(organization_id,site_id,expires_at desc);
alter table attendance.qr_challenges enable row level security;
revoke all on attendance.qr_challenges from public,anon,authenticated;

-- A signed-in employee must have an active identity bound to a specific organization.
-- The caller can provide organization_id, but cannot choose a different employee_id.
create or replace function public.attendance_issue_qr(
  p_organization_id uuid, p_site_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_nonce text;
  v_id uuid;
  v_expires_at timestamptz;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='attendance_login_required';
  end if;
  if not exists (
    select 1 from attendance.org_memberships m
    join attendance.organizations o on o.id=m.organization_id
    where m.organization_id=p_organization_id and m.auth_user_id=v_actor
      and m.status='active' and o.status='active'
      and m.role in ('owner','hr_admin')
  ) then
    raise exception using errcode='42501', message='attendance_qr_issuer_forbidden';
  end if;
  if not exists (select 1 from attendance.sites s
     where s.id=p_site_id and s.organization_id=p_organization_id and s.is_active) then
    raise exception using errcode='22023',message='attendance_site_unavailable';
  end if;
  -- 244 bits of randomness from two PostgreSQL UUIDv4 values.
  v_nonce := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  v_expires_at := clock_timestamp()+interval '30 seconds';
  insert into attendance.qr_challenges
    (organization_id,site_id,issued_by,nonce_hash,expires_at)
  values
    (p_organization_id,p_site_id,v_actor,
     encode(sha256(convert_to(v_nonce,'UTF8')),'hex'),v_expires_at)
  returning id into v_id;
  return jsonb_build_object('challenge_id',v_id,'nonce',v_nonce,
    'expires_at',v_expires_at,'organization_id',p_organization_id,
    'site_id',p_site_id);
end;
$$;
revoke all on function public.attendance_issue_qr(uuid,uuid) from public,anon;
grant execute on function public.attendance_issue_qr(uuid,uuid) to authenticated;

create or replace function public.attendance_record_punch(
  p_organization_id uuid,
  p_event_type text,
  p_idempotency_key text,
  p_qr_nonce text,
  p_lat numeric,
  p_lon numeric,
  p_accuracy_m numeric
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_employee attendance.employees%rowtype;
  v_org attendance.organizations%rowtype;
  v_site attendance.sites%rowtype;
  v_challenge attendance.qr_challenges%rowtype;
  v_previous attendance.time_events%rowtype;
  v_existing attendance.time_events%rowtype;
  v_event attendance.time_events%rowtype;
  v_distance_m double precision;
  v_evidence text := 'not_required';
  v_epoch timestamptz := clock_timestamp();
  v_nonce_hash text;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='attendance_login_required';
  end if;
  if p_event_type not in ('check_in','check_out') or p_event_type is null then
    raise exception using errcode='22023',message='attendance_invalid_event_type';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{12,128}$' then
    raise exception using errcode='22023',message='attendance_invalid_idempotency_key';
  end if;
  if p_qr_nonce is null or p_qr_nonce !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='attendance_invalid_qr';
  end if;
  if not exists (
    select 1 from attendance.org_memberships m
    where m.organization_id=p_organization_id and m.auth_user_id=v_actor
      and m.status='active'
  ) then
    raise exception using errcode='42501',message='attendance_org_forbidden';
  end if;
  select * into v_org from attendance.organizations o
   where o.id=p_organization_id and o.status='active';
  if not found then
    raise exception using errcode='42501',message='attendance_org_inactive';
  end if;
  select * into v_employee from attendance.employees e
    where e.organization_id=p_organization_id and e.auth_user_id=v_actor
      and e.employment_status='active';
  if not found then
    raise exception using errcode='42501',message='attendance_employee_not_bound';
  end if;

  -- Serialize punches for the same employee, including parallel requests.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||v_employee.id::text,0));

  -- Idempotent retry returns the original result; changing payload with the same
  -- key is rejected, rather than charging a second punch.
  select * into v_existing from attendance.time_events e
    where e.organization_id=p_organization_id and e.idempotency_key=p_idempotency_key;
  v_nonce_hash := encode(sha256(convert_to(p_qr_nonce,'UTF8')),'hex');
  if found then
    if v_existing.employee_id<>v_employee.id
       or v_existing.event_type<>p_event_type
       or v_existing.method<>'qr'
       or v_existing.metadata->>'nonce_hash'<>v_nonce_hash then
      raise exception using errcode='23505',message='attendance_idempotency_conflict';
    end if;
    return jsonb_build_object('event_id',v_existing.id,
      'occurred_at',v_existing.occurred_at,
      'evidence_status',v_existing.evidence_status,'replayed',true);
  end if;

  select * into v_challenge from attendance.qr_challenges q
   where q.organization_id=p_organization_id
     and q.nonce_hash=v_nonce_hash and q.expires_at>v_epoch;
  if not found then
    raise exception using errcode='22023',message='attendance_qr_expired_or_invalid';
  end if;
  select * into v_site from attendance.sites s
   where s.organization_id=p_organization_id and s.id=v_challenge.site_id
     and s.is_active;
  if not found then
    raise exception using errcode='22023',message='attendance_site_unavailable';
  end if;
  if v_site.geofence_enabled then
    if p_lat is null or p_lon is null or p_accuracy_m is null
       or p_lat not between -90 and 90 or p_lon not between -180 and 180
       or p_accuracy_m < 0 or p_accuracy_m > 100 then
      raise exception using errcode='22023',message='attendance_location_insufficient';
    end if;
    -- Haversine distance between browser-reported GPS and registered site center.
    v_distance_m := 2*6371008.8*asin(least(1.0,sqrt(
      power(sin(radians((p_lat-v_site.lat)::double precision)/2),2)
      +cos(radians(p_lat::double precision))*cos(radians(v_site.lat::double precision))
      *power(sin(radians((p_lon-v_site.lon)::double precision)/2),2)
    )));
    if v_distance_m > v_site.geofence_radius_m then
      raise exception using errcode='22023',message='attendance_outside_geofence';
    end if;
    v_evidence := case when v_distance_m+p_accuracy_m > v_site.geofence_radius_m
       then 'review' else 'inside' end;
  end if;

  select * into v_previous from attendance.time_events e
    where e.organization_id=p_organization_id and e.employee_id=v_employee.id
      and e.event_type in ('check_in','check_out')
    order by e.occurred_at desc,e.created_at desc limit 1;
  if p_event_type='check_out' and (not found or v_previous.event_type<>'check_in') then
    raise exception using errcode='22023',message='attendance_no_open_shift';
  end if;
  if p_event_type='check_in' and found and v_previous.event_type='check_in' then
    raise exception using errcode='22023',message='attendance_already_checked_in';
  end if;

  insert into attendance.time_events (
    organization_id,employee_id,site_id,event_type,method,
    idempotency_key,occurred_at,lat,lon,location_accuracy_m,evidence_status,metadata
  ) values (
    p_organization_id,v_employee.id,v_site.id,p_event_type,'qr',
    p_idempotency_key,v_epoch,p_lat,p_lon,p_accuracy_m,v_evidence,
    jsonb_build_object('challenge_id',v_challenge.id,'nonce_hash',v_nonce_hash)
  ) returning * into v_event;

  insert into attendance.audit_entries
    (organization_id,actor_user_id,action_code,subject_type,subject_id,details)
  values (p_organization_id,v_actor,'attendance_'||p_event_type,
    'attendance.time_events',v_event.id,
    jsonb_build_object('site_id',v_site.id,'evidence_status',v_evidence));
  return jsonb_build_object('event_id',v_event.id,
    'occurred_at',v_event.occurred_at,
    'evidence_status',v_event.evidence_status,'replayed',false);
end;
$$;
revoke all on function public.attendance_record_punch(uuid,text,text,text,numeric,numeric,numeric)
  from public,anon;
grant execute on function public.attendance_record_punch(uuid,text,text,text,numeric,numeric,numeric)
  to authenticated;

create or replace function public.attendance_my_history(
  p_organization_id uuid, p_limit integer default 30
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
        v_employee uuid;
        v_result jsonb;
begin
  if v_actor is null or p_limit not between 1 and 100 then
    raise exception using errcode='42501',message='attendance_history_forbidden';
  end if;
  select e.id into v_employee from attendance.employees e
    join attendance.org_memberships m on
      m.organization_id=e.organization_id and m.auth_user_id=e.auth_user_id
    where e.organization_id=p_organization_id and e.auth_user_id=v_actor
      and e.employment_status='active' and m.status='active';
  if v_employee is null then
    raise exception using errcode='42501',message='attendance_employee_not_bound';
  end if;
  select coalesce(jsonb_agg(x.data order by x.occurred_at desc),'[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object('id',e.id,'event_type',e.event_type,
      'occurred_at',e.occurred_at,'evidence_status',e.evidence_status) as data,
      e.occurred_at
    from attendance.time_events e
    where e.organization_id=p_organization_id and e.employee_id=v_employee
    order by e.occurred_at desc limit p_limit
  ) x;
  return v_result;
end;
$$;
revoke all on function public.attendance_my_history(uuid,integer) from public,anon;
grant execute on function public.attendance_my_history(uuid,integer) to authenticated;
