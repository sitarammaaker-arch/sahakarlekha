-- 151 · society_empty_tables(): one call that says which of a list of tables hold NO rows for a society
-- (2026-10-31, login read-load S2).
--
-- WHY: every sign-in sends ~62 requests even for an empty society; ~39 of them read tables most societies
--   never use (17 marketing masters/registers, 5 consumer, 10 procurement, deposits, work orders, …) and
--   come back `[]`. See docs/perf/LOGIN-READ-LOAD-2026-10-31.md §2, §11.
--
-- WHAT: given a society id and table names, returns the names that EXIST, have a society_id column, and
--   have no row the CALLER can see for that society. The app skips fetching exactly those and sets `[]` —
--   the same value the fetch would have returned. Anything else (table missing, no society_id, an error
--   reading it) is left OUT of the answer, so the app fetches it as before.
--
-- SAFE: SECURITY INVOKER — it reads under the caller's own RLS, so "empty" means "the fetch would return
--   nothing to this user", never a peek at other tenants. Read-only (STABLE). Table names are matched
--   against pg_class and quoted with %I; the society_id type comes from the catalog. If the function is
--   missing (this file not run yet) the app falls back to fetching every table — order of deploy is free.

create or replace function public.society_empty_tables(p_society_id text, p_tables text[])
returns text[]
language plpgsql stable security invoker set search_path = public as $$
declare
  t text;
  typ text;
  is_empty boolean;
  result text[] := '{}';
begin
  if p_society_id is null or coalesce(cardinality(p_tables), 0) = 0 or cardinality(p_tables) > 100 then
    return result;
  end if;
  foreach t in array p_tables loop
    typ := null;
    select format_type(a.atttypid, a.atttypmod) into typ
      from pg_class c join pg_attribute a on a.attrelid = c.oid
     where c.relnamespace = 'public'::regnamespace and c.relname = t and c.relkind = 'r'
       and a.attname = 'society_id' and not a.attisdropped;
    continue when typ is null;                       -- unknown table → not reported → app fetches it
    begin
      execute format('select not exists (select 1 from public.%I where society_id = $1::%s)', t, typ)
        into is_empty using p_society_id;
    exception when others then
      continue;                                      -- unreadable → not reported → app fetches it
    end;
    if is_empty then result := result || t; end if;
  end loop;
  return result;
end;
$$;

revoke all on function public.society_empty_tables(text, text[]) from public, anon;
grant execute on function public.society_empty_tables(text, text[]) to authenticated;

-- VERIFY (signed-in app or SQL Editor): select public.society_empty_tables('<society id>', array['vouchers','procurement_crops','no_such_table']);
--   → as postgres (no RLS) lists procurement_crops only if that society has none; never lists no_such_table.
