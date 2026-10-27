-- Run as superuser with ON_ERROR_STOP=1 in a disposable database only.
insert into attendance.organizations (id,code,legal_name) values
('20000000-0000-4000-8000-000000000001','COMP_A','Org A'),
('20000000-0000-4000-8000-000000000002','COMP_B','Org B');

insert into attendance.org_memberships (organization_id,auth_user_id,role)
values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','hr_admin'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','employee'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','hr_admin'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','employee');

insert into attendance.employees(id,organization_id,employee_code,full_name,auth_user_id)
values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','E001','Employee A','10000000-0000-4000-8000-000000000002'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','E001','Employee B','10000000-0000-4000-8000-000000000004');

insert into attendance.sites(id,organization_id,site_code,name,lat,lon,geofence_radius_m,geofence_enabled)
values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','HQ','Org A Bangkok',13.750000,100.500000,150,true),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','HQ','Org B Bangkok',13.750000,100.500000,150,true);

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);

-- Org A HR can issue a dynamic QR for their own site.
select set_config('test.qr_nonce',public.attendance_issue_qr(
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001')->>'nonce',false);

-- HR from Org A cannot issue QR at Org B's site.
do $$
begin
  begin
    perform public.attendance_issue_qr(
      '20000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000002');
    raise exception 'FAILED: cross-org QR issuer accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Private tables must not be directly readable through authenticated role.
do $$
begin
  begin
    perform count(*) from attendance.employees;
    raise exception 'FAILED: private employee table exposed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Employee A cannot issue a QR.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
begin
  begin
    perform public.attendance_issue_qr(
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: employee issued HR QR';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Valid employee clock-in in their own organization.
do $$
declare v jsonb; v2 jsonb;
begin
  v := public.attendance_record_punch(
    '20000000-0000-4000-8000-000000000001','check_in',
    'test-event-in-000001',current_setting('test.qr_nonce'),
    13.750000,100.500000,12);
  if v->>'replayed'<>'false' or v->>'evidence_status'<>'inside' then
    raise exception 'FAILED: expected successful clock-in: %',v;
  end if;
  v2 := public.attendance_record_punch(
    '20000000-0000-4000-8000-000000000001','check_in',
    'test-event-in-000001',current_setting('test.qr_nonce'),
    13.750000,100.500000,12);
  if v2->>'replayed'<>'true' or v2->>'event_id'<>v->>'event_id' then
    raise exception 'FAILED: idempotent replay mismatch';
  end if;
end;
$$;

-- Employee A cannot use the Org A QR to record into Org B.
do $$
begin
  begin
    perform public.attendance_record_punch(
      '20000000-0000-4000-8000-000000000002','check_in',
      'cross-tenant-00000001',current_setting('test.qr_nonce'),13.750000,100.500000,12);
    raise exception 'FAILED: employee A wrote Org B';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Employee A cannot check-in repeatedly with another idempotency key.
do $$
begin
  begin
    perform public.attendance_record_punch(
      '20000000-0000-4000-8000-000000000001','check_in',
      'test-event-in-000002',current_setting('test.qr_nonce'),13.750000,100.500000,12);
    raise exception 'FAILED: duplicate open shift accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- Reject spoofed location outside geofence.
do $$
begin
  begin
    perform public.attendance_record_punch(
      '20000000-0000-4000-8000-000000000001','check_out',
      'test-event-out-000001',current_setting('test.qr_nonce'),13.800000,100.500000,12);
    raise exception 'FAILED: outside geofence accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- Check-out is accepted, followed by protected history.
do $$
declare v jsonb; h jsonb;
begin
  v:=public.attendance_record_punch(
      '20000000-0000-4000-8000-000000000001','check_out',
      'test-event-out-000002',current_setting('test.qr_nonce'),13.750000,100.500000,12);
  if v->>'replayed'<>'false' then raise exception 'FAILED: checkout'; end if;
  h:=public.attendance_my_history('20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(h)<>2 then raise exception 'FAILED: expected exactly 2 events, got %',h; end if;
end;
$$;

-- HR A cannot read employee personal history: no employee auth binding.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
begin
  begin
    perform public.attendance_my_history('20000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: HR read a personal history using self-only endpoint';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- Database invariant: all test punches belong to the correct organization.
do $$
begin
  if (select count(*) from attendance.time_events)<>2 then
    raise exception 'FAILED: incorrect event count';
  end if;
  if (select count(*) from attendance.time_events where organization_id =
       '20000000-0000-4000-8000-000000000002')<>0 then
    raise exception 'FAILED: org B unexpectedly has punches';
  end if;
  if (select count(*) from attendance.audit_entries)<>2 then
    raise exception 'FAILED: audit event mismatch';
  end if;
  raise notice 'PASS: private schema, HR restrictions, cross-tenant, idempotency, GPS, state machine, self history';
end;
$$;
