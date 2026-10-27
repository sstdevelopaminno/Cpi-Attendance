set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare v jsonb;
begin
  v:=public.attendance_list_sites('20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(v)<>1 or v->0->>'code'<>'HQ' then
    raise exception 'FAILED: org A HR should see only their HQ: %',v;
  end if;
  begin
    perform public.attendance_list_sites('20000000-0000-4000-8000-000000000002');
    raise exception 'FAILED: org A HR saw org B';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
begin
  begin
    perform public.attendance_list_sites('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: employee read HR site registry';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
