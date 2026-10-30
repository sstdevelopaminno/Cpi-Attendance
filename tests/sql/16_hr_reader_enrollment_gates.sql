-- Disposable PostgreSQL only: regression gates before shipping Android HR v0.7.
-- Synthetic organization and capabilities; never run against Production.
do $$
declare v_count int;
begin
 select count(*) into v_count from attendance.reader_devices
 where organization_id='20000000-0000-4000-8000-000000000001'
   and status='active';
 if v_count<>0 then raise exception 'FAILED: prior synthetic reader still active';end if;
end;$$;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$declare r jsonb;begin
 r:=public.attendance_reader_device_enroll(
 '20000000-0000-4000-8000-000000000001',repeat('7',64),null);
 if r->>'enrolled'<>'true' or r->>'hr_user_id'<>'10000000-0000-4000-8000-000000000001'
  or r->>'organization_id'<>'20000000-0000-4000-8000-000000000001'
 then raise exception 'FAILED: newly enrolled reader identity';end if;
 begin
  perform public.attendance_reader_device_enroll(
   '20000000-0000-4000-8000-000000000001',repeat('8',64),null);
  raise exception 'FAILED: reader limit bypassed';
 exception when insufficient_privilege then
  if sqlerrm<>'reader_device_limit' then raise;end if;
 end;
 begin
  perform public.attendance_reader_device_enroll(
   '20000000-0000-4000-8000-000000000001',repeat('9',64),repeat('f',64));
  raise exception 'FAILED: unknown previous reader accepted';
 exception when insufficient_privilege then
  if sqlerrm<>'reader_device_denied' then raise;end if;
 end;
end;$$;
reset role;

-- Create one legitimate HR request and bind the reader before suspension,
-- so the subsequent status denial is tested against a real session.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.attendance_hr_reader_start(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000016',repeat('fedcba9876543210',4),repeat('Z',400));
reset role;
set role service_role;
do $declare result jsonb;begin
 result:=public.attendance_reader_device_next(repeat('7',64));
 if result->>'session_id'<>'60000000-0000-4000-8000-000000000016'
 then raise exception 'FAILED real reader session binding';end if;
end;$;
reset role;

-- Expired/inactive subscription blocks device login, even with the old capability.
update attendance.subscriptions set status='suspended'
where organization_id='20000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$begin
 begin
  perform public.attendance_reader_device_enroll(
   '20000000-0000-4000-8000-000000000001',repeat('8',64),repeat('7',64));
  raise exception 'FAILED: inactive subscription re-enrolled device';
 exception when insufficient_privilege then
  if sqlerrm<>'reader_package_inactive' then raise;end if;
 end;
end;$$;
reset role;

-- Status read must not bypass suspended package entitlement.
set role service_role;
do $begin
 begin
  perform public.attendance_reader_device_status(
   '60000000-0000-4000-8000-000000000016',repeat('7',64));
  raise exception 'FAILED suspended package leaked reader status';
 exception when insufficient_privilege then
  if sqlerrm<>'reader_device_denied' then raise;end if;
 end;
end;$;
reset role;

-- Revoking membership must block previously enrolled device polling.
update attendance.subscriptions set status='active'
where organization_id='20000000-0000-4000-8000-000000000001';
update attendance.org_memberships set status='disabled'
where organization_id='20000000-0000-4000-8000-000000000001'
 and auth_user_id='10000000-0000-4000-8000-000000000001';
set role service_role;
do $$begin
 begin
  perform public.attendance_reader_device_next(repeat('7',64));
  raise exception 'FAILED: disabled HR membership still polling';
 exception when insufficient_privilege then
  if sqlerrm<>'reader_device_denied' then raise;end if;
 end;
end;$$;
reset role;

-- Same status endpoint must also deny after HR membership is disabled.
set role service_role;
do $$begin
 begin
  perform public.attendance_reader_device_status(
   '60000000-0000-4000-8000-000000000016',repeat('7',64));
  raise exception 'FAILED disabled HR leaked reader status';
 exception when insufficient_privilege then
  if sqlerrm<>'reader_device_denied' then raise;end if;
 end;
end;$$;
reset role;
