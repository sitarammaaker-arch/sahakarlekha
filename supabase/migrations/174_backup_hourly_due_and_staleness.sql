-- 174 · backups: hourly "due" runs + a stale-backup alarm (audit BKP-00 / BKP-07, 2026-11-17).
--
-- What went wrong: the weekly cron 'weekly-society-backup' (Sun 02:00 UTC) backs up EVERY society in
-- ONE Edge Function call. On 2026-11-15 cron reported "succeeded" (pg_net only queued the request)
-- but the call left no backup file, no audit row and no failure row — and nothing noticed. The next
-- attempt would have been a week later. Worse, read-only production checks (2026-11-17) show the
-- one call has been dying part-way EVERY week: only ~21 of 36 societies got a file each Sunday since
-- October, with no failure row for the rest. 3 societies with vouchers had no backup file since
-- 2026-09-27 / 10-04, and 2 had never had one. (The 'backup' audit rows those societies do have are
-- scheduled-rehearsal rows, not backups.)
--
-- This migration:
--   1. Replaces 'weekly-society-backup' with 'society-backup-due' at minute 15 of EVERY hour, calling
--      scheduled-backup with body {"due":true,"limit":4}. The function backs up only societies whose
--      last successful backup is > 6 days old (oldest first, at most 4 per call, 6 h back-off after a
--      failure — supabase/functions/_shared/backup-due.mjs). A dead call now costs one hour.
--      The new job's command is built FROM the old job's command (same URL, same x-backup-secret
--      header), so the secret never appears in this repository. If the old job is missing, or its
--      command does not have the expected body, the migration stops and changes nothing.
--   2. log_backup_staleness(): one error_log row (source 'backup-stale') per society that has at least
--      one live voucher and NO successful scheduled backup in the last 8 days. pg_cron
--      'backup-staleness-daily' runs it at 04:00 UTC (09:30 IST). It reads audit_log only — it does
--      not depend on the backup function running at all.
--
-- DEPLOY ORDER: redeploy the scheduled-backup Edge Function FIRST (it must understand "due"), then run
-- this file. An old function given {"due":true} backs up every society every hour.
-- Not client-callable. Idempotent. Undo: 174_backup_hourly_due_and_staleness_down.sql.

begin;

create or replace function public.backup_staleness(p_days int default 8)
returns table (society_id text, last_backup_at timestamptz, live_vouchers bigint)
language sql stable security definer
set search_path = public as $fn$
  with soc as (
    select v.society_id::text sid, count(*) n
      from public.vouchers v
     where not coalesce(v."isDeleted", false)
     group by 1
  ),
  ok as (
    select a.society_id::text sid, max(a.created_at) last_ok
      from public.audit_log a
     where a.entity_type = 'backup' and a.actor_name = 'scheduled-backup'
       and a.after ->> 'trigger' = 'scheduled' and a.after ->> 'status' is null
     group by 1
  )
  select soc.sid, ok.last_ok, soc.n
    from soc left join ok using (sid)
   where ok.last_ok is null or ok.last_ok < now() - make_interval(days => p_days)
   order by ok.last_ok nulls first, soc.sid;
$fn$;
revoke execute on function public.backup_staleness(int) from public, anon, authenticated;

create or replace function public.log_backup_staleness()
returns int language plpgsql security definer
set search_path = public as $fn$
declare r record; n int := 0;
begin
  for r in select * from public.backup_staleness(8) loop
    n := n + 1;
    insert into public.error_log (id, society_id, source, message, context, created_at)
    values (gen_random_uuid()::text, r.society_id, 'backup-stale',
            case when r.last_backup_at is null
              then 'इस समिति का कोई सर्वर backup दर्ज नहीं है — scheduled-backup के logs देखें'
              else format('इस समिति का आख़िरी सर्वर backup %s का है (8 दिन से पुराना) — scheduled-backup के logs देखें',
                          to_char(r.last_backup_at at time zone 'Asia/Kolkata', 'DD-MM-YYYY HH24:MI'))
            end,
            jsonb_build_object('lastBackupAt', r.last_backup_at, 'liveVouchers', r.live_vouchers),
            now());
  end loop;
  return n;
end;
$fn$;
revoke execute on function public.log_backup_staleness() from public, anon, authenticated;

do $cron$
declare old_cmd text; new_cmd text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  if not exists (select 1 from cron.job where jobname = 'society-backup-due') then
    select command into old_cmd from cron.job where jobname = 'weekly-society-backup';
    if old_cmd is null then
      raise exception '174: cron job weekly-society-backup not found — schedule society-backup-due by hand (see scheduled-backup/README.md)';
    end if;
    new_cmd := replace(old_cmd, 'body := ''{}''::jsonb', 'body := ''{"due":true,"limit":4}''::jsonb');
    if new_cmd = old_cmd then
      raise exception '174: weekly-society-backup command has no body := ''{}''::jsonb — not changed; schedule by hand';
    end if;
    perform cron.schedule('society-backup-due', '15 * * * *', new_cmd);
    perform cron.unschedule('weekly-society-backup');
  end if;

  if exists (select 1 from cron.job where jobname = 'backup-staleness-daily') then
    perform cron.unschedule('backup-staleness-daily');
  end if;
  perform cron.schedule('backup-staleness-daily', '0 4 * * *', 'select public.log_backup_staleness()');
end $cron$;

insert into public.app_migrations (version, name) values ('174', 'backup_hourly_due_and_staleness')
  on conflict (version) do nothing;

commit;
