-- Run after tests/sql/06_hr_recruitment.sql. Tests of role-guarded schedule and HR events.
insert into attendance.shift_templates
 (id,organization_id,code,label,starts_at_local,ends_at_local)
 values ('60000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001','DAY','Day shift','09:00','18:00');
insert into attendance.shift_assignments
 (organization_id,employee_id,shift_template_id,site_id,scheduled_start_at,scheduled_end_at)
 values ('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 9 hours');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
declare v jsonb;
begin
 v:=public.attendance_my_shifts('20000000-0000-4000-8000-000000000001',30);
 if jsonb_array_length(v)<>1 or v->0->>'shift_label'<>'Day shift' then
   raise exception 'FAILED self shifts missing: %',v;
 end if;
 begin
   perform public.attendance_hr_list_events('20000000-0000-4000-8000-000000000001');
   raise exception 'FAILED employee accessed org-wide attendance events';
 exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$
begin
  begin
    perform public.attendance_my_shifts('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED employee B read org A shifts';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare v jsonb;
begin
 v:=public.attendance_hr_list_events('20000000-0000-4000-8000-000000000001',75);
 if jsonb_array_length(v)<>2 then raise exception 'FAILED HR A event list: %',v; end if;
 begin
   perform public.attendance_hr_list_events('20000000-0000-4000-8000-000000000002');
   raise exception 'FAILED HR A accessed org B time data';
 exception when insufficient_privilege then null; end;
 begin
   perform public.attendance_my_shifts('20000000-0000-4000-8000-000000000001');
   raise exception 'FAILED non-employee HR read employee shifts';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
