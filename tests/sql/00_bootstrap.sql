-- Disposable PostgreSQL CI only. Simulate relevant Supabase auth objects and SQL roles.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

insert into auth.users(id) values
('10000000-0000-4000-8000-000000000001'), -- HR organization A
('10000000-0000-4000-8000-000000000002'), -- employee organization A
('10000000-0000-4000-8000-000000000003'), -- HR organization B
('10000000-0000-4000-8000-000000000004'); -- employee organization B
