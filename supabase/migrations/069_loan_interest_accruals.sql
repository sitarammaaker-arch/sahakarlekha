-- ============================================================
-- SahakarLekha — loan_interest_accruals: each member loan's accrued interest per period (H2-1).
-- Run in Supabase SQL Editor.
--
-- Why: the Loan Interest page posted ONE accrual journal for all loans and kept no per-loan record,
-- so a repayment could not clear what was accrued for THAT loan (and the same interest could reach
-- income twice). And under the Haryana Co-operative Societies Act 1984, s.87 Explanation (i),
-- interest accrued on OVERDUE amounts must not be taken into net profit — it is now credited to the
-- Overdue Interest Reserve (2211) and each row records whether it was overdue.
--
-- The voucher stays the authority: a row counts only while its voucherId is a live accrual voucher.
-- `recovered` is advanced by repayments (H2-2).
--
-- Tenant-scoped RLS exactly like 066: own society; writes need jwt_can_write(), deletes
-- jwt_can_delete(). No permissive policy.
-- ============================================================

begin;

create table if not exists public.loan_interest_accruals (
  id            text primary key,
  society_id    text not null,
  "loanId"      text not null,
  "memberId"    text,
  "periodFrom"  text not null,
  "periodTo"    text not null,
  days          integer not null default 0,
  outstanding   numeric not null default 0,
  "ratePa"      numeric not null default 0,
  amount        numeric not null default 0,
  overdue       boolean not null default false,
  recovered     numeric not null default 0,
  "voucherId"   text,
  "createdBy"   text,
  "createdAt"   timestamptz not null default now(),
  "isDeleted"   boolean not null default false
);

-- One live accrual per loan per period (a re-post after a failed one replaces the orphan).
create unique index if not exists loan_interest_accruals_one_live
  on public.loan_interest_accruals (society_id, "loanId", "periodFrom", "periodTo") where not "isDeleted";
create index if not exists loan_interest_accruals_loan_idx
  on public.loan_interest_accruals (society_id, "loanId");

alter table public.loan_interest_accruals enable row level security;

drop policy if exists loan_interest_accruals_tenant_select on public.loan_interest_accruals;
drop policy if exists loan_interest_accruals_tenant_insert on public.loan_interest_accruals;
drop policy if exists loan_interest_accruals_tenant_update on public.loan_interest_accruals;
drop policy if exists loan_interest_accruals_tenant_delete on public.loan_interest_accruals;

create policy loan_interest_accruals_tenant_select on public.loan_interest_accruals
  for select using (society_id::text = get_current_society_id());
create policy loan_interest_accruals_tenant_insert on public.loan_interest_accruals
  for insert with check ((society_id::text = get_current_society_id()) and jwt_can_write());
create policy loan_interest_accruals_tenant_update on public.loan_interest_accruals
  for update using ((society_id::text = get_current_society_id()) and jwt_can_write())
  with check ((society_id::text = get_current_society_id()) and jwt_can_write());
create policy loan_interest_accruals_tenant_delete on public.loan_interest_accruals
  for delete using ((society_id::text = get_current_society_id()) and jwt_can_delete());

commit;

-- ── Verify (run after) ──
-- 1. Table + RLS on + exactly 4 tenant policies, none permissive (expect: true, 4, 0):
--    select c.relrowsecurity,
--           (select count(*) from pg_policies where tablename = 'loan_interest_accruals') as policies,
--           (select count(*) from pg_policies where tablename = 'loan_interest_accruals'
--              and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')) as permissive
--    from pg_class c where c.relname = 'loan_interest_accruals';
-- 2. The one-live-accrual index exists (expect: 1 row):
--    select indexname from pg_indexes where indexname = 'loan_interest_accruals_one_live';
