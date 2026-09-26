-- ============================================================
-- SahakarLekha — member_distribution_runs: the per-member breakdown of a year-end distribution
-- (dividend / patronage / bonus) for ANY society type. Run in Supabase SQL Editor.
--
-- Why: the general Profit Distribution posted ONE dividend voucher (Dr 1208 / Cr 1211) and kept no
-- per-member record; at payment time each member's share was recomputed from THAT DAY's share
-- capital, so a share change between posting and payment silently changed the split, and the
-- dividend could not be shown on Member-360 or the member portal. A run stores each member's line
-- (member, base, amount) at posting time, computed by the shared distribution engine.
--
-- The voucher stays the authority: a run is honoured only while its voucherId is a live dividend
-- voucher (the page checks), so a run can never create or hide money on its own.
--
-- Tenant-scoped RLS exactly like 063 / 030 / 031: own society; writes need jwt_can_write(),
-- deletes jwt_can_delete(). No permissive policy.
-- ============================================================

begin;

create table if not exists public.member_distribution_runs (
  id           text primary key,
  society_id   text not null,
  "fyLabel"    text not null,
  kind         text not null check (kind in ('dividend', 'patronage', 'bonus')),
  basis        text not null default 'share_capital',
  "ratePct"    numeric,
  total        numeric not null default 0,
  lines        jsonb not null default '[]',
  status       text not null default 'approved' check (status in ('draft', 'approved')),
  "voucherId"  text,
  source       text not null default 'posted' check (source in ('posted', 'snapshot')),
  "createdBy"  text,
  "createdAt"  timestamptz not null default now(),
  "isDeleted"  boolean not null default false
);

-- One live run per society + FY + kind (a re-post replaces the orphan of a failed post).
create unique index if not exists member_distribution_runs_one_live
  on public.member_distribution_runs (society_id, "fyLabel", kind) where not "isDeleted";

alter table public.member_distribution_runs enable row level security;

drop policy if exists member_distribution_runs_tenant_select on public.member_distribution_runs;
drop policy if exists member_distribution_runs_tenant_insert on public.member_distribution_runs;
drop policy if exists member_distribution_runs_tenant_update on public.member_distribution_runs;
drop policy if exists member_distribution_runs_tenant_delete on public.member_distribution_runs;

create policy member_distribution_runs_tenant_select on public.member_distribution_runs
  for select using (society_id::text = get_current_society_id());
create policy member_distribution_runs_tenant_insert on public.member_distribution_runs
  for insert with check ((society_id::text = get_current_society_id()) and jwt_can_write());
create policy member_distribution_runs_tenant_update on public.member_distribution_runs
  for update using ((society_id::text = get_current_society_id()) and jwt_can_write())
  with check ((society_id::text = get_current_society_id()) and jwt_can_write());
create policy member_distribution_runs_tenant_delete on public.member_distribution_runs
  for delete using ((society_id::text = get_current_society_id()) and jwt_can_delete());

commit;

-- ── Verify (run after) ──
-- 1. Table + RLS on + exactly 4 tenant policies, none permissive (expect: true, 4, 0):
--    select c.relrowsecurity,
--           (select count(*) from pg_policies where tablename = 'member_distribution_runs') as policies,
--           (select count(*) from pg_policies where tablename = 'member_distribution_runs'
--              and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')) as permissive
--    from pg_class c where c.relname = 'member_distribution_runs';
-- 2. The one-live-run index exists (expect: 1 row):
--    select indexname from pg_indexes where indexname = 'member_distribution_runs_one_live';
