set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select set_config('test.leave_id',public.attendance_request_leave(
'20000000-0000-4000-8000-000000000001','personal_leave',
date '2026-10-28',date '2026-10-29','Personal matter')->>'id',false);
do $$
begin
  begin
    perform public.attendance_request_leave(
      '20000000-0000-4000-8000-000000000001','personal_leave',
      date '2026-10-29',date '2026-10-30','Overlap');
    raise exception 'FAILED: overlapping leave allowed';
  exception when unique_violation then null;
  end;
  begin
    perform public.attendance_review_leave(
      '20000000-0000-4000-8000-000000000001',
      current_setting('test.leave_id')::uuid,'approved',null);
    raise exception 'FAILED: employee approved leave';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$
begin
  begin
    perform public.attendance_review_leave(
      '20000000-0000-4000-8000-000000000001',
      current_setting('test.leave_id')::uuid,'approved',null);
    raise exception 'FAILED: HR B approved HR A leave';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare v jsonb;
begin
  v:=public.attendance_review_leave(
    '20000000-0000-4000-8000-000000000001',
    current_setting('test.leave_id')::uuid,'approved','Reviewed by HR A');
  if v->>'status'<>'approved' then raise exception 'FAILED: HR A could not approve';end if;
  begin
    perform public.attendance_review_leave(
      '20000000-0000-4000-8000-000000000001',
      current_setting('test.leave_id')::uuid,'approved','again');
    raise exception 'FAILED: double leave approval';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
declare v jsonb;
begin
  v:=public.attendance_my_leave_requests('20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(v)<>1 or v->0->>'status'<>'approved' then
    raise exception 'FAILED: self leave state %',v;
  end if;
  begin
    perform public.attendance_my_leave_requests('20000000-0000-4000-8000-000000000002');
    raise exception 'FAILED: cross tenant leave list';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from attendance.leave_requests)<>1 then
    raise exception 'FAILED: leave duplicate created';
  end if;
  raise notice 'PASS: leave submit, overlap, tenant restriction, approval and history';
end;
$$;
