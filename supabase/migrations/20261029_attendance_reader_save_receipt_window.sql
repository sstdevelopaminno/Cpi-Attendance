create or replace function public.attendance_reader_device_status(p_id uuid,p_device_hash text)
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
   case when v.status='saved' then 'saved' when v.expires_at<clock_timestamp() then 'expired' else v.status end);
end;$$;
revoke all on function public.attendance_reader_device_status(uuid,text) from public,anon,authenticated;
grant execute on function public.attendance_reader_device_status(uuid,text) to service_role;


create or replace function public.attendance_hr_reader_saved(p_org uuid,p_id uuid,p_application uuid)
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
  and status='consumed' and expires_at+interval '1 hour'>clock_timestamp();
 if not found then raise exception using errcode='42501',message='reader_session_missing';end if;
 return jsonb_build_object('status','saved');
end;$$;
revoke all on function public.attendance_hr_reader_saved(uuid,uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_reader_saved(uuid,uuid,uuid) to authenticated;

