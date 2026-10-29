-- Owner-managed HR accounts in a disposable database. Synthetic identities only.
insert into attendance.organizations(id,code,legal_name,status)
values ('20000000-0000-4000-8000-000000000003','876543','Synthetic Multi-HR Co','active');
insert into attendance.subscriptions(organization_id,package_code,subscription_kind,status,
 max_employees,max_android_devices,starts_at,expires_at)
values ('20000000-0000-4000-8000-000000000003','HR_MULTI','internal_test','active',
 20,2,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '7 days');
insert into attendance.org_memberships(organization_id,auth_user_id,role,status)
values ('20000000-0000-4000-8000-000000000003',
 '10000000-0000-4000-8000-000000000001','owner','active');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$declare x jsonb; begin
 x:=public.attendance_hr_invite_member(
 '20000000-0000-4000-8000-000000000003',
 '10000000-0000-4000-8000-000000000002','HR0002','staff-a@example.invalid');
 if x->>'invited'<>'true' then raise exception 'FAILED invite HR2';end if;
 x:=public.attendance_hr_list_members('20000000-0000-4000-8000-000000000003');
 if jsonb_array_length(x)<>1 or x->0->>'hr_code'<>'HR0002'
 then raise exception 'FAILED Owner HR listing';end if;
 begin
 perform public.attendance_hr_invite_member(
 '20000000-0000-4000-8000-000000000003',
 '10000000-0000-4000-8000-000000000003','HR0003','wrong@example.invalid');
 raise exception 'FAILED email mismatch accepted';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$begin
 begin
  perform public.attendance_hr_assert_owner('20000000-0000-4000-8000-000000000003');
  raise exception 'FAILED HR admin gained Owner permission';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_hr_list_members('20000000-0000-4000-8000-000000000003');
  raise exception 'FAILED cross-tenant user listed HR accounts';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$declare x jsonb;begin
 x:=public.attendance_hr_disable_member(
 '20000000-0000-4000-8000-000000000003','HR0002');
 if x->>'disabled'<>'true' then raise exception 'FAILED HR disable';end if;
 if exists(select 1 from attendance.org_memberships m
  where m.organization_id='20000000-0000-4000-8000-000000000003'
  and m.auth_user_id='10000000-0000-4000-8000-000000000002' and m.status='active')
 then raise exception 'FAILED HR session revocation';end if;
end;$$;
reset role;
