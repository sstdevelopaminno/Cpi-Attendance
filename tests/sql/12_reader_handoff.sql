-- Encrypted handoff security, synthetic payload only. Disposable CI database.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$begin
 begin
  perform public.attendance_hr_reader_start(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   repeat('a',64),repeat('A',400));
  raise exception 'FAILED employee created HR reader session';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$declare v jsonb;begin
 v:=public.attendance_hr_reader_start(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  repeat('a',64),repeat('A',400));
 if v->>'status'<>'waiting' then raise exception 'FAILED HR pairing creation';end if;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_hr_reader_poll(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001');
  raise exception 'FAILED cross-tenant HR read pairing';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
set role service_role;
do $$declare v jsonb;begin
 begin
  perform public.attendance_reader_device_claim(repeat('b',64),repeat('e',64));
  raise exception 'FAILED wrong pairing code accepted';
 exception when insufficient_privilege then null;end;
 v:=public.attendance_reader_device_claim(repeat('a',64),repeat('c',64));
 if v->>'status'<>'paired' then raise exception 'FAILED device claim';end if;
 begin
  perform public.attendance_reader_device_claim(repeat('a',64),repeat('c',64));
  raise exception 'FAILED replay pairing accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.attendance_reader_device_progress(
   '60000000-0000-4000-8000-000000000001',repeat('d',64));
  raise exception 'FAILED device secret mismatch';
 exception when insufficient_privilege then null;end;
 perform public.attendance_reader_device_progress(
   '60000000-0000-4000-8000-000000000001',repeat('c',64));
 v:=public.attendance_reader_device_publish(
  '60000000-0000-4000-8000-000000000001',repeat('c',64),
  jsonb_build_object('wrapped_key',repeat('Q',360),'iv',repeat('T',24),'ciphertext',repeat('Z',60)));
 if v->>'status'<>'received' then raise exception 'FAILED encrypted publish';end if;
 begin
  perform public.attendance_reader_device_publish(
   '60000000-0000-4000-8000-000000000001',repeat('c',64),
   jsonb_build_object('wrapped_key',repeat('Q',360),'iv',repeat('T',24),'ciphertext',repeat('Z',60)));
  raise exception 'FAILED duplicate submission';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$declare v jsonb;begin
 v:=public.attendance_hr_reader_poll(
   '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 if v->>'status'<>'received' or (v->'payload'->>'ciphertext') is null
 then raise exception 'FAILED HR cannot view encrypted envelope';end if;
 perform public.attendance_hr_reader_finish(
   '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',false);
 v:=public.attendance_hr_reader_poll(
   '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 if v->>'status'<>'consumed' or v->'payload'<>'null'::jsonb
 then raise exception 'FAILED ciphertext not erased after consumption';end if;
end;$$;
reset role;
do $$begin
 if exists(select 1 from attendance.reader_handoffs where encrypted_envelope is not null)
 then raise exception 'FAILED stale encrypted data';end if;
 raise notice 'PASS encrypted reader handoff, tenant isolation and replay protections';
end;$$;
