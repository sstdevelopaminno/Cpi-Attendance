-- One-time bootstrap for the first internal test tenant Owner, not an IT device approval.
-- Record is private and a random 256-bit token is used once, expiring after 10 minutes.
create table attendance.owner_bootstrap_invites (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references attendance.organizations(id) on delete restrict,
 invite_email text not null check (invite_email ~* '^[^ @]+@[^ @]+\.[^ @]+$'),
 login_code text not null check (login_code ~ '^[A-Z0-9]{6}$'),
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending'
  check (status in ('pending','claimed','sent','cancelled')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 claimed_at timestamptz,
 sent_at timestamptz,
 invited_auth_user_id uuid references auth.users(id) on delete restrict
);
alter table attendance.owner_bootstrap_invites enable row level security;
revoke all on attendance.owner_bootstrap_invites from public,anon,authenticated;
create or replace function public.attendance_owner_bootstrap_claim(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.owner_bootstrap_invites%rowtype;
begin
 if p_token_hash !~ '^[0-9a-f]{64}$' then
  raise exception using errcode='42501',message='bootstrap_denied';end if;
 update attendance.owner_bootstrap_invites i set status='claimed',claimed_at=clock_timestamp()
 where i.token_hash=p_token_hash and i.status='pending' and i.expires_at>clock_timestamp()
 and exists(select 1 from attendance.subscriptions s where s.organization_id=i.organization_id
   and s.subscription_kind='internal_test' and s.status='active'
   and s.expires_at>clock_timestamp())
 returning * into v;
 if not found then raise exception using errcode='42501',message='bootstrap_denied';end if;
 return jsonb_build_object('request_id',v.id,'organization_id',v.organization_id,
   'invite_email',v.invite_email,'login_code',v.login_code);
end;$$;
revoke all on function public.attendance_owner_bootstrap_claim(text) from public,anon,authenticated;
grant execute on function public.attendance_owner_bootstrap_claim(text) to service_role;

create or replace function public.attendance_owner_bootstrap_complete(
 p_request_id uuid,p_auth_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.owner_bootstrap_invites%rowtype;
begin
 select * into v from attendance.owner_bootstrap_invites
 where id=p_request_id and status='claimed' and expires_at>clock_timestamp()
 for update;
 if not found then raise exception using errcode='42501',message='bootstrap_denied';end if;
 if not exists(select 1 from auth.users u where u.id=p_auth_user_id
   and lower(u.email)=lower(v.invite_email)) then
   raise exception using errcode='42501',message='bootstrap_identity_mismatch';end if;
 insert into attendance.org_memberships(organization_id,auth_user_id,role,status)
 values(v.organization_id,p_auth_user_id,'owner','active')
 on conflict(organization_id,auth_user_id) do nothing;
 insert into attendance.hr_login_aliases(organization_id,login_code,auth_user_id)
 values(v.organization_id,v.login_code,p_auth_user_id);
 update attendance.owner_bootstrap_invites set status='sent',sent_at=clock_timestamp(),
   invited_auth_user_id=p_auth_user_id,token_hash=encode(gen_random_bytes(32),'hex')
 where id=v.id;
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,subject_type,subject_id,details)
 values(v.organization_id,null,'internal_test_owner_invited','subscription',v.organization_id,
   jsonb_build_object('bootstrap_request_id',v.id,'hr_code',v.login_code));
 return jsonb_build_object('status','owner_invited','organization_id',v.organization_id);
end;$$;
revoke all on function public.attendance_owner_bootstrap_complete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.attendance_owner_bootstrap_complete(uuid,uuid) to service_role;
