-- Security acceptance: synthetic manager and public function grants. Disposable Postgres ONLY.
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000005');
insert into attendance.org_memberships(organization_id,auth_user_id,role)
 values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','manager');
-- All privileged HR data is org-wide until branch membership has been modeled.
-- A manager must be denied org-wide access, even to a branch's site registry.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
do $$
begin
  begin
    perform public.attendance_pending_leaves('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: manager accessed org-wide pending leaves';
  exception when insufficient_privilege then null; end;
  begin
    perform public.attendance_review_leave('20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001','approved',null);
    raise exception 'FAILED: manager reviewed leave without site boundaries';
  exception when insufficient_privilege then null; end;
  begin
    perform public.attendance_list_sites('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: manager viewed all sites';
  exception when insufficient_privilege then null; end;
  begin
    perform public.attendance_issue_qr('20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: manager issued site QR without branch assignment';
  exception when insufficient_privilege then null; end;
  begin
    perform public.attendance_hr_list_events('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: manager accessed org-wide time events';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
-- PUBLIC includes anonymous inheritors. Check grants and SECURITY DEFINER search_path.
do $$
declare x record; v_public boolean; v_anon boolean; v_auth boolean;
begin
  for x in
    select p.oid,p.proname,p.prosecdef,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'attendance_%'
  loop
    v_public:=has_function_privilege('public',x.oid,'EXECUTE');
    v_anon:=has_function_privilege('anon',x.oid,'EXECUTE');
    if v_public or v_anon then
       raise exception 'FAILED: anonymous execution for %',x.proname;
    end if;
    if not x.prosecdef or not (coalesce(x.proconfig,ARRAY[]::text[]) @> ARRAY['search_path=']) then
       raise exception 'FAILED: RPC without definer fixed search_path %',x.proname;
    end if;
    v_auth:=has_function_privilege('authenticated',x.oid,'EXECUTE');
    if x.proname='attendance_allow_login' and v_auth then
      raise exception 'FAILED: employee may invoke server-only login rate limiter';
    end if;
  end loop;
  raise notice 'PASS: manager org-wide access denied; public RPC grants and search_path validated';
end; $$;
