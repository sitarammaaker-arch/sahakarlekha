-- =====================================================================================
-- Migration 114 — AAL2 (native MFA) gate on consequential payroll surfaces  [ADR-0012 · task 3]
-- -------------------------------------------------------------------------------------
-- PURPOSE : Enforce, IN THE DATABASE, that a completed second factor (session aal2) is required for
--           consequential payroll surfaces — so a password-only (aal1) session cannot reach them
--           even by using its minted JWT directly against PostgREST/RPC (the ADR-0012 threat).
--           RESTRICTIVE, fail-closed: the policy ANDs with the existing tenant/role/branch policies.
--
--   Gated financial WRITES (insert/update):
--     · posting             — pay_calc.pay_event, pay_calc.posting_link
--     · statutory-liability — pay_calc.statutory_liability, challan, return_filing, statutory_certificate
--     · payment/disbursement— pay_calc.payment_batch, pay_calc.payment_line
--   Gated PII READS (select, on top of the existing write-role narrowing in 110):
--     · pay_core.statutory_identity, pay_core.bank_mandate
--
-- AAL CLAIM : Supabase access tokens carry `aal` natively — 'aal1' for password-only, 'aal2' after a
--             factor challenge. A missing/indeterminate aal is NOT 'aal2' → denied (fail-closed).
-- service_role (the compute service / orchestrator) bypasses RLS by design and is unaffected; this
-- gate constrains AUTHENTICATED USER sessions, which is exactly the ADR-0012 threat surface.
--
-- ⚠ DEPLOY ORDERING (load-bearing): apply this ONLY AFTER native Supabase MFA is enabled on the
--   project (ADR-0012 task 1) and enrolled users have factors (task 2). Applied before that, every
--   session is aal1 and these surfaces fail-closed for EVERYONE. On empty staging (no orchestrator,
--   no live users) that is harmless — it is exactly the fail-closed behaviour we verify.
--
-- DEPENDENCIES : 100–110 (tables + base RLS) and Supabase-provided auth.jwt().
-- ROLLBACK     : 114_pay_aal2_gate_down.sql (drops these policies + helper). 999 also drops them
--                with the schemas. This gate is purely additive and fully reversible.
-- VERIFY       : 114_VERIFY.sql — asserts 18 RESTRICTIVE aal2 policies exist on the intended objects.
--                Behavioural verification (aal1 denied / aal2 allowed) needs task-1 native MFA + an
--                enrolled test factor (the deferred T1.7 live-auth harness).
-- =====================================================================================

-- Session-assurance helper: is THIS session AAL2 (a second factor was completed)?
create or replace function pay_core.jwt_is_aal2()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
grant execute on function pay_core.jwt_is_aal2() to authenticated, service_role;

-- ── Financial-write surfaces: require aal2 to INSERT / UPDATE (RESTRICTIVE) ───────────
do $$
declare fq text; sch text; tbl text;
begin
  foreach fq in array array[
    'pay_calc.pay_event','pay_calc.posting_link',
    'pay_calc.statutory_liability','pay_calc.challan','pay_calc.return_filing','pay_calc.statutory_certificate',
    'pay_calc.payment_batch','pay_calc.payment_line']::text[]
  loop
    sch := split_part(fq,'.',1); tbl := split_part(fq,'.',2);
    execute format(
      'create policy %I on %I.%I as restrictive for insert with check (pay_core.jwt_is_aal2())',
      tbl||'_aal2_ins', sch, tbl);
    execute format(
      'create policy %I on %I.%I as restrictive for update using (pay_core.jwt_is_aal2()) with check (pay_core.jwt_is_aal2())',
      tbl||'_aal2_upd', sch, tbl);
  end loop;
end$$;

-- ── PII reads: require aal2 to SELECT (ANDs with the existing write-role narrowing) ───
create policy statutory_identity_aal2 on pay_core.statutory_identity
  as restrictive for select using (pay_core.jwt_is_aal2());
create policy bank_mandate_aal2 on pay_core.bank_mandate
  as restrictive for select using (pay_core.jwt_is_aal2());
