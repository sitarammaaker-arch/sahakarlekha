-- =====================================================================================
-- 114_GATE_TEST.sql — behavioural proof of the AAL2 gate predicate (ADR-0012 · task 5).
-- Self-managed (begin…rollback). Requires 114 applied (creates pay_core.jwt_is_aal2()).
-- Simulates an authenticated session's JWT via request.jwt.claims and asserts the exact predicate
-- every one of the 18 RESTRICTIVE policies ANDs in: aal1 → denied (false), aal2 → allowed (true).
-- Deterministic (pure SQL, no timing, no seed data). Complements the live token proof
-- (scripts/test-pay-aal-claim.mjs, which shows a REAL Supabase JWT transitions aal1→aal2).
-- Run: node scripts/pay-apply.mjs supabase/migrations/payroll/114_GATE_TEST.sql
-- =====================================================================================
begin;

-- an aal1 (password-only) session must NOT satisfy the gate
set local request.jwt.claims = '{"role":"authenticated","aal":"aal1","sub":"00000000-0000-0000-0000-000000000001"}';
do $$ begin
  if pay_core.jwt_is_aal2() then raise exception 'GATE FAIL: aal1 session wrongly satisfied the aal2 gate'; end if;
end $$;

-- a missing/indeterminate aal must NOT satisfy the gate (fail-closed)
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}';
do $$ begin
  if pay_core.jwt_is_aal2() then raise exception 'GATE FAIL: aal-absent session wrongly satisfied the aal2 gate'; end if;
end $$;

-- an aal2 (second-factor-completed) session satisfies the gate
set local request.jwt.claims = '{"role":"authenticated","aal":"aal2","sub":"00000000-0000-0000-0000-000000000001"}';
do $$ begin
  if not pay_core.jwt_is_aal2() then raise exception 'GATE FAIL: aal2 session did not satisfy the gate'; end if;
  raise notice 'AAL2 gate predicate OK — aal1 denied, aal-absent denied (fail-closed), aal2 allowed.';
end $$;

rollback;
