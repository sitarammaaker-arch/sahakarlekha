-- =====================================================================================
-- 114_VERIFY.sql — structural verification of the AAL2 gate (ADR-0012 · task 3).
-- Self-managed (begin…rollback): asserts the RESTRICTIVE aal2 policies exist on exactly the intended
-- objects, and the helper is present. RAISEs (aborts the run) on any gap. Does NOT verify runtime
-- behaviour (aal1 denied / aal2 allowed) — that needs native MFA (task 1) + an enrolled factor.
-- Run: node scripts/pay-apply.mjs supabase/migrations/payroll/114_VERIFY.sql
-- =====================================================================================
begin;
do $$
declare
  n_ins int; n_upd int; n_pii int; n_fn int;
begin
  -- 8 financial tables × insert + 8 × update = 8 + 8; 2 PII selects
  select count(*) into n_ins from pg_policies
    where schemaname='pay_calc' and policyname like '%\_aal2\_ins' escape '\' and permissive='RESTRICTIVE' and cmd='INSERT';
  select count(*) into n_upd from pg_policies
    where schemaname='pay_calc' and policyname like '%\_aal2\_upd' escape '\' and permissive='RESTRICTIVE' and cmd='UPDATE';
  select count(*) into n_pii from pg_policies
    where schemaname='pay_core' and policyname in ('statutory_identity_aal2','bank_mandate_aal2')
      and permissive='RESTRICTIVE' and cmd='SELECT';
  select count(*) into n_fn from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='pay_core' and p.proname='jwt_is_aal2';

  if n_ins <> 8 then raise exception 'AAL2 gate: expected 8 restrictive INSERT policies, found %', n_ins; end if;
  if n_upd <> 8 then raise exception 'AAL2 gate: expected 8 restrictive UPDATE policies, found %', n_upd; end if;
  if n_pii <> 2 then raise exception 'AAL2 gate: expected 2 restrictive PII SELECT policies, found %', n_pii; end if;
  if n_fn  <> 1 then raise exception 'AAL2 gate: helper pay_core.jwt_is_aal2() missing'; end if;

  raise notice 'AAL2 gate OK — % INSERT + % UPDATE + % PII SELECT restrictive policies + helper present (18 total).', n_ins, n_upd, n_pii;
end$$;
rollback;
