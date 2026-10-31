-- 150 down · restore the 039/048 per-row branch SELECT policies. jwt_branch_is_head_office() is left in
-- place (harmless, unreferenced after this) so a re-run of 150 needs nothing else.
begin;
  drop policy if exists vouchers_branch_select on public.vouchers;
  create policy vouchers_branch_select on public.vouchers
    as restrictive for select using (jwt_branch_ok("branchId"));

  drop policy if exists sales_branch_select on public.sales;
  create policy sales_branch_select on public.sales
    as restrictive for select using (jwt_branch_ok("branchId"));

  drop policy if exists purchases_branch_select on public.purchases;
  create policy purchases_branch_select on public.purchases
    as restrictive for select using (jwt_branch_ok("branchId"));

  drop policy if exists members_branch_select on public.members;
  create policy members_branch_select on public.members
    as restrictive for select using (jwt_branch_ok("branchId"));

  drop policy if exists godowns_branch_select on public.godowns;
  create policy godowns_branch_select on public.godowns
    as restrictive for select using (jwt_branch_ok("branchId"));
commit;
