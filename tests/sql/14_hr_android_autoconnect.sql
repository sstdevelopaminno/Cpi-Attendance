-- Disposable PostgreSQL: all identifiers/data synthetic.
insert into attendance.subscriptions(organization_id,package_code,subscription_kind,status,max_employees,max_android_devices,starts_at,expires_at)
values('20000000-0000-4000-8000-000000000001','HR_TEST','internal_test','active',25,1,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '7 days');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.attendance_hr_reader_start('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000006',repeat('b',64),repeat('A',400));
do $$declare x jsonb;begin
 x:=public.attendance_reader_device_enroll(
  '20000000-0000-4000-8000-000000000001',repeat('c',64),null);
 if x->>'enrolled'<>'true'
    or x->>'organization_id'<>'20000000-0000-4000-8000-000000000001'
    or x->>'hr_user_id'<>'10000000-0000-4000-8000-000000000001'
    or (x->>'device_id')::uuid is null
 then raise exception 'FAILED authenticated tenant + HR device receipt';end if;
end;$$;
reset role;
set role service_role;
do $$ declare x jsonb; begin
 x:=public.attendance_reader_device_next(repeat('c',64));
 if x->>'session_id'<>'60000000-0000-4000-8000-000000000006'
 then raise exception 'FAILED registered device online';end if;
 begin
  perform public.attendance_reader_device_next(repeat('d',64));
  raise exception 'FAILED unknown device connected';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.attendance_hr_reader_finish('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000006',true);
select public.attendance_hr_reader_start('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000007',repeat('e',64),repeat('B',400));
reset role;
set role service_role;
do $$ declare x jsonb;begin
 x:=public.attendance_reader_device_next(repeat('c',64));
 if x->>'session_id'<>'60000000-0000-4000-8000-000000000007'
 then raise exception 'FAILED auto-claim on subsequent HR request';end if;
 perform public.attendance_reader_device_progress('60000000-0000-4000-8000-000000000007',repeat('c',64));
 perform public.attendance_reader_device_publish('60000000-0000-4000-8000-000000000007',
 repeat('c',64),jsonb_build_object('wrapped_key',repeat('Q',360),'iv',repeat('T',24),'ciphertext',repeat('Z',60)));
end;$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$declare r jsonb;v_app uuid;begin
 perform public.attendance_hr_reader_finish('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000007',false);
 r:=public.attendance_hr_submit_application('20000000-0000-4000-8000-000000000001',
 'Synthetic Test Applicant','hr_manual','auto-device-ack-0001',true);
 v_app:=(r->>'id')::uuid;
 perform public.attendance_hr_reader_saved('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000007',v_app);
end;$$;
reset role;
set role service_role;
do $$declare x jsonb;begin
 x:=public.attendance_reader_device_status('60000000-0000-4000-8000-000000000007',repeat('c',64));
 if x->>'status'<>'saved' then raise exception 'FAILED HR-save confirmation';end if;
end;$$;
-- Two HR users in the SAME tenant must not share their Android request stream.
-- Changing the active HR rotates the device token and invalidates the old one.
reset role;
update attendance.org_memberships set role='hr_admin'
 where organization_id='20000000-0000-4000-8000-000000000001'
 and auth_user_id='10000000-0000-4000-8000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.attendance_hr_reader_start('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000008',repeat('f',64),repeat('E',400));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.attendance_hr_reader_start('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000009',repeat('1',64),repeat('F',400));
reset role;
set role service_role;
do $$declare x jsonb;begin
 x:=public.attendance_reader_device_next(repeat('c',64));
 if x->>'session_id'<>'60000000-0000-4000-8000-000000000008'
 then raise exception 'FAILED: HR1 device claimed another HR user session';end if;
end;$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$declare x jsonb;begin
 x:=public.attendance_reader_device_enroll(
  '20000000-0000-4000-8000-000000000001',repeat('d',64),repeat('c',64));
 if x->>'enrolled'<>'true'
    or x->>'organization_id'<>'20000000-0000-4000-8000-000000000001'
    or x->>'hr_user_id'<>'10000000-0000-4000-8000-000000000002'
 then raise exception 'FAILED device rebind to second HR';end if;
end;$$;
reset role;
set role service_role;
do $$declare x jsonb;begin
 begin
  perform public.attendance_reader_device_next(repeat('c',64));
  raise exception 'FAILED rotated device capability still accepted';
 exception when insufficient_privilege then null;end;
 x:=public.attendance_reader_device_next(repeat('d',64));
 if x->>'session_id'<>'60000000-0000-4000-8000-000000000009'
 then raise exception 'FAILED: HR2 did not receive own session';end if;
end;$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_reader_device_enroll(
   '20000000-0000-4000-8000-000000000001',repeat('e',64),repeat('d',64));
  raise exception 'FAILED cross-organization device hijack';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$declare v_id uuid;begin
 select (x->>'id')::uuid into v_id from jsonb_array_elements(
 public.attendance_hr_reader_devices('20000000-0000-4000-8000-000000000001')) x
 where x->>'status'='active' limit 1;
 perform public.attendance_hr_reader_revoke('20000000-0000-4000-8000-000000000001',v_id);
end;$$;
reset role;
set role service_role;
do $$begin
 begin
  perform public.attendance_reader_device_next(repeat('c',64));
  raise exception 'FAILED revoked device connected';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;

-- Enrollment and HR switching must be attributable to exact actors, without
-- recording device capabilities (or card data) in tenant audit entries.
do $$begin
 if (select count(*) from attendance.audit_entries
     where organization_id='20000000-0000-4000-8000-000000000001'
       and action_code='reader_device_enrolled'
       and actor_user_id='10000000-0000-4000-8000-000000000001')<>1
 then raise exception 'FAILED first HR enrollment audit';end if;
 if (select count(*) from attendance.audit_entries
     where organization_id='20000000-0000-4000-8000-000000000001'
       and action_code='reader_device_rebound'
       and actor_user_id='10000000-0000-4000-8000-000000000002'
       and details->>'previous_hr_user_id'='10000000-0000-4000-8000-000000000001')<>1
 then raise exception 'FAILED second HR device switch audit';end if;
 if exists(select 1 from attendance.audit_entries
   where organization_id='20000000-0000-4000-8000-000000000001'
   and action_code in ('reader_device_enrolled','reader_device_rebound')
   and (details::text ilike '%ciphertext%'
    or details::text ilike '%device_secret%'
    or details::text ilike '%access_token%'))
 then raise exception 'FAILED secret present in reader audit';end if;
end;$$;

-- Public health must only advertise v0.7 after this migration exists.
-- This probe has no tenant data and is available only to service-role calls.
set role anon;
do $$begin
 begin
   perform public.attendance_reader_protocol_version();
   raise exception 'FAILED anonymous reader protocol visibility';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
set role authenticated;
do $$begin
 begin
   perform public.attendance_reader_protocol_version();
   raise exception 'FAILED authenticated reader protocol visibility';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
set role service_role;
do $$begin
 if public.attendance_reader_protocol_version()<>'v1'
 then raise exception 'FAILED reader protocol v1 readiness';end if;
end;$$;
reset role;
