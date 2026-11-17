-- Undo 174: put the weekly all-societies backup back and drop the stale-backup alarm.
-- The weekly command is rebuilt from the hourly one (same URL and secret header), body back to {}.
begin;

do $cron$
declare cur_cmd text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  select command into cur_cmd from cron.job where jobname = 'society-backup-due';
  if cur_cmd is not null then
    if not exists (select 1 from cron.job where jobname = 'weekly-society-backup') then
      perform cron.schedule('weekly-society-backup', '0 2 * * 0',
        replace(cur_cmd, 'body := ''{"due":true,"limit":4}''::jsonb', 'body := ''{}''::jsonb'));
    end if;
    perform cron.unschedule('society-backup-due');
  end if;
  if exists (select 1 from cron.job where jobname = 'backup-staleness-daily') then
    perform cron.unschedule('backup-staleness-daily');
  end if;
end $cron$;

drop function if exists public.log_backup_staleness();
drop function if exists public.backup_staleness(int);
delete from public.app_migrations where version = '174';

commit;
