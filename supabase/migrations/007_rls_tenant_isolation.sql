-- ============================================================================
-- P1-SEC-1b · TENANT ISOLATION via RLS  —  extends 001_rls_policies.sql
-- ============================================================================
-- Enforces society_id tenant isolation on EVERY tenant-scoped table, removes all
-- permissive USING(true)/WITH CHECK(true) policies, and preserves append-only
-- (WORM) semantics for ledger_events + audit_log. No application/UI/business-rule
-- change: SECURITY DEFINER RPCs (register_society, app_login, app_register_admin,
-- next_document_number, get_all_societies, …) run as their owner and BYPASS RLS,
-- so admin/registration/numbering paths are unaffected.
--
-- DESIGN (surgical + automatic):
--   • Tables are discovered DYNAMICALLY: every public table with a `society_id`
--     column is a tenant table (future tables covered automatically). `societies`
--     (keyed by `id`, not `society_id`) is handled separately.
--   • For each table we DROP ONLY the permissive (unconditionally-true) policies —
--     001's already-scoped, role-based policies are KEPT — then fill any command
--     that now has NO policy with a get_current_society_id() tenant policy.
--   • WORM tables (ledger_events, audit_log) get SELECT+INSERT only; any UPDATE/
--     DELETE policy is removed and none is created → append-only preserved.
--
-- PRECONDITION: every production user authenticates via a Supabase Auth JWT
-- (P1-SEC-1a done + auth pre-flight passed). get_current_society_id() resolves the
-- tenant from auth.jwt()->>'email'; a JWT-less caller resolves to NULL → denied.
-- ============================================================================

begin;

-- ── Tenant helpers (idempotent — identical to 001; makes 007 self-sufficient) ─
create or replace function get_current_society_id()
returns text as $$
  select society_id from society_users
  where email = auth.jwt()->>'email'
  limit 1;
$$ language sql security definer stable;

create or replace function get_current_user_role()
returns text as $$
  select role from society_users
  where email = auth.jwt()->>'email'
  limit 1;
$$ language sql security definer stable;

-- ── Every society_id table: scope CRUD, drop permissive, WORM-aware ───────────
do $$
declare
  tbl   text;
  pol   record;
  worm  text[] := array['ledger_events', 'audit_log'];  -- append-only (requirement 5)
  is_worm boolean;
begin
  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'society_id'
          and a.attnum > 0 and not a.attisdropped
      )
    order by c.relname
  loop
    is_worm := tbl = any(worm);

    execute format('alter table public.%I enable row level security', tbl);

    -- (6) remove ONLY the permissive policies; keep any already-scoped ones (001).
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = tbl
        and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
    loop
      execute format('drop policy %I on public.%I', pol.policyname, tbl);
    end loop;

    -- (3) fill gaps: create a tenant policy for any command lacking one.
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and cmd in ('SELECT','ALL')) then
      execute format('create policy %I on public.%I for select using (society_id = get_current_society_id())',
                     tbl || '_tenant_select', tbl);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and cmd in ('INSERT','ALL')) then
      execute format('create policy %I on public.%I for insert with check (society_id = get_current_society_id())',
                     tbl || '_tenant_insert', tbl);
    end if;

    if is_worm then
      -- (5) hard-guarantee append-only: no UPDATE/DELETE policy may exist.
      for pol in
        select policyname from pg_policies
        where schemaname='public' and tablename=tbl and cmd in ('UPDATE','DELETE')
      loop
        execute format('drop policy %I on public.%I', pol.policyname, tbl);
      end loop;
    else
      if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and cmd in ('UPDATE','ALL')) then
        execute format('create policy %I on public.%I for update using (society_id = get_current_society_id()) with check (society_id = get_current_society_id())',
                       tbl || '_tenant_update', tbl);
      end if;
      if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and cmd in ('DELETE','ALL')) then
        execute format('create policy %I on public.%I for delete using (society_id = get_current_society_id())',
                       tbl || '_tenant_delete', tbl);
      end if;
    end if;
  end loop;
end $$;

-- ── societies registry: a user sees/edits ONLY their own society row ──────────
-- INSERT/DELETE of a society is a provisioning action → register_society RPC /
-- service-role only (SECURITY DEFINER bypasses RLS); no client policy is created.
do $$
declare pol record;
begin
  alter table public.societies enable row level security;

  for pol in
    select policyname from pg_policies
    where schemaname='public' and tablename='societies'
      and (coalesce(qual,'')='true' or coalesce(with_check,'')='true')
  loop
    execute format('drop policy %I on public.societies', pol.policyname);
  end loop;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='societies' and cmd in ('SELECT','ALL')) then
    execute format('create policy societies_tenant_select on public.societies for select using (id = get_current_society_id())');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='societies' and cmd in ('UPDATE','ALL')) then
    execute format('create policy societies_tenant_update on public.societies for update using (id = get_current_society_id()) with check (id = get_current_society_id())');
  end if;
end $$;

commit;
