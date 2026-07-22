-- =====================================================================================
-- Migration 102 — Shared functions & generic triggers  +  business-function SIGNATURES
-- -------------------------------------------------------------------------------------
-- PURPOSE      : (a) IMPLEMENT the generic, non-business plumbing every table reuses —
--                    timestamps, WORM/soft-delete protection, generic audit capture,
--                    tenant-stamp guard, version-supersede guard.
--                (b) DECLARE (signature only, body = a safe stub that RAISES 'not implemented')
--                    the BUSINESS functions — calculation, resolution, posting, numbering.
--                    Per Phase-4 instruction: "specify signatures, do not implement logic yet."
-- DEPENDENCIES : 100, 101, and the audit table in 109 for tg_pay_audit()  → 109 must precede
--                any TRIGGER that calls tg_pay_audit(); the FUNCTION here is create-or-replace
--                and only the trigger attachment (in 103+) needs the table. (Deploy order enforced.)
-- ROLLBACK     : covered by 999 schema drop.
-- VERIFY       : select proname from pg_proc join pg_namespace n on n.oid=pronamespace
--                where n.nspname like 'pay_%';   -- lists all payroll functions.
-- =====================================================================================

-- ── Generic: maintain updated_at/updated_by on UPDATE ───────────────────────────────
create or replace function pay_core.tg_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;
comment on function pay_core.tg_touch_updated() is 'BEFORE UPDATE: stamps updated_at. Attach to every mutable table.';

-- ── Generic: forbid UPDATE/DELETE on WORM tables (events, audit, history) ────────────
create or replace function pay_core.tg_worm_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'PAY-ACC-720: % is append-only (WORM); % is not permitted',
        tg_table_name, tg_op using errcode = 'restrict_violation';
end$$;
comment on function pay_core.tg_worm_guard() is 'BEFORE UPDATE OR DELETE: blocks mutation of append-only tables.';

-- ── Generic: block HARD delete on financial/master tables (soft-delete only) ─────────
create or replace function pay_core.tg_no_hard_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'PAY-BUS-250: hard delete of % is forbidden; use status/soft-cancel (L3/L4)',
        tg_table_name using errcode = 'restrict_violation';
end$$;
comment on function pay_core.tg_no_hard_delete() is 'BEFORE DELETE: enforces "financial records are never hard-deleted".';

-- ── Generic: require society_id on insert (defence-in-depth vs the SOC001 misroute class) ─
create or replace function pay_core.tg_require_tenant()
returns trigger language plpgsql as $$
begin
  if new.society_id is null then
    raise exception 'PAY-VAL-001: society_id (tenant) is mandatory on %', tg_table_name
      using errcode = 'not_null_violation';
  end if;
  return new;
end$$;
comment on function pay_core.tg_require_tenant() is 'BEFORE INSERT: fails a tenant-less insert (no SOC001 default anywhere).';

-- ── Generic: audit capture → pay_audit.change_log (defined in 109) ──────────────────
-- Writes actor + before/after row images as jsonb. Actor identity from the verified JWT.
create or replace function pay_core.tg_pay_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor  text  := coalesce(auth.jwt() ->> 'email', 'system');
  v_new    jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row    jsonb := coalesce(v_new, v_old);
begin
  -- society_id / id read from the row JSON so this trigger works on tables that lack a
  -- society_id column (e.g. component_version, which inherits tenancy via its catalog parent).
  insert into pay_audit.change_log(id, society_id, entity_schema, entity_table, entity_id,
                                   op, actor_email, before_row, after_row, occurred_at)
  values (gen_random_uuid(),
          nullif(v_row ->> 'society_id','')::uuid,
          tg_table_schema, tg_table_name,
          nullif(v_row ->> 'id','')::uuid,
          tg_op, v_actor, v_old, v_new, now());
  return case when tg_op = 'DELETE' then old else new end;
end$$;
comment on function pay_core.tg_pay_audit() is 'AFTER I/U/D: appends an immutable audit row. PII tables mask separately at the app read layer.';

