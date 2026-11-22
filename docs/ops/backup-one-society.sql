-- PRODUCTION SQL Editor · takes ONE fresh backup of one society now (replace <SOCIETY_ID> below).
-- It reuses the hourly backup job's own command (so the cron secret is never typed or shown), only swapping the
-- body {"due":true,"limit":4} for {"societyId":"<SOCIETY_ID>"}. Writes nothing itself: it asks the backup function to run.
do $$
declare c text;
begin
  select command into c from cron.job where jobname = 'society-backup-due';
  if c is null then raise exception 'cron job society-backup-due not found — nothing run'; end if;
  if position('{"due":true,"limit":4}' in c) = 0 then raise exception 'unexpected cron command — nothing run'; end if;
  execute replace(c, '{"due":true,"limit":4}', '{"societyId":"<SOCIETY_ID>"}');
end $$;
select 'backup requested — wait ~1 minute, then check audit_log (actor scheduled-backup)' as status;
