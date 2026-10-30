-- Disposable PostgreSQL CI only. Simulate the Supabase-managed auth schema and SQL roles.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
insert into auth.users(id) values
('10000000-0000-4000-8000-000000000001'),
('10000000-0000-4000-8000-000000000002'),
('10000000-0000-4000-8000-000000000003'),
('10000000-0000-4000-8000-000000000004');

-- Synthetic identities for Owner-managed multi-HR invite tests.
update auth.users set email=case id
 when '10000000-0000-4000-8000-000000000001' then 'owner-a@example.invalid'
 when '10000000-0000-4000-8000-000000000002' then 'staff-a@example.invalid'
 when '10000000-0000-4000-8000-000000000003' then 'owner-b@example.invalid'
 else 'staff-b@example.invalid' end;