-- ── Generic: version-envelope supersede guard (config tables) ───────────────────────
-- Enforces: an ACTIVE version cannot be UPDATEd in place except to transition status to
-- 'superseded'/'retired' (append-only versioning — Phase-3 §H). New value = new row.
create or replace function pay_core.tg_version_immutable()
returns trigger language plpgsql as $$
begin
  if old.status = 'active'
     and new.status = 'active'
     and (to_jsonb(new) - 'updated_at' - 'updated_by') is distinct from (to_jsonb(old) - 'updated_at' - 'updated_by') then
    raise exception 'PAY-BUS-260: active config version % is immutable; create a new version to change it',
          old.id using errcode = 'restrict_violation';
  end if;
  return new;
end$$;
comment on function pay_core.tg_version_immutable() is 'BEFORE UPDATE on config tables: active versions are immutable; changes go to a new version.';

-- =====================================================================================
-- BUSINESS FUNCTION SIGNATURES  (bodies intentionally NOT implemented — Phase 5+)
-- Each returns/raises a stub so the object exists, dependencies compile, and the contract
-- is fixed. Implementation is a later phase; these must beat their golden vectors to ship.
-- =====================================================================================

-- Numbering: allocate the next per-society document number for a payroll series
-- (wraps the platform document-numbering authority — ADR-0005 — no client max+1).
create or replace function pay_calc.next_pay_number(p_society_id uuid, p_series text)
returns text language plpgsql as $$
begin raise exception 'not implemented (Phase 5): delegates to public.next_document_number'; end$$;

-- Config resolution: resolve one setting for an employee at a date over the 9-level hierarchy
-- (SAD §4 precedence: scope specificity → effective recency → version; set-valued = compose).
create or replace function pay_config.resolve_setting(p_key text, p_employee_id uuid, p_as_of date)
returns jsonb language plpgsql stable as $$
begin raise exception 'not implemented (Phase 5): layered scope resolution'; end$$;

-- Rule resolution: point-in-time, jurisdiction-scoped rule value (extends rules/engine.ts).
create or replace function pay_rule.resolve_rule(p_key text, p_jurisdiction text, p_as_of date, p_attrs jsonb)
returns jsonb language plpgsql stable as $$
begin raise exception 'not implemented (Phase 5): most-specific-then-most-recent, null=refuse'; end$$;

-- Formula: validate a version''s DAG (cycle detection) before it may go active.
create or replace function pay_formula.validate_dag(p_formula_version_id uuid)
returns boolean language plpgsql stable as $$
begin raise exception 'not implemented (Phase 5): topological check, refuse on cycle'; end$$;

-- Run: freeze the ruleset+plan+config into pay_calc.run_snapshot at Draft (reproducibility).
create or replace function pay_calc.freeze_run_snapshot(p_pay_run_id uuid)
returns uuid language plpgsql as $$
begin raise exception 'not implemented (Phase 5): server compute freezes the snapshot'; end$$;

-- Run: state-machine transition guard (Draft→Verified→Approved→Locked→Posted→Paid / Cancel / Rollback)
-- enforcing SoD (maker≠checker), approval matrix, and FY/period lock.
create or replace function pay_calc.transition_run(p_pay_run_id uuid, p_to pay_core.pay_run_state, p_actor uuid, p_note text)
returns void language plpgsql as $$
begin raise exception 'not implemented (Phase 5): guarded transition + pay_event append'; end$$;

-- Posting: emit the balanced engine voucher(s) for a POSTED run into the reused ledger.
create or replace function pay_calc.post_run(p_pay_run_id uuid)
returns uuid language plpgsql as $$
begin raise exception 'not implemented (Phase 5): freeze legs → engine voucher → ledger_events'; end$$;

-- Projection: (re)build ytd_cumulative / registers for a period from the event journal.
create or replace function pay_projection.rebuild(p_society_id uuid, p_period pay_core.period_ym)
returns void language plpgsql as $$
begin raise exception 'not implemented (Phase 5): projection rebuild from pay_event'; end$$;
