-- 149 · Indexes for the sign-in load (2026-10-31, login read-load S3).
--
-- WHY: every sign-in / refresh reads each society table as `where society_id = $1 order by <cols> limit 1000`.
--   Prod pg_stat_user_tables (2026-03-26 → 2026-10-31): `accounts` was full-scanned 10,607 times, reading
--   43.7 M rows from a 7,768-row table. None of its indexes serves the query: the PK is (id, society_id),
--   with id first, and (society_id, code) is partial (WHERE code IS NOT NULL). So each read scanned EVERY
--   society's chart to find one society's. `stock_movements` has only its PK (8,871 full scans). That cost
--   grows with every society added. See docs/perf/LOGIN-READ-LOAD-2026-10-31.md §8.
--
-- WHAT: one index per sign-in table whose prod indexes cannot serve the read, in the loader's exact order
--   (orderBy ends in a unique column, see src/lib/supabasePaging.ts), so Postgres returns one society's rows
--   already ordered with no sort and no scan of other societies.
--   vouchers/ledger_events have society_id-leading indexes already; ordered indexes for them are a follow-up
--   to judge after this one is measured.
--
-- SAFE: an index never changes what a query returns (RULE 1 / RULE 2 untouched). It is not referenced by name.
--   `concurrently` = no write lock. It CANNOT run inside a transaction block, so run each statement on its own
--   (SQL Editor: one statement per Run). `if not exists` makes a re-run harmless.

create index concurrently if not exists accounts_society_id_idx
  on public.accounts (society_id, id);

create index concurrently if not exists stock_movements_society_created_idx
  on public.stock_movements (society_id, "createdAt", id);

-- VERIFY (expect 2 rows, both indisvalid = true; a concurrent build that failed leaves indisvalid = false → drop it and re-run):
-- select c.relname, i.indisvalid from pg_index i join pg_class c on c.oid = i.indexrelid
--  where c.relname in ('accounts_society_id_idx', 'stock_movements_society_created_idx');
