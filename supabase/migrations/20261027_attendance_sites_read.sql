-- HR may read their own active sites, but never through direct access to private tables.
create or replace function public.attendance_list_sites(p_organization_id uuid)
returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from attendance.org_memberships m
    join attendance.organizations o on o.id=m.organization_id
    where m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
      and m.status='active' and o.status='active'
      and m.role in ('owner','hr_admin')
  ) then
    raise exception using errcode='42501',message='attendance_sites_forbidden';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'code',s.site_code,'name',s.name,'geofence_enabled',s.geofence_enabled)
    order by s.name),'[]'::jsonb)
  into v_result
  from attendance.sites s
  where s.organization_id=p_organization_id and s.is_active;
  return v_result;
end;
$$;
revoke all on function public.attendance_list_sites(uuid) from public,anon;
grant execute on function public.attendance_list_sites(uuid) to authenticated;
