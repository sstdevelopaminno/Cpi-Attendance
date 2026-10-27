-- Cpi Attendance Phase 1 draft. DO NOT execute on shared Communications production before review.
-- Dedicated non-exposed schema. No grants or RLS policies for browser roles.
create schema if not exists attendance;
revoke all on schema attendance from public, anon, authenticated;

create table if not exists attendance.organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{3,48}$'),
  legal_name text not null check (char_length(trim(legal_name)) between 2 and 200),
  timezone text not null default 'Asia/Bangkok',
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.org_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner','hr_admin','manager','payroll','employee','api_support')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id,auth_user_id)
);

create table if not exists attendance.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  employee_code text not null check (employee_code ~ '^[A-Za-z0-9._-]{2,48}$'),
  full_name text not null check (char_length(trim(full_name)) between 1 and 180),
  auth_user_id uuid references auth.users(id) on delete set null,
  employment_status text not null default 'active' check (employment_status in ('active','inactive','terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,employee_code),
  unique (organization_id,id),
  unique (organization_id,auth_user_id)
);
create index if not exists idx_att_employees_org_status on attendance.employees(organization_id,employment_status);

create table if not exists attendance.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  site_code text not null check (site_code ~ '^[A-Za-z0-9._-]{2,48}$'),
  name text not null,
  lat numeric(9,6) check (lat between -90 and 90),
  lon numeric(9,6) check (lon between -180 and 180),
  geofence_radius_m integer check (geofence_radius_m between 20 and 2000),
  geofence_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id,site_code),
  unique (organization_id,id),
  constraint geo_config_complete check (
    geofence_enabled = false or
    (lat is not null and lon is not null and geofence_radius_m is not null)
  )
);

create table if not exists attendance.shift_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  code text not null,
  label text not null,
  starts_at_local time not null,
  ends_at_local time not null,
  unpaid_break_minutes integer not null default 0 check (unpaid_break_minutes between 0 and 720),
  enabled boolean not null default true,
  unique (organization_id,code),
  unique (organization_id,id)
);

create table if not exists attendance.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  employee_id uuid not null,
  shift_template_id uuid not null,
  site_id uuid,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id,employee_id) references attendance.employees(organization_id,id) on delete restrict,
  foreign key (organization_id,shift_template_id) references attendance.shift_templates(organization_id,id) on delete restrict,
  foreign key (organization_id,site_id) references attendance.sites(organization_id,id) on delete restrict,
  check (scheduled_end_at > scheduled_start_at),
  unique (organization_id,id)
);
create index if not exists idx_att_shift_assignments_employee_start
  on attendance.shift_assignments(organization_id,employee_id,scheduled_start_at desc);

create table if not exists attendance.time_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  employee_id uuid not null,
  site_id uuid,
  shift_assignment_id uuid,
  event_type text not null check (event_type in ('check_in','check_out','break_start','break_end','correction')),
  method text not null check (method in ('qr','smart_card','kiosk','api','manual')),
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 128),
  occurred_at timestamptz not null default now(),
  client_observed_at timestamptz,
  device_code text,
  lat numeric(9,6) check (lat between -90 and 90),
  lon numeric(9,6) check (lon between -180 and 180),
  location_accuracy_m numeric(8,2) check (location_accuracy_m >= 0),
  evidence_status text not null default 'review' check (evidence_status in ('inside','outside','review','not_required')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id,employee_id) references attendance.employees(organization_id,id) on delete restrict,
  foreign key (organization_id,site_id) references attendance.sites(organization_id,id) on delete restrict,
  foreign key (organization_id,shift_assignment_id) references attendance.shift_assignments(organization_id,id) on delete restrict,
  unique (organization_id,idempotency_key)
);
create index if not exists idx_att_events_employee_time
  on attendance.time_events(organization_id,employee_id,occurred_at desc);
create index if not exists idx_att_events_site_time
  on attendance.time_events(organization_id,site_id,occurred_at desc);

create table if not exists attendance.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references attendance.organizations(id) on delete restrict,
  employee_id uuid not null,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  request_status text not null default 'pending' check (request_status in ('pending','approved','rejected','cancelled')),
  employee_note text,
  approved_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id,employee_id) references attendance.employees(organization_id,id) on delete restrict,
  check (end_date >= start_date)
);
create index if not exists idx_att_leave_requests_org_status
  on attendance.leave_requests(organization_id,request_status,created_at desc);

create table if not exists attendance.audit_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references attendance.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_code text not null,
  subject_type text not null,
  subject_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_att_audit_entries_org_time
  on attendance.audit_entries(organization_id,created_at desc);

-- Explicit deny-by-default. Application/API must never directly expose tables.
alter table attendance.organizations enable row level security;
alter table attendance.org_memberships enable row level security;
alter table attendance.employees enable row level security;
alter table attendance.sites enable row level security;
alter table attendance.shift_templates enable row level security;
alter table attendance.shift_assignments enable row level security;
alter table attendance.time_events enable row level security;
alter table attendance.leave_requests enable row level security;
alter table attendance.audit_entries enable row level security;

revoke all on all tables in schema attendance from public, anon, authenticated;
revoke all on all sequences in schema attendance from public, anon, authenticated;
alter default privileges in schema attendance revoke all on tables from public, anon, authenticated;
alter default privileges in schema attendance revoke all on sequences from public, anon, authenticated;

comment on schema attendance is
  'Private tenant-isolated Cpi Attendance data. Not exposed to browser Data API.';
comment on table attendance.time_events is
  'Append-only attendance facts; server must enforce idempotency, trusted timestamp, QR proof, identity and tenant.';
