-- Persist an HR-verified applicant profile in the existing private attendance schema.
-- Never expose national ID or photo in list endpoints, public storage or logs.
create table if not exists attendance.application_private_profiles(
  organization_id uuid not null references attendance.organizations(id),
  application_id uuid not null references attendance.applications(id),
  fields jsonb not null default '{}'::jsonb,
  photo_mime text,
  photo_bytes bytea,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null,
  primary key(organization_id, application_id),
  constraint photo_type check(photo_mime is null or photo_mime in ('image/jpeg','image/png','image/webp')),
  constraint photo_size check(photo_bytes is null or octet_length(photo_bytes)<=262144)
);
alter table attendance.application_private_profiles enable row level security;
revoke all on attendance.application_private_profiles from public,anon,authenticated;

create or replace function public.attendance_hr_store_application_profile(
  p_org uuid,p_application uuid,p_fields jsonb,p_photo_mime text,p_photo_b64 text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_photo bytea;v_key text;v_value text;v_existing attendance.application_private_profiles%rowtype;
begin
 if auth.uid() is null or not exists(
   select 1 from attendance.org_memberships m join attendance.organizations o
   on o.id=m.organization_id where m.organization_id=p_org and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if not exists(select 1 from attendance.applications a where a.id=p_application
   and a.organization_id=p_org and a.archived_at is null)
 then raise exception using errcode='22023',message='application_locked_or_missing';end if;
 if p_fields is null or jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>10000
 then raise exception using errcode='22023',message='application_fields_invalid';end if;
 for v_key,v_value in select key,value from jsonb_each_text(p_fields) loop
  if v_key not in ('english_name','national_id','dob','gender','phone','address','issuer','issued',
    'expires','thai_prefix','english_prefix','position','education','expected_salary',
    'available_date','work_history') or length(v_value)>1200
  then raise exception using errcode='22023',message='application_fields_invalid';end if;
 end loop;
 if p_fields ? 'national_id' and coalesce(p_fields->>'national_id','') not in ('')
  and (p_fields->>'national_id') !~ '^[0-9]{13}$'
 then raise exception using errcode='22023',message='application_fields_invalid';end if;
 if p_photo_b64 is not null then
  if p_photo_mime not in ('image/jpeg','image/png','image/webp')
     or length(p_photo_b64)>349528 or p_photo_b64 !~ '^[A-Za-z0-9+/=]+$'
  then raise exception using errcode='22023',message='application_photo_invalid';end if;
  begin
   v_photo:=decode(p_photo_b64,'base64');
  exception when others then
   raise exception using errcode='22023',message='application_photo_invalid';
  end;
  if octet_length(v_photo)>262144 or octet_length(v_photo)<4
    or (p_photo_mime='image/jpeg' and (get_byte(v_photo,0)<>255 or get_byte(v_photo,1)<>216))
    or (p_photo_mime='image/png' and (get_byte(v_photo,0)<>137 or get_byte(v_photo,1)<>80))
    or (p_photo_mime='image/webp' and convert_from(substring(v_photo from 1 for 4),'UTF8')<>'RIFF')
  then raise exception using errcode='22023',message='application_photo_invalid';end if;
 else
  if p_photo_mime is not null then raise exception using errcode='22023',message='application_photo_invalid';end if;
 end if;
 -- Photo omission keeps an existing photo when editing text-only. Explicit
 -- removal is a separately authorized action, not an accidental empty upload.
 insert into attendance.application_private_profiles
 (organization_id,application_id,fields,photo_mime,photo_bytes,updated_by)
 values(p_org,p_application,p_fields,p_photo_mime,v_photo,auth.uid())
 on conflict(organization_id,application_id) do update set
 fields=excluded.fields,
 photo_mime=coalesce(excluded.photo_mime,attendance.application_private_profiles.photo_mime),
 photo_bytes=coalesce(excluded.photo_bytes,attendance.application_private_profiles.photo_bytes),
 updated_at=clock_timestamp(),updated_by=auth.uid();
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,
   subject_type,subject_id,details)
 values(p_org,auth.uid(),'application_private_updated','application',p_application,
   jsonb_build_object('field_keys',(select jsonb_agg(key) from jsonb_object_keys(p_fields) key),
     'has_photo',v_photo is not null));
 return jsonb_build_object('id',p_application,'saved',true);
end;$$;
revoke all on function public.attendance_hr_store_application_profile(uuid,uuid,jsonb,text,text) from public,anon;
grant execute on function public.attendance_hr_store_application_profile(uuid,uuid,jsonb,text,text) to authenticated;

create or replace function public.attendance_hr_submit_application_full(
 p_org uuid,p_name text,p_source text,p_key text,p_confirm boolean,
 p_fields jsonb,p_photo_mime text,p_photo_b64 text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 v:=public.attendance_hr_submit_application(p_org,p_name,p_source,p_key,p_confirm);
 perform public.attendance_hr_store_application_profile(
   p_org,(v->>'id')::uuid,p_fields,p_photo_mime,p_photo_b64);
 return v;
end;$$;
revoke all on function public.attendance_hr_submit_application_full(uuid,text,text,text,boolean,jsonb,text,text) from public,anon;
grant execute on function public.attendance_hr_submit_application_full(uuid,text,text,text,boolean,jsonb,text,text) to authenticated;

create or replace function public.attendance_hr_update_application_full(
 p_org uuid,p_id uuid,p_name text,p_fields jsonb,p_photo_mime text,p_photo_b64 text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 v:=public.attendance_hr_update_application(p_org,p_id,p_name);
 perform public.attendance_hr_store_application_profile(p_org,p_id,p_fields,p_photo_mime,p_photo_b64);
 return v;
end;$$;
revoke all on function public.attendance_hr_update_application_full(uuid,uuid,text,jsonb,text,text) from public,anon;
grant execute on function public.attendance_hr_update_application_full(uuid,uuid,text,jsonb,text,text) to authenticated;

create or replace function public.attendance_hr_get_application_profile(p_org uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v attendance.application_private_profiles%rowtype;
begin
 if auth.uid() is null or not exists(
   select 1 from attendance.org_memberships m join attendance.organizations o
   on o.id=m.organization_id where m.organization_id=p_org and m.auth_user_id=auth.uid()
   and m.status='active' and m.role in ('owner','hr_admin') and o.status='active'
 ) then raise exception using errcode='42501',message='attendance_hr_forbidden';end if;
 if not exists(select 1 from attendance.applications a
   where a.id=p_id and a.organization_id=p_org and a.archived_at is null)
 then raise exception using errcode='22023',message='application_locked_or_missing';end if;
 select * into v from attendance.application_private_profiles
 where organization_id=p_org and application_id=p_id;
 insert into attendance.audit_entries(organization_id,actor_user_id,action_code,
   subject_type,subject_id)
 values(p_org,auth.uid(),'application_private_viewed','application',p_id);
 if v.application_id is null then return jsonb_build_object('fields','{}'::jsonb,'photo',null);end if;
 return jsonb_build_object('fields',v.fields,'photo',
    case when v.photo_bytes is null then null else jsonb_build_object(
      'mime',v.photo_mime,'base64',encode(v.photo_bytes,'base64')) end);
end;$$;
revoke all on function public.attendance_hr_get_application_profile(uuid,uuid) from public,anon;
grant execute on function public.attendance_hr_get_application_profile(uuid,uuid) to authenticated;