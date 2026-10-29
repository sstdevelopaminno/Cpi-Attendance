-- Staging-only migration. HR-initiated, one-time encrypted Android chip intake.
-- NEVER apply against Communications production until complete Auth, licensing/privacy
-- review, service role secret handling and expiry-cleanup job are verified.
create table attendance.reader_handoffs(
 id uuid primary key,
 organization_id uuid not null references attendance.organizations(id) on delete restrict,
 hr_user_id uuid not null references auth.users(id) on delete restrict,
 pairing_sha256 text not null unique check(pairing_sha256 ~ '^[0-9a-f]{64}$'),
 device_sha256 text check(device_sha256 ~ '^[0-9a-f]{64}$'),
 public_key_spki text not null check(length(public_key_spki) between 250 and 1400),
 status text not null default 'waiting'
   check(status in('waiting','paired','reading','received','consumed','cancelled')),
 encrypted_envelope jsonb,
 expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),
 received_at timestamptz,
 check(encrypted_envelope is null or
  (jsonb_typeof(encrypted_envelope)='object' and
   encrypted_envelope ?& array['wrapped_key','iv','ciphertext']))
);
create index on attendance.reader_handoffs(organization_id,hr_user_id,expires_at desc);
alter table attendance.reader_handoffs enable row level security;
revoke all on attendance.reader_handoffs from public,anon,authenticated;

-- HR-owned session start. Privileged backend generates random 128-bit token and SHA-256;
-- database stores hash only; token shown once to the initiating HR browser.
create function public.attendance_hr_reader_start(
 p_org uuid,p_id uuid,p_code_hash text,p_public_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_exp timestamptz;
begin
 if auth.uid() is null or not exists (
  select 1 from attendance.org_memberships m
  join attendance.organizations o on o.id=m.organization_id
  where m.auth_user_id=auth.uid() and m.organization_id=p_org
    and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if p_id is null or p_code_hash !~ '^[0-9a-f]{64}$'
 or p_public_key is null or length(p_public_key) not between 250 and 1400 then
   raise exception using errcode='22023',message='reader_request_invalid';end if;
 update attendance.reader_handoffs set status='cancelled',encrypted_envelope=null
 where organization_id=p_org and hr_user_id=auth.uid()
   and status in('waiting','paired','reading','received');
 v_exp:=clock_timestamp()+interval '5 minutes';
 insert into attendance.reader_handoffs(
  id,organization_id,hr_user_id,pairing_sha256,public_key_spki,expires_at
 ) values(p_id,p_org,auth.uid(),p_code_hash,p_public_key,v_exp);
 return jsonb_build_object('session_id',p_id,'status','waiting','expires_at',v_exp);
end;$$;
revoke all on function public.attendance_hr_reader_start(uuid,uuid,text,text) from public,anon;
grant execute on function public.attendance_hr_reader_start(uuid,uuid,text,text) to authenticated;

create function public.attendance_hr_reader_poll(p_org uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.reader_handoffs%rowtype;
begin
 select * into v from attendance.reader_handoffs h
 where h.id=p_id and h.organization_id=p_org and h.hr_user_id=auth.uid();
 if auth.uid() is null or not found then
  raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if v.expires_at<=clock_timestamp() then
  return jsonb_build_object('status','expired');
 end if;
 return jsonb_build_object('session_id',v.id,'status',v.status,
  'payload',case when v.status='received' then v.encrypted_envelope else null end);
end;$$;
revoke all on function public.attendance_hr_reader_poll(uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_reader_poll(uuid,uuid) to authenticated;

create function public.attendance_hr_reader_finish(p_org uuid,p_id uuid,p_cancel boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 update attendance.reader_handoffs set
 status=case when p_cancel then 'cancelled' else 'consumed' end,
 encrypted_envelope=null,device_sha256=null
 where id=p_id and organization_id=p_org and hr_user_id=auth.uid()
   and status in ('waiting','paired','reading','received')
 returning status into v_status;
 if not found then raise exception using errcode='42501',message='reader_session_missing';end if;
 return jsonb_build_object('status',v_status);
end;$$;
revoke all on function public.attendance_hr_reader_finish(uuid,uuid,boolean) from public,anon;
grant execute on function public.attendance_hr_reader_finish(uuid,uuid,boolean) to authenticated;

-- Service-only device operations: high-entropy one-time pairing capability,
-- no Android HR login required. A device is activated by the tenant HR session.
create function public.attendance_reader_device_claim(
 p_code_hash text,p_device_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.reader_handoffs%rowtype;
begin
 if p_code_hash !~ '^[0-9a-f]{64}$' or p_device_hash !~ '^[0-9a-f]{64}$'
 then raise exception using errcode='22023',message='reader_invalid_capability';end if;
 update attendance.reader_handoffs set status='paired',device_sha256=p_device_hash
 where pairing_sha256=p_code_hash and status='waiting'
   and expires_at>clock_timestamp()
 returning * into v;
 if not found then raise exception using errcode='42501',message='reader_pairing_denied';end if;
 return jsonb_build_object('session_id',v.id,'public_key_spki',v.public_key_spki,
  'status','paired','expires_at',v.expires_at);
end;$$;
revoke all on function public.attendance_reader_device_claim(text,text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_claim(text,text) to service_role;

create function public.attendance_reader_device_progress(
 p_id uuid,p_device_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 update attendance.reader_handoffs set status='reading'
 where id=p_id and device_sha256=p_device_hash
 and status in('paired','reading') and expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 return jsonb_build_object('status','reading');
end;$$;
revoke all on function public.attendance_reader_device_progress(uuid,text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_progress(uuid,text) to service_role;

create function public.attendance_reader_device_publish(
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
 update attendance.reader_handoffs set status='received',
  encrypted_envelope=p_envelope,received_at=clock_timestamp()
 where id=p_id and device_sha256=p_device_hash and status='reading'
   and expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='reader_device_denied';end if;
 return jsonb_build_object('status','received');
end;$$;
revoke all on function public.attendance_reader_device_publish(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_publish(uuid,text,jsonb) to service_role;

-- Must be scheduled with approved expiry maintenance, otherwise do not enable in Production.
create function public.attendance_reader_cleanup() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from attendance.reader_handoffs where expires_at<clock_timestamp()-interval '1 hour';
 get diagnostics n=row_count;return n;
end;$$;
revoke all on function public.attendance_reader_cleanup() from public,anon,authenticated;
grant execute on function public.attendance_reader_cleanup() to service_role;
