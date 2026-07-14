-- 034 · T-01 (ADR-0009 / IRR-4) — one-off backfill of `jurisdiction` on existing rows → zero nulls.
--
-- The canonical resolver lives ONLY in src/lib/jurisdiction.ts (resolveJurisdiction) and drives every
-- ONGOING write via stampTenant — that stays the single source of truth. This migration is a ONE-OFF
-- data backfill for rows written before the column existed; it mirrors that resolver's tiny alias map
-- in SQL so existing rows carry the SAME jurisdiction the app would stamp.
--
-- Resolver parity (jurisdiction.ts): state → trim + lower-case → alias {hr, haryana, हरियाणा} ⇒ 'hr',
-- else the normalized slug; empty/unknown state ⇒ '' (a valid, non-null key). SOURCE OF STATE is
-- `society_settings.state` — exactly what the app's `society` object feeds the resolver (DataContext
-- loads `society` from society_settings), so backfilled rows equal future app-stamped rows.
--
-- Idempotent: only touches rows where jurisdiction IS NULL. Additive/data-only, no schema change, no
-- historical financial figure altered (RULE 5 — only the residency key is filled). SAFE TO RE-RUN —
-- and it SHOULD be re-run once the write-path stamping (T-01 slice 3) is live, to catch any rows
-- created in the interim, achieving final zero-nulls. Requires migration 033 (the columns) first.

do $$
declare
  r record;
  n bigint;
begin
  for r in
    -- every tenant-scoped table that now has the jurisdiction column
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'society_id'
      and exists (
        select 1 from information_schema.columns j
        where j.table_schema = 'public' and j.table_name = c.table_name and j.column_name = 'jurisdiction'
      )
  loop
    execute format($f$
      update public.%I t
         set jurisdiction = case
               when lower(trim(coalesce(ss.state, ''))) in ('hr', 'haryana', 'हरियाणा') then 'hr'
               else lower(trim(coalesce(ss.state, '')))
             end
        from public.society_settings ss
       where t.society_id::text = ss.society_id::text   -- mixed uuid/text society_id across tables → cast both
         and t.jurisdiction is null
    $f$, r.table_name);
    get diagnostics n = row_count;
    if n > 0 then raise notice 'backfilled % row(s) in %', n, r.table_name; end if;
  end loop;
end $$;

-- Orphan / ghost rows — a society_id with NO society_settings (e.g. the RLS-hidden ghost society
-- 8fa05310, or legacy SOC001/PLATFORM seed data) — have no state to resolve from, so the join above
-- leaves them null. resolveJurisdiction('') = '' (a valid, non-null key), so set them to '' to hold the
-- zero-nulls acceptance without inventing a jurisdiction. Idempotent; safe to re-run.
do $$
declare r record; n bigint;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'society_id'
      and exists (
        select 1 from information_schema.columns j
        where j.table_schema = 'public' and j.table_name = c.table_name and j.column_name = 'jurisdiction'
      )
  loop
    execute format('update public.%I set jurisdiction = '''' where jurisdiction is null', r.table_name);
    get diagnostics n = row_count;
    if n > 0 then raise notice 'defaulted % orphan row(s) to '''' in %', n, r.table_name; end if;
  end loop;
end $$;
