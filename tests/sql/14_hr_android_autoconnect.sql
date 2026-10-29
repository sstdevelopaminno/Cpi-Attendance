-- Disposable PostgreSQL: all identifiers/data synthetic.
insert into attendance.subscriptions(organization_id,package_code,subscription_kind,status,max_employees,max_android_devices,starts_at,expires_at)
values('20000000-0000-4000-8000-000000000001','HR_TEST','internal_test','active',25,1,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '7 days');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.attendance_hr_reader_start('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000006',repeat('b',64),repeat('A',400));
reset role;
set role service_role;
do $$ declare x jsonb; begin
 x:=public.attendance_reader_device_claim(repeat('b',64),repeat('c',64));
 if x->>'status'<>'paired' then raise exception 'FAILED device enrollment';end if;
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
