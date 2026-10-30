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
 v_prior_hr uuid;v_operation text;
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
  v_prior_hr:=v_device.enrolled_by;
  v_operation:='reader_device_rebound';
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
  v_operation:='reader_device_enrolled';
 end if;
 -- Audit the owning HR and device identity, never the capability, login
 -- password, encrypted card content or Supabase access token.
 insert into attendance.audit_entries(
  organization_id,actor_user_id,action_code,subject_type,subject_id,details)
 values(p_org,v_actor,v_operation,'reader_device',v_device.id,
  jsonb_build_object('hr_user_id',v_actor,'previous_hr_user_id',v_prior_hr));
 return jsonb_build_object('enrolled',true,'organization_id',p_org,
  'hr_user_id',v_actor,'device_id',v_device.id);
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


-- Owner-managed multi-HR membership. Login aliases are tenant unique; passwords
-- belong exclusively to the invited user's Supabase Auth account.
create or replace function public.attendance_hr_assert_owner(p_org uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  join attendance.subscriptions s on s.organization_id=o.id
  where m.organization_id=p_org and m.auth_user_id=auth.uid()
   and m.status='active' and m.role='owner' and o.status='active'
   and s.status='active' and s.expires_at>clock_timestamp()
   and s.starts_at<=clock_timestamp() and 'hr_web'=any(s.enabled_modules)
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 return true;
end;$$;
revoke all on function public.attendance_hr_assert_owner(uuid) from public,anon;
grant execute on function public.attendance_hr_assert_owner(uuid) to authenticated;

-- Delegated team management is scoped to active Owner/HR Admin membership.
-- HR Admin may manage peer HR accounts, never Owner accounts.
create or replace function public.attendance_hr_assert_manager(p_org uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  join attendance.subscriptions s on s.organization_id=o.id
  where m.organization_id=p_org and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
   and s.status='active' and s.expires_at>clock_timestamp()
   and s.starts_at<=clock_timestamp() and 'hr_web'=any(s.enabled_modules)
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 return true;
end;$$;
revoke all on function public.attendance_hr_assert_manager(uuid) from public,anon;
grant execute on function public.attendance_hr_assert_manager(uuid) to authenticated;

create or replace function public.attendance_hr_invite_member(
 p_org uuid,p_member uuid,p_hr_code text,p_email text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.attendance_hr_assert_manager(p_org);
 if p_member is null or p_hr_code is null or p_hr_code !~ '^[A-Z0-9]{6}$'
   or p_email is null or length(p_email)>254 or p_email !~* '^[^ @]+@[^ @]+\.[^ @]+$'
 then raise exception using errcode='22023',message='attendance_hr_invite_invalid';end if;
 if not exists(
  select 1 from auth.users u where u.id=p_member and lower(u.email)=lower(p_email)
 ) then raise exception using errcode='42501',message='attendance_hr_invite_identity_mismatch';end if;
 if exists(select 1 from attendance.org_memberships
  where organization_id=p_org and auth_user_id=p_member)
 then raise exception using errcode='23505',message='attendance_hr_member_exists';end if;
 insert into attendance.org_memberships(organization_id,auth_user_id,role,status)
 values(p_org,p_member,'hr_admin','active');
 insert into attendance.hr_login_aliases(organization_id,login_code,auth_user_id)
 values(p_org,p_hr_code,p_member);
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,subject_type,subject_id,details)
 values(p_org,auth.uid(),'hr_member_invited','hr_member',p_member,
  jsonb_build_object('hr_code',p_hr_code));
 return jsonb_build_object('invited',true,'hr_code',p_hr_code);
end;$$;
revoke all on function public.attendance_hr_invite_member(uuid,uuid,text,text) from public,anon;
grant execute on function public.attendance_hr_invite_member(uuid,uuid,text,text) to authenticated;

create or replace function public.attendance_hr_list_members(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 perform public.attendance_hr_assert_manager(p_org);
 select coalesce(jsonb_agg(jsonb_build_object(
  'hr_code',a.login_code,'role',m.role,
  'status',case when m.status='active' and a.is_enabled then 'active' else 'disabled' end)
  order by a.login_code),'[]'::jsonb) into v
 from attendance.hr_login_aliases a
 join attendance.org_memberships m on m.organization_id=a.organization_id
  and m.auth_user_id=a.auth_user_id
 where a.organization_id=p_org and m.role in ('owner','hr_admin');
 return v;
end;$$;
revoke all on function public.attendance_hr_list_members(uuid) from public,anon;
grant execute on function public.attendance_hr_list_members(uuid) to authenticated;

create or replace function public.attendance_hr_disable_member(p_org uuid,p_hr_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;
begin
 perform public.attendance_hr_assert_manager(p_org);
 select a.auth_user_id into v_actor
 from attendance.hr_login_aliases a
 join attendance.org_memberships m on m.organization_id=a.organization_id
  and m.auth_user_id=a.auth_user_id
 where a.organization_id=p_org and a.login_code=p_hr_code
   and m.role='hr_admin' and m.status='active' and a.auth_user_id<>auth.uid() for update of a;
 if not found then raise exception using errcode='42501',message='attendance_hr_member_forbidden';end if;
 update attendance.hr_login_aliases set is_enabled=false
  where organization_id=p_org and login_code=p_hr_code;
 update attendance.org_memberships set status='disabled'
  where organization_id=p_org and auth_user_id=v_actor;
 update attendance.reader_devices set status='revoked'
  where organization_id=p_org and enrolled_by=v_actor and status='active';
 update attendance.reader_handoffs set status='cancelled',encrypted_envelope=null
  where organization_id=p_org and hr_user_id=v_actor
    and status in ('waiting','paired','reading','received');
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,subject_type,subject_id,details)
 values(p_org,auth.uid(),'hr_member_disabled','hr_member',v_actor,
  jsonb_build_object('hr_code',p_hr_code));
 return jsonb_build_object('disabled',true,'hr_code',p_hr_code);
end;$$;
revoke all on function public.attendance_hr_disable_member(uuid,text) from public,anon;
grant execute on function public.attendance_hr_disable_member(uuid,text) to authenticated;

-- Re-enable a disabled HR account after a scoped manager decision. Never revive
-- an Owner or another tenant's account. The actor is recorded in the audit log.
create or replace function public.attendance_hr_enable_member(p_org uuid,p_hr_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member uuid;
begin
 perform public.attendance_hr_assert_manager(p_org);
 select a.auth_user_id into v_member
 from attendance.hr_login_aliases a
 join attendance.org_memberships m on m.organization_id=a.organization_id
  and m.auth_user_id=a.auth_user_id
 where a.organization_id=p_org and a.login_code=p_hr_code
   and m.role='hr_admin' and m.status='disabled'
   and a.is_enabled=false for update of a;
 if not found then raise exception using errcode='42501',message='attendance_hr_member_forbidden';end if;
 update attendance.org_memberships set status='active'
  where organization_id=p_org and auth_user_id=v_member and role='hr_admin' and status='disabled';
 update attendance.hr_login_aliases set is_enabled=true
  where organization_id=p_org and auth_user_id=v_member and login_code=p_hr_code;
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,subject_type,subject_id,details)
 values(p_org,auth.uid(),'hr_member_enabled','hr_member',v_member,
  jsonb_build_object('hr_code',p_hr_code));
 return jsonb_build_object('enabled',true,'hr_code',p_hr_code);
end;$$;
revoke all on function public.attendance_hr_enable_member(uuid,text) from public,anon;
grant execute on function public.attendance_hr_enable_member(uuid,text) to authenticated;
