-- 044 down · drop ONLY the write-side branch policies (SELECT policies from 039 stay).
begin;
  drop policy if exists vouchers_branch_insert  on public.vouchers;
  drop policy if exists vouchers_branch_update  on public.vouchers;
  drop policy if exists vouchers_branch_delete  on public.vouchers;
  drop policy if exists sales_branch_insert     on public.sales;
  drop policy if exists sales_branch_update     on public.sales;
  drop policy if exists sales_branch_delete     on public.sales;
  drop policy if exists purchases_branch_insert on public.purchases;
  drop policy if exists purchases_branch_update on public.purchases;
  drop policy if exists purchases_branch_delete on public.purchases;
  drop policy if exists members_branch_insert   on public.members;
  drop policy if exists members_branch_update   on public.members;
  drop policy if exists members_branch_delete   on public.members;
commit;
