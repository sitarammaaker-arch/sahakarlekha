-- =====================================================================================
-- Migration 114 DOWN — remove the AAL2 gate (ADR-0012 · task 3). Fully reversible.
-- Drops the RESTRICTIVE aal2 policies and the helper. Base tenant/role/branch/PII policies (110)
-- are untouched, so removing this gate returns exactly to the pre-114 posture.
-- =====================================================================================

do $$
declare fq text; sch text; tbl text;
begin
  foreach fq in array array[
    'pay_calc.pay_event','pay_calc.posting_link',
    'pay_calc.statutory_liability','pay_calc.challan','pay_calc.return_filing','pay_calc.statutory_certificate',
    'pay_calc.payment_batch','pay_calc.payment_line']::text[]
  loop
    sch := split_part(fq,'.',1); tbl := split_part(fq,'.',2);
    execute format('drop policy if exists %I on %I.%I', tbl||'_aal2_ins', sch, tbl);
    execute format('drop policy if exists %I on %I.%I', tbl||'_aal2_upd', sch, tbl);
  end loop;
end$$;

drop policy if exists statutory_identity_aal2 on pay_core.statutory_identity;
drop policy if exists bank_mandate_aal2 on pay_core.bank_mandate;

drop function if exists pay_core.jwt_is_aal2();
