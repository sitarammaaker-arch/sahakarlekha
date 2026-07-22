-- =====================================================================================
-- Migration 110 — Row-Level Security (tenant + role + branch + self + PII + WORM)
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Enforce, in the database, the Phase-2/3 isolation model. Reuses the
--                platform helpers: get_current_society_id()::text, jwt_can_write/delete(),
--                jwt_branch_ok(text). service_role (compute service) bypasses RLS by design.
-- DEPENDENCIES : 100-108 and existing public.get_current_society_id/jwt_can_write/jwt_can_delete/jwt_branch_ok.
-- ROLLBACK     : 999 (policies drop with the schemas). Or `alter table ... disable row level security`.
-- SECURITY POSTURE (payroll): FAIL-CLOSED — a caller with no resolvable tenant is denied.
--                This is deliberately stricter than the platform''s fail-open rollout stance,
--                because payroll carries salary + PII.
-- VERIFY       : run the cross-tenant harness (2 societies A,B): A cannot read/write B; WORM
--                UPDATE/DELETE = 0 rows / blocked; PII tables deny non-HR roles.
-- =====================================================================================

-- Tenant predicate helper (payroll society_id is uuid; platform helper returns text).
create or replace function pay_core.current_society_uuid()
returns uuid language sql stable set search_path = '' as $$
  select nullif(public.get_current_society_id(), '')::uuid;
$$;
grant execute on function pay_core.current_society_uuid() to authenticated, service_role;

-- ── Enable + FORCE RLS on every payroll table ───────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select n.nspname as sch, c.relname as tbl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname like 'pay\_%' and c.relkind in ('r','p')     -- ordinary + partitioned parents
  loop
    execute format('alter table %I.%I enable row level security', r.sch, r.tbl);
    execute format('alter table %I.%I force  row level security', r.sch, r.tbl);
  end loop;
end$$;

-- ── Generic TENANT + ROLE policies for society-scoped tables ────────────────────────
-- Applied to every table that HAS a society_id column. SELECT = tenant; write = tenant+role.
do $$
declare r record; has_branch boolean;
begin
  for r in
    select n.nspname as sch, c.relname as tbl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname like 'pay\_%' and c.relkind = 'r'
      and exists (select 1 from pg_attribute a
                  where a.attrelid = c.oid and a.attname = 'society_id' and not a.attisdropped)
      -- child partitions inherit the parent policy; skip them
      and not exists (select 1 from pg_inherits i where i.inhrelid = c.oid)
  loop
    -- SELECT: own tenant, plus platform-standard rows (society_id null) where the column is nullable.
    execute format($f$
      create policy %I on %I.%I for select
      using (society_id = pay_core.current_society_uuid()
             or (society_id is null));
    $f$, r.tbl||'_sel', r.sch, r.tbl);

    -- INSERT / UPDATE: own tenant AND write role. (Platform rows are service_role-only.)
    execute format($f$
      create policy %I on %I.%I for insert
      with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
    $f$, r.tbl||'_ins', r.sch, r.tbl);
    execute format($f$
      create policy %I on %I.%I for update
      using      (society_id = pay_core.current_society_uuid() and public.jwt_can_write())
      with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
    $f$, r.tbl||'_upd', r.sch, r.tbl);

    -- DELETE: own tenant AND delete role. (Most tables also block hard-delete via trigger.)
    execute format($f$
      create policy %I on %I.%I for delete
      using (society_id = pay_core.current_society_uuid() and public.jwt_can_delete());
    $f$, r.tbl||'_del', r.sch, r.tbl);
  end loop;
end$$;

-- ── Reference tables (no society_id): world-readable to authenticated; writes = service_role ─
do $$
declare r record;
begin
  for r in
    select n.nspname as sch, c.relname as tbl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'pay_core' and c.relkind = 'r'
      and c.relname in ('component_kind','statutory_head','payment_mode','employment_type',
                        'return_form','employment_event_type')
  loop
    execute format('create policy %I on %I.%I for select using (true)', r.tbl||'_sel', r.sch, r.tbl);
    -- no insert/update/delete policy → authenticated is denied; service_role bypasses RLS.
  end loop;
end$$;
-- template_registry has no society_id → not covered by the generic society-scoped loop; make it
-- readable to all authenticated. leave_type HAS society_id, so the generic loop already gave it a
-- (society_id is null OR tenant) SELECT policy — no explicit policy needed here (would duplicate).
create policy template_registry_sel on pay_config.template_registry for select using (true);

-- ── BRANCH scoping (RESTRICTIVE) on tables carrying branch_id ────────────────────────
-- ANDs with the tenant policy: a branch-restricted user sees only their branch (+ unbranched at HO).
do $$
declare r record;
begin
  for r in
    select n.nspname as sch, c.relname as tbl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname like 'pay\_%' and c.relkind = 'r'
      and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='branch_id' and not a.attisdropped)
      and not exists (select 1 from pg_inherits i where i.inhrelid = c.oid)
  loop
    execute format($f$
      create policy %I on %I.%I as restrictive for select using (public.jwt_branch_ok(branch_id));
    $f$, r.tbl||'_branch_sel', r.sch, r.tbl);
  end loop;
end$$;

-- ── PII tables: RESTRICTIVE narrowing to write-capable roles (HR/payroll) ────────────
-- Tenant SELECT already applies; this restrictive policy further denies read to read-only roles.
-- (Employee self-service SELECT is a Phase-5 addition keyed on a verified employee↔user link.)
create policy statutory_identity_pii on pay_core.statutory_identity
  as restrictive for select using (public.jwt_can_write());
create policy bank_mandate_pii on pay_core.bank_mandate
  as restrictive for select using (public.jwt_can_write());

-- ── WORM tables: allow INSERT (append) + SELECT (tenant); NO update/delete policy ────
-- The generic loop already made _ins/_sel; it also made _upd/_del policies which are HARMLESS
-- because the tg_worm_guard trigger raises first. Drop them for clarity/least-privilege.
do $$
declare r record;
begin
  for r in
    select unnest(array[
      'pay_calc.pay_event','pay_calc.run_snapshot',
      'pay_audit.change_log','pay_audit.config_history','pay_core.employment_event']) as fq
  loop
    execute format('drop policy if exists %I on %s', split_part(r.fq,'.',2)||'_upd', r.fq);
    execute format('drop policy if exists %I on %s', split_part(r.fq,'.',2)||'_del', r.fq);
  end loop;
end$$;
