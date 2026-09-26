-- 069 down · drop loan_interest_accruals. The accrual VOUCHERS stay (they are the authority); only
-- the per-loan breakdown is lost, and the Loan Interest page then refuses to post until 069 is re-run.
begin;
drop policy if exists loan_interest_accruals_tenant_select on public.loan_interest_accruals;
drop policy if exists loan_interest_accruals_tenant_insert on public.loan_interest_accruals;
drop policy if exists loan_interest_accruals_tenant_update on public.loan_interest_accruals;
drop policy if exists loan_interest_accruals_tenant_delete on public.loan_interest_accruals;
drop table if exists public.loan_interest_accruals;
commit;
