-- 048 down · drop the godowns branch policies (column + tenant/role policies untouched).
begin;
  drop policy if exists godowns_branch_select on public.godowns;
  drop policy if exists godowns_branch_insert on public.godowns;
  drop policy if exists godowns_branch_update on public.godowns;
  drop policy if exists godowns_branch_delete on public.godowns;
commit;
