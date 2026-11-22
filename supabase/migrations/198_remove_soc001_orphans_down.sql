-- Undo 198 · puts the 'SOC001' rows back from _soc001_orphans_backup (rows already present are left alone) and
-- forgets the migration row. The backup table is kept.
begin;

insert into public.accounts
  select (jsonb_populate_record(null::public.accounts, b.row_data)).*
    from public._soc001_orphans_backup b where b.tbl = 'accounts'
  on conflict do nothing;

insert into public.account_reclass_log
  select (jsonb_populate_record(null::public.account_reclass_log, b.row_data)).*
    from public._soc001_orphans_backup b where b.tbl = 'account_reclass_log'
  on conflict do nothing;

delete from public.app_migrations where version = '198';

commit;
