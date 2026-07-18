-- 053 · catalog_versions — the change-audit trail ADR-0008 names, and Slice 2's finish line
-- in the CAIOS blueprint ("turn a code deploy into a data change").
--
-- WHAT THIS IS, AND IS NOT. The rules engine (src/lib/rules/engine.ts) is pure and reads an
-- in-memory catalog; today the catalogs (TDS_RULES, UCAS_RULES) ship in the bundle. This
-- migration does NOT change that — runtime resolution still reads the verified bundle, so a
-- wrong row here can never make the assistant state a wrong tax figure. It is the ADDITIVE
-- first half of the repo's proven additive-then-flip pattern (T-09 ledger cutover, T-20
-- appropriation): record every catalog version as auditable data now; only a LATER,
-- parity-gated slice lets the engine read from it.
--
-- WHAT IT BUYS NOW. A rule catalog is data with a version. This records which version was in
-- force — its content hash, rule/value counts, and how many values are `verified: true` (a
-- named human owns the figure — see tax.ts) vs unverified. The full rule VALUES stay in git
-- (the bundle); the row records the version metadata + hash, so an auditor can tie a recorded
-- figure to the exact catalog version that produced it, and see the moment a rate changed.
-- `src/lib/rules/catalogVersion.ts` builds these rows (pure); test:catalog-version pins the
-- seeded hashes, so the tax catalog cannot change without this trail noticing.
--
-- Reference data, NOT society-scoped: the Income-tax Act does not vary by tenant. Readable by
-- any authenticated user (non-sensitive statutory metadata); writable only by the service role
-- (this migration seeds it; a future service-role writer appends new versions). Append-only:
-- no update/delete policy, ever — a superseded version is history, not an edit.
--
-- Run once in the Supabase SQL editor.

create table if not exists catalog_versions (
  id                uuid primary key default gen_random_uuid(),
  catalog_name      text not null,               -- 'tds' | 'ucas' | …
  content_hash      text not null,               -- FNV-1a/64 over canonical catalog JSON
  rule_count        int  not null,
  value_count       int  not null,
  verified_count    int  not null,               -- values with verified:true (human-owned)
  unverified_count  int  not null,               -- values with verified:false (seeded, unconfirmed)
  effective_summary jsonb not null default '{}',  -- per-key audit detail; a later writer fills it
  source            text not null default 'bundle',
  recorded_at       timestamptz not null default now(),
  -- Idempotent: the same catalog content records one row. A real change ⇒ a new hash ⇒ a new row.
  unique (catalog_name, content_hash)
);

create index if not exists catalog_versions_name_time_idx
  on catalog_versions (catalog_name, recorded_at desc);

alter table catalog_versions enable row level security;

-- Reference metadata is readable by every authenticated user (no PII, no per-tenant data).
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'catalog_versions' and policyname = 'catalog_versions_select') then
    create policy "catalog_versions_select" on catalog_versions for select to authenticated using (true);
  end if;
end $$;
-- No insert/update/delete policy: only the service role writes (bypasses RLS). Append-only.

-- Seed the versions in force at this migration (values from buildCatalogVersion, pinned by
-- test:catalog-version). effective_summary is left to the future writer.
insert into catalog_versions (catalog_name, content_hash, rule_count, value_count, verified_count, unverified_count, source)
values
  ('tds',  'f93f700bfff69462', 16, 20, 18, 2, 'bundle'),
  ('ucas', 'aed8c453012a0bba',  4,  4,  0, 0, 'bundle')
on conflict (catalog_name, content_hash) do nothing;
