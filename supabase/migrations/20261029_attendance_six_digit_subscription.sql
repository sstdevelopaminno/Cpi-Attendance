-- 2026-10-29: IT commercial package control only; customer Owner/HR controls HR operations.
-- All new tenants get random six-digit code; this migration does not weaken RLS.
create table attendance.subscriptions (
 organization_id uuid primary key references attendance.organizations(id) on delete restrict,
 package_code text not null check (package_code ~ '^[A-Z0-9_]{3,40}$'),
 subscription_kind text not null check (subscription_kind in ('internal_test','trial','paid')),
 status text not null check (status in ('pending','active','suspended','expired','cancelled')),
 max_employees integer not null check (max_employees between 1 and 100000),
 max_android_devices integer not null check (max_android_devices between 0 and 10000),
 enabled_modules text[] not null default array['hr_web','android_hr']::text[],
 starts_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 activated_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 check (expires_at>starts_at)
);
alter table attendance.subscriptions enable row level security;
revoke all on attendance.subscriptions from public,anon,authenticated;

-- HR credential alias (not an Auth secret). The login identifier is *not* a password.
create table attendance.hr_login_aliases (
 organization_id uuid not null references attendance.organizations(id) on delete restrict,
 login_code text not null check (login_code ~ '^[A-Z0-9]{6}$'),
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 is_enabled boolean not null default true,
 created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,login_code),
 unique(organization_id,auth_user_id)
);
alter table attendance.hr_login_aliases enable row level security;
revoke all on attendance.hr_login_aliases from public,anon,authenticated;

-- Service-only lookups: browser does not see users' private emails.
create or replace function public.attendance_hr_resolve_login(p_organization_code text,p_login_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid;
begin
 if p_organization_code !~ '^[0-9]{6}$' or p_login_code !~ '^[A-Z0-9]{6}$'
 then return null; end if;
 select a.auth_user_id into v_user
 from attendance.hr_login_aliases a
 join attendance.organizations o on o.id=a.organization_id
 join attendance.org_memberships m on m.organization_id=o.id and m.auth_user_id=a.auth_user_id
 join attendance.subscriptions s on s.organization_id=o.id
 where o.code=p_organization_code and o.status='active'
   and a.login_code=p_login_code and a.is_enabled
   and m.role in ('owner','hr_admin') and m.status='active'
   and s.status='active' and s.starts_at<=clock_timestamp() and s.expires_at>clock_timestamp();
 if v_user is null then return null;end if;
 return jsonb_build_object('auth_user_id',v_user);
end;$$;
revoke all on function public.attendance_hr_resolve_login(text,text) from public,anon,authenticated;
grant execute on function public.attendance_hr_resolve_login(text,text) to service_role;

create or replace function public.attendance_hr_package_valid(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from attendance.subscriptions s
  join attendance.organizations o on o.id=s.organization_id
  where s.organization_id=p_organization_id and o.status='active'
   and s.status='active' and s.starts_at<=clock_timestamp()
   and s.expires_at>clock_timestamp()
 );
$$;
revoke all on function public.attendance_hr_package_valid(uuid) from public,anon,authenticated;
grant execute on function public.attendance_hr_package_valid(uuid) to service_role;

create or replace function public.attendance_login_context(p_organization_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_org attendance.organizations%rowtype;
 v_membership attendance.org_memberships%rowtype;
 v_employee attendance.employees%rowtype;
 v_package attendance.subscriptions%rowtype;
begin
 if v_actor is null or p_organization_code !~ '^[0-9]{6}$'
 then raise exception using errcode='42501',message='attendance_login_required';end if;
 select * into v_org from attendance.organizations
 where code=p_organization_code and status='active';
 if not found then raise exception using errcode='42501',message='attendance_org_forbidden';end if;
 select * into v_package from attendance.subscriptions
 where organization_id=v_org.id and status='active'
   and starts_at<=clock_timestamp() and expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='attendance_package_inactive';end if;
 select * into v_membership from attendance.org_memberships m
 where m.organization_id=v_org.id and m.auth_user_id=v_actor and m.status='active';
 if not found then raise exception using errcode='42501',message='attendance_org_forbidden';end if;
 select * into v_employee from attendance.employees e
 where e.organization_id=v_org.id and e.auth_user_id=v_actor
   and e.employment_status='active';
 return jsonb_build_object(
  'organization_id',v_org.id,'organization_code',v_org.code,
  'organization_name',v_org.legal_name,
  'role',v_membership.role,
  'employee_id',v_employee.id,'employee_code',v_employee.employee_code,
  'full_name',v_employee.full_name,
  'package_code',v_package.package_code,
  'subscription_kind',v_package.subscription_kind,
  'package_expires_at',v_package.expires_at,
  'max_android_devices',v_package.max_android_devices
 );
end;$$;
revoke all on function public.attendance_login_context(text) from public,anon;
grant execute on function public.attendance_login_context(text) to authenticated;

-- Enrollment operations remain with subscribing Owner/HR Admin.
-- Platform IT may only activate, suspend and renew the commercial package.
