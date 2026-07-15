-- 039 DOWN · drop the branch-scoped SELECT policies + helpers. Restores the pre-039 state exactly
-- (the permissive tenant/role policies from 029–032 were never touched, so nothing to recreate).
-- The "branchId" columns are left in place — they predate 039 (ECR-17 Phase 4, supabase-tables.sql)
-- and live client data references them.

begin;
  drop policy if exists vouchers_branch_select  on public.vouchers;
  drop policy if exists sales_branch_select     on public.sales;
  drop policy if exists purchases_branch_select on public.purchases;
  drop policy if exists members_branch_select   on public.members;
commit;

drop function if exists public.jwt_branch_ok(text);
drop function if exists public.jwt_branch_id();
