-- 198 · remove the orphan 'SOC001' rows (founder decision 2026-11-22, after DB-04 / migration 197).
--
-- WHAT IS THERE (read-only, prod 2026-11-22): 377 accounts rows and 9 account_reclass_log rows with society_id
-- 'SOC001'. No society has that id (no societies / society_settings row). The accounts are a copy of the standard chart:
-- no opening balance on any of them, and nothing references them — no voucher_lines, voucher_entries or account_roles
-- row has society_id 'SOC001' (every other table checked: 0 rows). They came in through the old `default 'SOC001'`,
-- which 197 removed.
--
-- HOW: every row is first copied, whole, into _soc001_orphans_backup (jsonb, readable by nobody but the owner), then
-- deleted. The guard refuses if anything references them by then. Undo: 198_remove_soc001_orphans_down.sql puts the
-- rows back from the backup.
begin;

create table if not exists public._soc001_orphans_backup (
  id       bigserial primary key,
  tbl      text not null,
  row_data jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public._soc001_orphans_backup enable row level security;   -- no policy: no API role can read or write it
revoke all on public._soc001_orphans_backup from public, anon, authenticated;

do $$
begin
  -- Guard: nothing may point at a SOC001 account (the delete would also hit the foreign keys).
  if exists (select 1 from public.voucher_lines where society_id = 'SOC001')
     or exists (select 1 from public.account_roles where society_id = 'SOC001')
     or exists (select 1 from public.voucher_entries where society_id = 'SOC001') then
    raise exception '198: SOC001 accounts are referenced — not removing anything';
  end if;
end $$;

insert into public._soc001_orphans_backup (tbl, row_data)
  select 'accounts', to_jsonb(a) from public.accounts a where a.society_id = 'SOC001';
insert into public._soc001_orphans_backup (tbl, row_data)
  select 'account_reclass_log', to_jsonb(l) from public.account_reclass_log l where l.society_id = 'SOC001';

delete from public.account_reclass_log where society_id = 'SOC001';
delete from public.accounts where society_id = 'SOC001';

insert into public.app_migrations (version, name) values ('198', 'remove_soc001_orphans')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect: accounts = 0 | reclass = 0 | backed_up = 386 (377 + 9) | mig = 1):
--   select (select count(*) from public.accounts where society_id = 'SOC001') as accounts,
--          (select count(*) from public.account_reclass_log where society_id = 'SOC001') as reclass,
--          (select count(*) from public._soc001_orphans_backup) as backed_up,
--          (select count(*) from public.app_migrations where version = '198') as mig;
