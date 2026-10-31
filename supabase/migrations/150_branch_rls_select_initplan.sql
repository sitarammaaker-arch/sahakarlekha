-- 150 · Branch SELECT policies evaluated ONCE per query, not once per row (2026-10-31, login read-load S1).
--
-- WHY: the restrictive SELECT policies from 039/048 call jwt_branch_ok("branchId"). That function is
--   SECURITY DEFINER with its own search_path, so Postgres cannot inline it into the query: it runs the
--   function — and the JWT parse inside it — for EVERY row. Measured on staging (1,174 vouchers): the
--   sign-in read takes 1–2 ms without RLS and ~50 ms with it; sales 1 → 18 ms. The cost grows with every
--   voucher. See docs/perf/LOGIN-READ-LOAD-2026-10-31.md §3.2.
--
-- WHAT: the same rule, written so every caller-dependent part is a `(select …)` with no row reference.
--   Postgres runs each of those once per query (an InitPlan) and then only compares "branchId" per row.
--     jwt_branch_ok(b) =  jwt_branch_id() is null
--                      or b = jwt_branch_id()
--                      or (b is null and <caller's branch is the Head Office>)
--   The Head-Office lookup moves into jwt_branch_is_head_office() (no row argument, SECURITY DEFINER like
--   before, so it still ignores branches' own RLS). Truth table identical, NULLs included.
--
-- SCOPE: the five SELECT policies only (vouchers, sales, purchases, members, godowns) — the read path.
--   INSERT/UPDATE/DELETE policies (044/048) and jwt_branch_ok() itself are untouched.
--
-- SAFE: no data change; the rows each user may read are exactly the same (proved on staging per caller
--   kind — no claim, Head-Office branch, other branch, unknown branch — before vs after, in a rolled-back
--   transaction). Rollback: 150_branch_rls_select_initplan_down.sql restores the 039/048 policies.

create or replace function public.jwt_branch_is_head_office() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.branches b
    where b.id = jwt_branch_id() and coalesce(b."isHeadOffice", false)
  );
$$;

-- anon-exec: jwt_branch_is_head_office — evaluated inside the branch SELECT policies, which apply to anon too
--   (same as jwt_branch_ok in 039); without EXECUTE an anon read of these tables would error instead of
--   returning nothing. It reveals one boolean about the caller's OWN branch claim (anon has none → false).
grant execute on function public.jwt_branch_is_head_office() to authenticated, anon;

begin;
  drop policy if exists vouchers_branch_select on public.vouchers;
  create policy vouchers_branch_select on public.vouchers
    as restrictive for select using (
      (select public.jwt_branch_id()) is null
      or "branchId" = (select public.jwt_branch_id())
      or ("branchId" is null and (select public.jwt_branch_is_head_office()))
    );

  drop policy if exists sales_branch_select on public.sales;
  create policy sales_branch_select on public.sales
    as restrictive for select using (
      (select public.jwt_branch_id()) is null
      or "branchId" = (select public.jwt_branch_id())
      or ("branchId" is null and (select public.jwt_branch_is_head_office()))
    );

  drop policy if exists purchases_branch_select on public.purchases;
  create policy purchases_branch_select on public.purchases
    as restrictive for select using (
      (select public.jwt_branch_id()) is null
      or "branchId" = (select public.jwt_branch_id())
      or ("branchId" is null and (select public.jwt_branch_is_head_office()))
    );

  drop policy if exists members_branch_select on public.members;
  create policy members_branch_select on public.members
    as restrictive for select using (
      (select public.jwt_branch_id()) is null
      or "branchId" = (select public.jwt_branch_id())
      or ("branchId" is null and (select public.jwt_branch_is_head_office()))
    );

  drop policy if exists godowns_branch_select on public.godowns;
  create policy godowns_branch_select on public.godowns
    as restrictive for select using (
      (select public.jwt_branch_id()) is null
      or "branchId" = (select public.jwt_branch_id())
      or ("branchId" is null and (select public.jwt_branch_is_head_office()))
    );
commit;

-- VERIFY (expect 5 rows, each qual mentioning jwt_branch_is_head_office and none mentioning jwt_branch_ok):
-- select tablename, policyname, qual from pg_policies
--  where policyname in ('vouchers_branch_select','sales_branch_select','purchases_branch_select',
--                       'members_branch_select','godowns_branch_select') order by tablename;
