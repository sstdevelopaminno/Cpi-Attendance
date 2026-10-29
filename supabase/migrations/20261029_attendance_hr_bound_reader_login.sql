-- HR-authenticated Android enrollment. The customer owns HR accounts; no pairing PIN.
-- Staging first: keep production database unchanged until isolated SQL acceptance.
alter table attendance.reader_devices add column if not exists login_verified_at timestamptz;
-- One Android installation rotates its Keystore capability after each successful HR login.
-- A prior capability is valid for rotation only in the same tenant, and is invalidated atomically.
create or replace function public.attendance_reader_device_enroll(
 p_org uuid,p_device_hash text,p_previous_hash text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device attendance.reader_devices%rowtype;
 v_limit integer;v_count integer;v_actor uuid:=auth.uid();
begin
 if v_actor is null or p_org is null or p_device_hash is null
   or p_device_hash !~ '^[0-9a-f]{64}$'
   or (p_previous_hash is not null and p_previous_hash !~ '^[0-9a-f]{64}$')
   or p_device_hash is not distinct from p_previous_hash
 then raise exception using errcode='42501',message='reader_device_denied';end if;
 if not exists (
  select 1 from attendance.org_memberships m
   join attendance.organizations o on o.id=m.organization_id
   where m.organization_id=p_org and m.auth_user_id=v_actor
    and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 select s.max_android_devices into v_limit
 from attendance.subscriptions s where s.organization_id=p_org
  and s.status='active' and s.starts_at<=clock_timestamp()
  and s.expires_at>clock_timestamp() and 'android_hr'=any(s.enabled_modules)
 for update;
 if v_limit is null or v_limit<1
 then raise exception using errcode='42501',message='reader_package_inactive';end if;
 if p_previous_hash is not null then
  select * into v_device from attendance.reader_devices
   where secret_sha256=p_previous_hash for update;
  if not found or v_device.organization_id<>p_org or v_device.status<>'active'
  then raise exception using errcode='42501',message='reader_device_denied';end if;
  -- Do not permit one HR to receive another HR's in-flight ciphertext.
  update attendance.reader_handoffs set status='cancelled',encrypted_envelope=null
   where organization_id=p_org and device_sha256=p_previous_hash
    and status in ('waiting','paired','reading','received');
  update attendance.reader_devices
   set secret_sha256=p_device_hash,enrolled_by=v_actor,
       login_verified_at=clock_timestamp(),last_seen_at=clock_timestamp()
   where id=v_device.id;
 else
  select count(*) into v_count from attendance.reader_devices
   where organization_id=p_org and status='active';
  if v_count>=v_limit then
    raise exception using errcode='42501',message='reader_device_limit';end if;
  insert into attendance.reader_devices(
   organization_id,secret_sha256,enrolled_by,login_verified_at,last_seen_at)
   values(p_org,p_device_hash,v_actor,clock_timestamp(),clock_timestamp())
   returning * into v_device;
 end if;
 return jsonb_build_object('enrolled',true,'organization_id',p_org);
end;$$;
revoke all on function public.attendance_reader_device_enroll(uuid,text,text) from public,anon;
grant execute on function public.attendance_reader_device_enroll(uuid,text,text) to authenticated;

-- Legacy manual pairing is not a valid authentication mechanism after upgrade.
drop function if exists public.attendance_reader_device_claim(text,text);

-- Poll only sessions belonging to the exact HR user that authenticated this device.
create or replace function public.attendance_reader_device_next(p_device_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d attendance.reader_devices%rowtype;v attendance.reader_handoffs%rowtype;
begin
 if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$'
 then raise exception using errcode='42501',message='reader_device_denied';end if;
 select * into d from attendance.reader_devices
 where secret_sha256=p_device_hash and status='active'
  and login_verified_at is not null for update;
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 if not exists (
   select 1 from attendance.org_memberships m
   join attendance.organizations o on o.id=m.organization_id
   where m.organization_id=d.organization_id and m.auth_user_id=d.enrolled_by
    and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='reader_device_denied';end if;
 if not exists(select 1 from attendance.subscriptions s
  where s.organization_id=d.organization_id and s.status='active'
   and s.expires_at>clock_timestamp() and s.starts_at<=clock_timestamp()
   and 'android_hr'=any(s.enabled_modules))
 then raise exception using errcode='42501',message='reader_package_inactive';end if;
 update attendance.reader_devices set last_seen_at=clock_timestamp() where id=d.id;
 select * into v from attendance.reader_handoffs h
  where h.organization_id=d.organization_id and h.hr_user_id=d.enrolled_by
   and h.device_sha256=p_device_hash and h.status in ('paired','reading')
   and h.expires_at>clock_timestamp()
  order by h.created_at desc limit 1 for update;
 if not found then
  select * into v from attendance.reader_handoffs h
   where h.organization_id=d.organization_id and h.hr_user_id=d.enrolled_by
    and h.status='waiting' and h.expires_at>clock_timestamp()
   order by h.created_at asc limit 1 for update skip locked;
  if found then
   update attendance.reader_handoffs set status='paired',device_sha256=p_device_hash
    where id=v.id;
  end if;
 end if;
 if not found then return jsonb_build_object('online',true,'status','idle');end if;
 return jsonb_build_object('online',true,'status',v.status,
  'session_id',v.id,'public_key_spki',v.public_key_spki,'expires_at',v.expires_at);
end;$$;
revoke all on function public.attendance_reader_device_next(text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_next(text) to service_role;

create or replace function public.attendance_reader_device_progress(p_id uuid,p_device_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists (
  select 1 from attendance.reader_handoffs h
  join attendance.reader_devices d on d.organization_id=h.organization_id
   and d.secret_sha256=p_device_hash and d.status='active'
   and d.login_verified_at is not null and d.enrolled_by=h.hr_user_id
  join attendance.org_memberships m on m.organization_id=d.organization_id
   and m.auth_user_id=d.enrolled_by and m.status='active'
   and m.role in ('owner','hr_admin')
  join attendance.subscriptions s on s.organization_id=h.organization_id
   and s.status='active' and s.expires_at>clock_timestamp()
   and s.starts_at<=clock_timestamp() and 'android_hr'=any(s.enabled_modules)
  where h.id=p_id and h.device_sha256=p_device_hash and h.status in ('paired','reading')
   and h.expires_at>clock_timestamp()
 ) then raise exception using errcode='42501',message='reader_device_denied';end if;
 update attendance.reader_handoffs set status='reading'
 where id=p_id and device_sha256=p_device_hash
  and status in('paired','reading') and expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 return jsonb_build_object('status','reading');
end;$$;
revoke all on function public.attendance_reader_device_progress(uuid,text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_progress(uuid,text) to service_role;

create or replace function public.attendance_reader_device_publish(
 p_id uuid,p_device_hash text,p_envelope jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_envelope is null or jsonb_typeof(p_envelope)<>'object'
 or not (p_envelope ?& array['wrapped_key','iv','ciphertext'])
 or length(p_envelope::text)>250000
 or length(coalesce(p_envelope->>'wrapped_key','')) not between 300 and 700
 or length(coalesce(p_envelope->>'iv','')) not between 16 and 40
 or length(coalesce(p_envelope->>'ciphertext','')) not between 20 and 230000
 then raise exception using errcode='22023',message='reader_envelope_invalid';end if;
 if not exists(
   select 1 from attendance.reader_handoffs h
   join attendance.reader_devices d on d.organization_id=h.organization_id
    and d.secret_sha256=p_device_hash and d.status='active'
    and d.login_verified_at is not null and d.enrolled_by=h.hr_user_id
   join attendance.org_memberships m on m.organization_id=d.organization_id
    and m.auth_user_id=d.enrolled_by and m.status='active'
    and m.role in ('owner','hr_admin')
   join attendance.subscriptions s on s.organization_id=h.organization_id
    and s.status='active' and s.expires_at>clock_timestamp()
    and s.starts_at<=clock_timestamp() and 'android_hr'=any(s.enabled_modules)
   where h.id=p_id and h.device_sha256=p_device_hash and h.status='reading'
    and h.expires_at>clock_timestamp()
 ) then raise exception using errcode='42501',message='reader_device_denied';end if;
 update attendance.reader_handoffs set status='received',
  encrypted_envelope=p_envelope,received_at=clock_timestamp()
 where id=p_id and device_sha256=p_device_hash and status='reading'
  and expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 return jsonb_build_object('status','received');
end;$$;
revoke all on function public.attendance_reader_device_publish(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_publish(uuid,text,jsonb) to service_role;

create or replace function public.attendance_reader_device_status(p_id uuid,p_device_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.reader_handoffs%rowtype;
begin
 select h.* into v from attendance.reader_handoffs h
  join attendance.reader_devices d on d.organization_id=h.organization_id
   and d.secret_sha256=p_device_hash and d.status='active'
   and d.login_verified_at is not null and d.enrolled_by=h.hr_user_id
  where h.id=p_id and h.device_sha256=p_device_hash;
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 return jsonb_build_object('status',
   case when v.status='saved' then 'saved'
        when v.expires_at<clock_timestamp() then 'expired' else v.status end);
end;$$;
revoke all on function public.attendance_reader_device_status(uuid,text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_status(uuid,text) to service_role;
