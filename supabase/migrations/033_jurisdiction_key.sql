-- 033 · T-01 (ADR-0009 / Canonical CL-5, gap IRR-4) — the jurisdiction key, additive schema.
--
-- Every financial row must carry (society_id, jurisdiction). society_id already exists (the tenant);
-- `jurisdiction` is the residency / consolidation scope, resolved from the society's `state` by
-- resolveJurisdiction() in src/lib/jurisdiction.ts — the SINGLE source of truth, deliberately NOT
-- reimplemented in SQL (so the column is added here but value-backfilled by a follow-on step).
--
-- Purely ADDITIVE (nullable), so nothing breaks before or after it runs. Per RULE 1 the app write
-- paths stamp this column only AFTER the column exists everywhere — this migration is that
-- prerequisite. Idempotent (`add column if not exists`); safe to re-run. Formalises the block that
-- lived in supabase-tables.sql into a numbered, versioned migration so prod coverage is explicit.

-- Canonical financial spine (explicit, for readability) — a subset of the dynamic block below.
alter table accounts         add column if not exists jurisdiction text;
alter table vouchers         add column if not exists jurisdiction text;
alter table voucher_entries  add column if not exists jurisdiction text;
alter table members          add column if not exists jurisdiction text;
alter table loans            add column if not exists jurisdiction text;
alter table kcc_loans        add column if not exists jurisdiction text;
alter table assets           add column if not exists jurisdiction text;
alter table stock_items      add column if not exists jurisdiction text;
alter table stock_movements  add column if not exists jurisdiction text;
alter table sales            add column if not exists jurisdiction text;
alter table purchases        add column if not exists jurisdiction text;
alter table employees        add column if not exists jurisdiction text;
alter table salary_records   add column if not exists jurisdiction text;
alter table suppliers        add column if not exists jurisdiction text;
alter table customers        add column if not exists jurisdiction text;
alter table audit_objections add column if not exists jurisdiction text;
alter table budgets          add column if not exists jurisdiction text;

-- Partition/residency indexes (the ones a consolidation query reads first).
create index if not exists vouchers_jurisdiction_idx        on vouchers (society_id, jurisdiction);
create index if not exists voucher_entries_jurisdiction_idx on voucher_entries (society_id, jurisdiction);
create index if not exists members_jurisdiction_idx         on members (society_id, jurisdiction);

-- The write chokepoint (withSoc → stampTenant) writes to EVERY tenant-scoped table, so EVERY table
-- with `society_id` must also have `jurisdiction` or those upserts would fail on a missing column
-- (RULE 1). This dynamic block adds it to all of them at once — a superset of the explicit list,
-- self-maintaining as new tables appear. REQUIRED before the domain-context withSoc changes go live.
do $$
declare r record;
begin
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'society_id'
  loop
    execute format('alter table public.%I add column if not exists jurisdiction text', r.table_name);
  end loop;
end $$;
