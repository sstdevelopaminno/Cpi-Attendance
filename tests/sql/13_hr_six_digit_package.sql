-- Disposable test verifies package gates, tenant aliases and role isolation.
insert into attendance.organizations(code,legal_name,status)
 values('654321','Synthetic Package Tenant','active');
insert into attendance.subscriptions(organization_id,package_code,subscription_kind,status,
 max_employees,max_android_devices,starts_at,expires_at,activated_at)
 select id,'HR_TEST','internal_test','active',25,2,
 clock_timestamp()-interval '1 minute',clock_timestamp()+interval '7 days',clock_timestamp()
 from attendance.organizations where code='654321';
insert into attendance.org_memberships(organization_id,auth_user_id,role,status)
 select id,'10000000-0000-4000-8000-000000000001','owner','active'
 from attendance.organizations where code='654321';
insert into attendance.hr_login_aliases(organization_id,login_code,auth_user_id)
 select id,'HR0001','10000000-0000-4000-8000-000000000001'
 from attendance.organizations where code='654321';

set role service_role;
do $$ declare x jsonb;begin
 x:=public.attendance_hr_resolve_login('654321','HR0001');
 if x->>'auth_user_id'<>'10000000-0000-4000-8000-000000000001'
 then raise exception 'FAILED active six digit alias';end if;
 if public.attendance_hr_resolve_login('654321','HR9999') is not null
 then raise exception 'FAILED unknown alias';end if;
 if public.attendance_hr_resolve_login('COMP_A','HR0001') is not null
 then raise exception 'FAILED legacy organization code accepted';end if;
end;$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ declare x jsonb;begin
 x:=public.attendance_login_context('654321');
 if x->>'role'<>'owner' or x->>'package_code'<>'HR_TEST'
 then raise exception 'FAILED package context';end if;
end;$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin
  perform public.attendance_login_context('654321');
  raise exception 'FAILED cross tenant user access';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
update attendance.subscriptions set status='suspended'
where organization_id=(select id from attendance.organizations where code='654321');
set role service_role;
do $$begin
 if public.attendance_hr_resolve_login('654321','HR0001') is not null
 then raise exception 'FAILED subscription suspension alias access';end if;
end;$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$begin
 begin
  perform public.attendance_login_context('654321');
  raise exception 'FAILED suspended package HR login';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
