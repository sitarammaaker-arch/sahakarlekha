-- 048 · branch-scoped RLS for godowns — the last branchId-carrying table (ECR-17 tail).
--
-- 039 branch-scoped SELECT and 044 branch-scoped writes covered vouchers/sales/purchases/members.
-- `godowns` also carries "branchId" (a warehouse belongs to a branch) but was never branch-scoped,
-- so a branch-restricted user could see/write another branch's godown master. This closes it,
-- mirroring 039+044 exactly and reusing jwt_branch_ok (from 039).
--
-- SAFE BY CONSTRUCTION: these are `AS RESTRICTIVE` policies — they can only ever *narrow*
-- visibility/writes, never widen them, so they compose correctly with whatever tenant/role
-- policies already exist on godowns (P1-SEC-1 tenant isolation + mig 030 role gating) without
-- depending on their exact shape. Fail-OPEN on a missing branch claim (unrestricted users, old
-- tokens, JWT-less platform admin, service role) — mirrors matchesBranch / the other four tables.
-- REQUIRES 039 (jwt_branch_ok). Reversible via 048_down.

alter table godowns add column if not exists "branchId" text;  -- idempotent (policies reference it)

begin;
  drop policy if exists godowns_branch_select on public.godowns;
  create policy godowns_branch_select on public.godowns
    as restrictive for select using (jwt_branch_ok("branchId"));

  drop policy if exists godowns_branch_insert on public.godowns;
  create policy godowns_branch_insert on public.godowns
    as restrictive for insert with check (jwt_branch_ok("branchId"));

  drop policy if exists godowns_branch_update on public.godowns;
  create policy godowns_branch_update on public.godowns
    as restrictive for update using (jwt_branch_ok("branchId")) with check (jwt_branch_ok("branchId"));

  drop policy if exists godowns_branch_delete on public.godowns;
  create policy godowns_branch_delete on public.godowns
    as restrictive for delete using (jwt_branch_ok("branchId"));
commit;
