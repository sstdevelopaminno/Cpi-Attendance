set role service_role;
do $$
declare v_fp text:=repeat('a',64); i integer;
begin
  for i in 1..8 loop
    if not public.attendance_allow_login(v_fp) then
      raise exception 'FAILED: allowed login returned false';
    end if;
  end loop;
  begin
    perform public.attendance_allow_login(v_fp);
    raise exception 'FAILED: ninth attempt was not rate limited';
  exception when raise_exception then
    if sqlerrm <> 'attendance_login_rate_limited' then raise; end if;
  end;
end;
$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
declare v jsonb;
begin
  v:=public.attendance_login_context('COMP_A');
  if v->>'role'<>'employee' or v->>'employee_code'<>'E001' then
    raise exception 'FAILED: wrong context: %',v;
  end if;
  begin
    perform public.attendance_login_context('COMP_B');
    raise exception 'FAILED: cross-organization context disclosed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from attendance.login_rate_limits where attempts=8)<>1 then
    raise exception 'FAILED: login limiter persisted count mismatch';
  end if;
  raise notice 'PASS: login rate limit and organization-scoped identity';
end;
$$;
