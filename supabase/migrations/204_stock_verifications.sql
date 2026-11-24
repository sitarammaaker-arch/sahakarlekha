-- 204 · Physical stock verification (भौतिक स्टॉक सत्यापन) — HAFED Accounts Manual 1976, para 10.20, Annexure XV/1.
--
-- WHY: the manual has the manager count the stock every fortnight and sign a certificate on the stock register. The
-- portal had no record of a count: a difference could only be typed in as a manual adjustment, with no trace of who
-- counted, when, or what the book said at the time.
--
-- WHAT: one new table. A row is one count of one godown (or of the whole society when it keeps no godowns):
--   lines  — jsonb array of { itemId, itemName, unit, bookQty, physicalQty, diff, rate, value, reason, person,
--            posted, referenceNo } — the book figure is frozen as it stood when the count was saved
--   status — pending (saved, adjustments not yet confirmed) | complete | partial (some adjustment did not save)
-- The differences themselves are ordinary stock_movements (with reason, migration 203) and, for a recoverable
-- shortage, a voucher — this table only records the count and the certificate.
--
-- Access is the same as stock_movements: the society's own users read; writers write; deleters delete.
-- Run BEFORE deploying the code. Reversible: 204_stock_verifications_down.sql.

create table if not exists public.stock_verifications (
  id                 text primary key,
  society_id         text not null,
  "verificationNo"   text not null,
  date               date not null,
  "godownId"         text,
  "verifiedBy"       text not null,
  designation        text,
  status             text not null default 'pending' check (status in ('pending', 'complete', 'partial')),
  lines              jsonb not null default '[]'::jsonb,
  certificate        text,
  remarks            text,
  "createdBy"        text,
  "createdAt"        timestamptz not null default now()
);

create index if not exists stock_verifications_society_created_idx
  on public.stock_verifications (society_id, "createdAt", id);

alter table public.stock_verifications enable row level security;

grant select, insert, update, delete on public.stock_verifications to authenticated;
grant all on public.stock_verifications to service_role;

drop policy if exists stock_verifications_tenant_select on public.stock_verifications;
create policy stock_verifications_tenant_select on public.stock_verifications for select
  using (society_id in (select public.current_user_society_ids()));
drop policy if exists stock_verifications_tenant_insert on public.stock_verifications;
create policy stock_verifications_tenant_insert on public.stock_verifications for insert
  with check (society_id in (select public.current_user_society_ids()) and public.jwt_can_write());
drop policy if exists stock_verifications_tenant_update on public.stock_verifications;
create policy stock_verifications_tenant_update on public.stock_verifications for update
  using (society_id in (select public.current_user_society_ids()) and public.jwt_can_write())
  with check (society_id in (select public.current_user_society_ids()) and public.jwt_can_write());
drop policy if exists stock_verifications_tenant_delete on public.stock_verifications;
create policy stock_verifications_tenant_delete on public.stock_verifications for delete
  using (society_id in (select public.current_user_society_ids()) and public.jwt_can_delete());

-- The same row-level change log every society table carries.
drop trigger if exists change_log_row on public.stock_verifications;
create trigger change_log_row after insert or delete or update on public.stock_verifications
  for each row when (current_user = 'authenticated') execute function public._change_log_row();

-- A server-side restore (migration 178) may write it back.
insert into public.restore_tables (table_name) values ('stock_verifications') on conflict do nothing;

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('204', 'stock_verifications')
  on conflict do nothing;

-- VERIFY: expect table_exists = 1, policies = 4, restorable = 1.
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'stock_verifications') as table_exists,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'stock_verifications') as policies,
  (select count(*) from public.restore_tables where table_name = 'stock_verifications') as restorable;
