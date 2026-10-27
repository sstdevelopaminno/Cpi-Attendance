set role authenticated;
-- Approved first request already processed by test 04.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select set_config('test.second_leave_id',public.attendance_request_leave(
  '20000000-0000-4000-8000-000000000001','sick_leave',
  date '2026-11-01',date '2026-11-01',null)->>'id',false);
do $$
begin
  begin
    perform public.attendance_pending_leaves('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: employee used HR pending queue';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$
begin
  begin
    perform public.attendance_pending_leaves('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: HR B accessed HR A pending queue';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare v jsonb;
begin
  v:=public.attendance_pending_leaves('20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(v)<>1 or v->0->>'leave_type'<>'sick_leave' then
    raise exception 'FAILED: HR A did not see right pending leave: %',v;
  end if;
end;
$$;
reset role;
