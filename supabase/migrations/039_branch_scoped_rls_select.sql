-- 039 · branch-scoped SELECT RLS — vouchers / sales / purchases / members (ECR-17 server-side).
--
-- THE GAP THIS CLOSES: society_users.branch_id was enforced client-side only. A branch-restricted
-- user's DataContext still bulk-loads EVERY branch's rows, and pages that read the raw arrays
-- (Vouchers, DayBook, Ledger, BankReconciliation, GSTR9, SaleManagement, …) show other branches'
-- data. These policies make the server itself refuse to return out-of-branch rows.
--
-- REQUIRES 038 first (the hook must emit `user_branch_id`). Semantics mirror the client's
-- src/lib/branchScope.ts `matchesBranch` exactly:
--   * no `user_branch_id` claim → fail OPEN (row visible). Covers: unrestricted users, old tokens
--     issued before 038, the JWT-less platform-admin path (SECURITY DEFINER RPCs + anon), and the
--     service-role backup Edge Function (bypasses RLS anyway). No one can be locked out.
--   * claim present → row visible iff row."branchId" = claim, OR the row is unbranched
--     ("branchId" IS NULL = legacy/Head-Office data) AND the claim's branch IS the Head Office.
--
-- MECHANICS: the policies are `AS RESTRICTIVE`, so they AND onto the existing permissive
-- tenant/role policies (029–032) without touching them — SELECT must pass tenant AND branch.
-- Mutations are NOT branch-gated in this slice (INSERT/UPDATE/DELETE policies unchanged); the
-- client stamps new rows with the restricted branch, and write-side branch gating is a follow-up.
--
-- ROLLOUT:
--   1. Run 038, verify the claim (its steps 2–3).
--   2. Run this file.
--   3. As a branch-restricted user (fresh login!), confirm Vouchers/DayBook show only their
--      branch + Head-Office-legacy rows per the head-office rule, and a NEW voucher/sale/member
--      still saves and remains visible after F5.
--   4. As an unrestricted admin, confirm consolidated ("all branches") views are unchanged.
--   5. Rollback any time: 039_branch_scoped_rls_select_down.sql (drops only these policies).

-- The branch columns these policies read (idempotent re-assertion of supabase-tables.sql, so this
-- file is self-sufficient and the policies can never reference a missing column).
alter table vouchers  add column if not exists "branchId" text;
alter table sales     add column if not exists "branchId" text;
alter table purchases add column if not exists "branchId" text;
alter table members   add column if not exists "branchId" text;

-- The JWT's branch claim ('' normalised to NULL = unrestricted).
create or replace function public.jwt_branch_id() returns text
language sql stable set search_path = public as $$
  select nullif(auth.jwt() ->> 'user_branch_id', '');
$$;

-- Is a row with this "branchId" visible to the caller? Mirrors matchesBranch():
-- unrestricted → yes; own branch → yes; unbranched row → only if the caller's branch is the
-- Head Office. SECURITY DEFINER so the branches lookup is independent of branches' own RLS.
create or replace function public.jwt_branch_ok(row_branch text) returns boolean
language sql stable security definer set search_path = public as $$
  select jwt_branch_id() is null
      or row_branch = jwt_branch_id()
      or (row_branch is null and exists (
            select 1 from public.branches b
            where b.id = jwt_branch_id() and coalesce(b."isHeadOffice", false)
         ));
$$;

grant execute on function public.jwt_branch_id() to authenticated, anon;
grant execute on function public.jwt_branch_ok(text) to authenticated, anon;

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
commit;
