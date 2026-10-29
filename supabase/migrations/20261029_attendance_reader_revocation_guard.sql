-- Reject later chip events from revoked Android readers or suspended subscriptions.
create or replace function public.attendance_reader_device_progress(p_id uuid,p_device_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists (
  select 1 from attendance.reader_handoffs h
  join attendance.reader_devices d on d.organization_id=h.organization_id
   and d.secret_sha256=p_device_hash and d.status='active'
  join attendance.subscriptions s on s.organization_id=h.organization_id
   and s.status='active' and s.expires_at>clock_timestamp()
   and s.starts_at<=clock_timestamp() and 'android_hr'=any(s.enabled_modules)
  where h.id=p_id and h.device_sha256=p_device_hash and h.status in ('paired','reading')
   and h.expires_at>clock_timestamp()
 ) then raise exception using errcode='42501',message='reader_device_denied';end if;
 update attendance.reader_handoffs set status='reading'
 where id=p_id and device_sha256=p_device_hash
 and status in ('paired','reading') and expires_at>clock_timestamp();
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
