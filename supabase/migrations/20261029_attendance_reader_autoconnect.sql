-- Subscriber-managed Android HR reader registry; IT operates the package only.
-- One HR-approved pairing registers a device. Later boots auto-connect via a
-- device-only secret kept in Android Keystore. No card data in this table.
create table attendance.reader_devices (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references attendance.organizations(id) on delete restrict,
 secret_sha256 text not null unique check(secret_sha256 ~ '^[0-9a-f]{64}$'),
 label text not null default 'Android HR Reader',
 status text not null default 'active' check(status in ('active','revoked')),
 enrolled_by uuid not null references auth.users(id),
 enrolled_at timestamptz not null default clock_timestamp(),
 last_seen_at timestamptz
);
create index on attendance.reader_devices(organization_id,status);
alter table attendance.reader_devices enable row level security;
revoke all on attendance.reader_devices from public,anon,authenticated;
alter table attendance.reader_handoffs add column application_id uuid references attendance.applications(id);
alter table attendance.reader_handoffs drop constraint if exists reader_handoffs_status_check;
alter table attendance.reader_handoffs add constraint reader_handoffs_status_check check(status in('waiting','paired','reading','received','consumed','cancelled','saved'));

-- The one-time HR browser pairing code establishes an authorized device, not a
-- permanent shared PIN. Lock the subscription row to enforce purchased quotas.
create or replace function public.attendance_reader_device_claim(
 p_code_hash text,p_device_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.reader_handoffs%rowtype;
 v_limit integer;v_count integer;
begin
 if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
 or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$'
 then raise exception using errcode='22023',message='reader_invalid_capability';end if;
 select * into v from attendance.reader_handoffs
 where pairing_sha256=p_code_hash and status='waiting'
   and expires_at>clock_timestamp() for update;
 if not found then raise exception using errcode='42501',message='reader_pairing_denied';end if;
 select s.max_android_devices into v_limit
 from attendance.subscriptions s where s.organization_id=v.organization_id
  and s.status='active' and s.expires_at>clock_timestamp()
  and s.starts_at<=clock_timestamp() and 'android_hr'=any(s.enabled_modules)
 for update;
 if v_limit is null then raise exception using errcode='42501',message='reader_package_inactive';end if;
 select count(*) into v_count from attendance.reader_devices d
 where d.organization_id=v.organization_id and d.status='active';
 if not exists(select 1 from attendance.reader_devices where secret_sha256=p_device_hash)
   and v_count>=v_limit then
  raise exception using errcode='42501',message='reader_device_limit';end if;
 insert into attendance.reader_devices(organization_id,secret_sha256,enrolled_by)
 values(v.organization_id,p_device_hash,v.hr_user_id)
 on conflict (secret_sha256) do nothing;
 if not exists(select 1 from attendance.reader_devices
 where organization_id=v.organization_id and status='active'
  and secret_sha256=p_device_hash)
 then raise exception using errcode='42501',message='reader_device_denied';end if;
 update attendance.reader_handoffs set status='paired',device_sha256=p_device_hash
 where id=v.id;
 return jsonb_build_object('session_id',v.id,'public_key_spki',v.public_key_spki,
  'status','paired','expires_at',v.expires_at);
end;$$;
revoke all on function public.attendance_reader_device_claim(text,text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_claim(text,text) to service_role;

-- On app startup, registered Android devices report online and claim a waiting
-- request from their own subscribing organization; never scan without an HR
-- request. Returning 'idle' must never reveal other org/applicant details.
create function public.attendance_reader_device_next(p_device_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d attendance.reader_devices%rowtype; v attendance.reader_handoffs%rowtype;
begin
 if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
  raise exception using errcode='42501',message='reader_device_denied';end if;
 select * into d from attendance.reader_devices
 where secret_sha256=p_device_hash and status='active' for update;
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 if not exists(select 1 from attendance.subscriptions s
 where s.organization_id=d.organization_id and s.status='active'
  and s.expires_at>clock_timestamp() and s.starts_at<=clock_timestamp()
  and 'android_hr'=any(s.enabled_modules)) then
  raise exception using errcode='42501',message='reader_package_inactive';end if;
 update attendance.reader_devices set last_seen_at=clock_timestamp() where id=d.id;
 select * into v from attendance.reader_handoffs h
 where h.organization_id=d.organization_id and h.device_sha256=p_device_hash
  and h.status in ('paired','reading') and h.expires_at>clock_timestamp()
 order by h.created_at desc limit 1 for update;
 if not found then
  select * into v from attendance.reader_handoffs h
   where h.organization_id=d.organization_id and h.status='waiting'
    and h.expires_at>clock_timestamp()
   order by h.created_at asc limit 1 for update skip locked;
  if found then
   update attendance.reader_handoffs set status='paired',device_sha256=p_device_hash where id=v.id;
  end if;
 end if;
 if not found then return jsonb_build_object('online',true,'status','idle');end if;
 return jsonb_build_object('online',true,'status',v.status,
  'session_id',v.id,'public_key_spki',v.public_key_spki,'expires_at',v.expires_at);
end;$$;
revoke all on function public.attendance_reader_device_next(text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_next(text) to service_role;

-- Read-only status visible to the paired device after it has sent ciphertext.
create function public.attendance_reader_device_status(p_id uuid,p_device_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.reader_handoffs%rowtype;
begin
 if not exists(select 1 from attendance.reader_devices d
  where d.secret_sha256=p_device_hash and d.status='active') then
  raise exception using errcode='42501',message='reader_device_denied';end if;
 select * into v from attendance.reader_handoffs
 where id=p_id and device_sha256=p_device_hash;
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 return jsonb_build_object('status',
   case when v.expires_at<clock_timestamp() then 'expired' else v.status end);
end;$$;
revoke all on function public.attendance_reader_device_status(uuid,text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_status(uuid,text) to service_role;

-- Preserve device association on 'consumed', otherwise Android cannot know
-- whether HR has subsequently saved the reviewed application.
create or replace function public.attendance_hr_reader_finish(p_org uuid,p_id uuid,p_cancel boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 update attendance.reader_handoffs set
 status=case when p_cancel then 'cancelled' else 'consumed' end,
 encrypted_envelope=null
 where id=p_id and organization_id=p_org and hr_user_id=auth.uid()
   and status in ('waiting','paired','reading','received')
 returning status into v_status;
 if not found then raise exception using errcode='42501',message='reader_session_missing';end if;
 return jsonb_build_object('status',v_status);
end;$$;
revoke all on function public.attendance_hr_reader_finish(uuid,uuid,boolean) from public,anon;
grant execute on function public.attendance_hr_reader_finish(uuid,uuid,boolean) to authenticated;

create function public.attendance_hr_reader_saved(p_org uuid,p_id uuid,p_application uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists (
   select 1 from attendance.org_memberships m where m.organization_id=p_org
   and m.auth_user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_admin')
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if not exists(select 1 from attendance.applications a
  where a.id=p_application and a.organization_id=p_org and a.status='pending')
 then raise exception using errcode='22023',message='application_not_found';end if;
 update attendance.reader_handoffs set status='saved',application_id=p_application
 where organization_id=p_org and id=p_id and hr_user_id=auth.uid()
  and status='consumed' and expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='reader_session_missing';end if;
 return jsonb_build_object('status','saved');
end;$$;
revoke all on function public.attendance_hr_reader_saved(uuid,uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_reader_saved(uuid,uuid,uuid) to authenticated;

-- Customer HR controls revocation. Platform IT has no device approval powers.
create function public.attendance_hr_reader_revoke(p_org uuid,p_device uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from attendance.org_memberships m
 where m.organization_id=p_org and m.auth_user_id=auth.uid()
 and m.status='active' and m.role in ('owner','hr_admin'))
 then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 update attendance.reader_devices set status='revoked'
 where id=p_device and organization_id=p_org and status='active';
 if not found then raise exception using errcode='22023',message='reader_device_missing';end if;
 return jsonb_build_object('revoked',true);
end;$$;
revoke all on function public.attendance_hr_reader_revoke(uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_reader_revoke(uuid,uuid) to authenticated;
