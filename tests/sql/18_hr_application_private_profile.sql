-- Synthetic only. Full applicant record/photo retention and HR tenant isolation.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare v jsonb;id uuid;profile jsonb;
begin
 v:=public.attendance_hr_submit_application_full(
  '20000000-0000-4000-8000-000000000001','Synthetic Private Applicant',
  'hr_manual','private-profile-acceptance-20261030',true,
  '{"english_name":"Example","national_id":"1234567890123","position":"Engineer"}'::jsonb,
  'image/jpeg','/9j/2Q==');
 id:=(v->>'id')::uuid;
 perform set_config('test.hr_profile_application',id::text,false);
 profile:=public.attendance_hr_get_application_profile(
  '20000000-0000-4000-8000-000000000001',id);
 if profile->'fields'->>'position'<>'Engineer'
  or profile->'photo'->>'base64'<>'/9j/2Q=='
 then raise exception 'FAILED private photo/profile persistence';end if;
 if (select coalesce(jsonb_agg(x),'[]'::jsonb)::text
     from jsonb_array_elements(public.attendance_hr_list_applications(
      '20000000-0000-4000-8000-000000000001')) x)
   like '%1234567890123%'
 then raise exception 'FAILED card number leaked in application list';end if;
 perform public.attendance_hr_update_application_full(
  '20000000-0000-4000-8000-000000000001',id,'Updated Private Applicant',
  '{"english_name":"Revised","position":"HR"}'::jsonb,null,null);
 profile:=public.attendance_hr_get_application_profile(
  '20000000-0000-4000-8000-000000000001',id);
 if profile->'fields'->>'position'<>'HR'
  or profile->'photo'->>'base64'<>'/9j/2Q=='
 then raise exception 'FAILED update / photo retention';end if;
 begin
  perform public.attendance_hr_store_application_profile(
   '20000000-0000-4000-8000-000000000001',id,
   '{"unexpected_key":"secret"}'::jsonb,null,null);
  raise exception 'FAILED arbitrary profile key persisted';
 exception when invalid_parameter_value then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_hr_get_application_profile(
   '20000000-0000-4000-8000-000000000001',
   current_setting('test.hr_profile_application')::uuid);
  raise exception 'FAILED tenant-private profile access';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$begin
 if has_table_privilege('authenticated','attendance.application_private_profiles','select')
 or has_table_privilege('anon','attendance.application_private_profiles','select')
 then raise exception 'FAILED raw private profile select grant';end if;
 if not exists(select 1 from attendance.audit_entries where action_code='application_private_updated')
 then raise exception 'FAILED private profile audit';end if;
end;$$;