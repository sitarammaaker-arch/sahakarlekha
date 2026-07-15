-- 044 · branch-scoped WRITE RLS — vouchers / sales / purchases / members (ECR-17, the follow-up
-- migration 039 promised: "write-side branch gating is a follow-up").
--
-- THE GAP THIS CLOSES: 039 stops a branch-restricted user from READING other branches' rows, but
-- the write path is still wide open — with a captured JWT and the REST endpoint they can INSERT
-- rows into another branch, UPDATE/soft-delete another branch's vouchers, or move a row across
-- branches. These policies make the server itself refuse out-of-branch mutations.
--
-- ⚠️ DEPLOY TIMING: run this only after 038+039 have soaked a few days — a fresh login as each
-- kind of user (restricted, unrestricted, admin) must have shown clean saves under the SELECT
-- policies first. Rollback any time: 044_branch_scoped_rls_writes_down.sql.
--
-- REQUIRES 038 (claim) + 039 (jwt_branch_ok). Semantics identical to the SELECT side:
--   * no `user_branch_id` claim → fail OPEN (mutation allowed). Unrestricted users, old tokens,
--     the JWT-less platform-admin path and the service role are never blocked.
--   * claim present → the row being written must be in the caller's branch scope:
--       INSERT: the NEW row's "branchId" must pass jwt_branch_ok (the client already stamps the
--               restricted user's branch into the base upsert — PR #166).
--       UPDATE: both the EXISTING row (using) and the NEW values (with check) must pass — so a
--               restricted user can neither touch an out-of-branch row nor move one out of scope.
--               Soft-deletes (isDeleted=true) are UPDATEs, so they are covered too.
--       DELETE: the existing row must pass.
--
-- MECHANICS: `AS RESTRICTIVE`, so these AND onto the existing permissive tenant/role policies
-- (029-032) and compose with 039's SELECT policies — nothing existing is touched. Upserts hit the
-- INSERT policy on the insert path and the UPDATE policies on the conflict path; both use the
-- same predicate, so behaviour is consistent.

begin;
  -- vouchers
  drop policy if exists vouchers_branch_insert on public.vouchers;
  create policy vouchers_branch_insert on public.vouchers
    as restrictive for insert with check (jwt_branch_ok("branchId"));
  drop policy if exists vouchers_branch_update on public.vouchers;
  create policy vouchers_branch_update on public.vouchers
    as restrictive for update using (jwt_branch_ok("branchId")) with check (jwt_branch_ok("branchId"));
  drop policy if exists vouchers_branch_delete on public.vouchers;
  create policy vouchers_branch_delete on public.vouchers
    as restrictive for delete using (jwt_branch_ok("branchId"));

  -- sales
  drop policy if exists sales_branch_insert on public.sales;
  create policy sales_branch_insert on public.sales
    as restrictive for insert with check (jwt_branch_ok("branchId"));
  drop policy if exists sales_branch_update on public.sales;
  create policy sales_branch_update on public.sales
    as restrictive for update using (jwt_branch_ok("branchId")) with check (jwt_branch_ok("branchId"));
  drop policy if exists sales_branch_delete on public.sales;
  create policy sales_branch_delete on public.sales
    as restrictive for delete using (jwt_branch_ok("branchId"));

  -- purchases
  drop policy if exists purchases_branch_insert on public.purchases;
  create policy purchases_branch_insert on public.purchases
    as restrictive for insert with check (jwt_branch_ok("branchId"));
  drop policy if exists purchases_branch_update on public.purchases;
  create policy purchases_branch_update on public.purchases
    as restrictive for update using (jwt_branch_ok("branchId")) with check (jwt_branch_ok("branchId"));
  drop policy if exists purchases_branch_delete on public.purchases;
  create policy purchases_branch_delete on public.purchases
    as restrictive for delete using (jwt_branch_ok("branchId"));

  -- members
  drop policy if exists members_branch_insert on public.members;
  create policy members_branch_insert on public.members
    as restrictive for insert with check (jwt_branch_ok("branchId"));
  drop policy if exists members_branch_update on public.members;
  create policy members_branch_update on public.members
    as restrictive for update using (jwt_branch_ok("branchId")) with check (jwt_branch_ok("branchId"));
  drop policy if exists members_branch_delete on public.members;
  create policy members_branch_delete on public.members
    as restrictive for delete using (jwt_branch_ok("branchId"));
commit;
