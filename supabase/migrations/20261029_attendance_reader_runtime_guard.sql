-- Commercial HR reader hardening: avoid stored plaintext IPs and purge encrypted envelopes.
create table attendance.reader_claim_limits (
 fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$'),
 attempts integer not null default 0,
 started_at timestamptz not null default clock_timestamp()
);
alter table attendance.reader_claim_limits enable row level security;
revoke all on attendance.reader_claim_limits from public,anon,authenticated;

create function public.attendance_reader_allow_claim(p_fingerprint text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
 then raise exception using errcode='22023',message='reader_claim_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended('reader:claim:'||p_fingerprint,0));
 insert into attendance.reader_claim_limits(fingerprint,attempts)
 values(p_fingerprint,1)
 on conflict(fingerprint) do update set
 attempts=case when attendance.reader_claim_limits.started_at<clock_timestamp()-interval '10 minutes'
   then 1 else attendance.reader_claim_limits.attempts+1 end,
 started_at=case when attendance.reader_claim_limits.started_at<clock_timestamp()-interval '10 minutes'
   then clock_timestamp() else attendance.reader_claim_limits.started_at end
 returning attempts into v_count;
 if v_count>20 then raise exception using errcode='P0001',message='reader_claim_rate_limited';end if;
 return true;
end;$$;
revoke all on function public.attendance_reader_allow_claim(text) from public,anon,authenticated;
grant execute on function public.attendance_reader_allow_claim(text) to service_role;

create or replace function public.attendance_reader_cleanup() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from attendance.reader_handoffs where expires_at<clock_timestamp()-interval '1 hour';
 get diagnostics n=row_count;
 delete from attendance.reader_claim_limits where started_at<clock_timestamp()-interval '1 day';
 return n;
end;$$;
revoke all on function public.attendance_reader_cleanup() from public,anon,authenticated;
grant execute on function public.attendance_reader_cleanup() to service_role;
