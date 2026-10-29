-- Draft HR aggregate: count only verified rows for the authorized organization.
-- No payroll figures until finance ledger/OT policy is approved.
create or replace function public.attendance_hr_dashboard(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_today date;
  v_month_start date;
  v_timezone text;
  v_total bigint;
  v_new bigint;
  v_on_leave bigint;
  v_series jsonb;
begin
  select o.timezone into v_timezone
  from attendance.org_memberships m join attendance.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
    and m.status='active' and m.role in ('owner','hr_admin') and o.status='active';
  if auth.uid() is null or v_timezone is null then
    raise exception using errcode='42501',message='attendance_hr_forbidden';
  end if;
  v_today := (clock_timestamp() at time zone v_timezone)::date;
  v_month_start := date_trunc('month',v_today::timestamp)::date;
  select count(*) into v_total from attendance.employees e
    where e.organization_id=p_organization_id and e.employment_status='active';
  select count(*) into v_new from attendance.employees e
    where e.organization_id=p_organization_id
      and e.created_at >= (v_month_start::timestamp at time zone v_timezone)
      and e.employment_status='active';
  select count(distinct l.employee_id) into v_on_leave
    from attendance.leave_requests l
    join attendance.employees e on e.id=l.employee_id and e.organization_id=l.organization_id
    where l.organization_id=p_organization_id and l.request_status='approved'
      and e.employment_status='active'
      and l.start_date<=v_today and l.end_date>=v_today;
  select coalesce(jsonb_agg(jsonb_build_object(
     'day',d.day,'check_in',coalesce(c.check_in,0),'check_out',coalesce(c.check_out,0))
     order by d.day),'[]'::jsonb)
    into v_series
  from generate_series(v_today-6,v_today,interval '1 day') as d(day)
  left join lateral (
    select count(*) filter (where ev.event_type='check_in') as check_in,
           count(*) filter (where ev.event_type='check_out') as check_out
    from attendance.time_events ev
    where ev.organization_id=p_organization_id
      and (ev.occurred_at at time zone v_timezone)::date = d.day::date
  ) c on true;
  return jsonb_build_object(
    'employees',v_total,'new',v_new,'leave',v_on_leave,
    'absent',null,'late',null,'ot',null,
    'salary',null,'otPaid',null,'advances',null,
    'attendance_series',v_series,
    'timezone',v_timezone,'data_as_of',clock_timestamp());
end;
$$;
revoke all on function public.attendance_hr_dashboard(uuid) from public,anon;
grant execute on function public.attendance_hr_dashboard(uuid) to authenticated;
