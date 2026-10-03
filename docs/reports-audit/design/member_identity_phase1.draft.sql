-- DRAFT v2 — NOT APPLIED. Phase 1 of docs/reports-audit/design/MEMBER-PII-ROLE-SCOPED-READ.md
-- Additive only: creates a role-scoped table and copies PII into it. No existing read/write changes.
-- Run only after founder sign-off, on STAGING first. One transaction.
--
-- Verified read-only against PROD (rwffxupenwdtrmyabytk) on 2026-10-03:
--   * members.id / members.society_id are TEXT; aadhaar, pan are TEXT.
--   * members policies use  society_id IN (SELECT current_user_society_ids())  — reused below.
--   * public.jwt_can_write() is TOO BROAD for PII (admin, accountant, societyAdmin, manager, cashier,
--     storeKeeper, procurementOfficer, salesOperator, secretary, employee, dataEntry, boardMember,
--     chairman) AND returns TRUE when the role claim is NULL (fail-open). NOT reused here.
--   * member_identity does not exist yet. 507 members, only 2 have aadhaar/pan filled.

begin;

-- Dedicated, explicit, FAIL-CLOSED gate. A token with no role claim sees no PII (the app then shows
-- masked values — graceful), which is the safe direction for identity data.
-- ROLE LIST = founder decision #1/#2 in the design note; this is the conservative default.
create or replace function public.jwt_can_read_pii() returns boolean
  language sql stable set search_path to 'public'
as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('admin', 'societyAdmin', 'accountant', 'secretary', 'manager');
$$;
grant execute on function public.jwt_can_read_pii() to authenticated;

create table if not exists public.member_identity (
  society_id  text not null,
  member_id   text not null,
  aadhaar     text,
  pan         text,
  updated_at  timestamptz not null default now(),
  primary key (society_id, member_id)
);

alter table public.member_identity enable row level security;

drop policy if exists mi_select on public.member_identity;
create policy mi_select on public.member_identity for select
  using (society_id in (select current_user_society_ids()) and jwt_can_read_pii());

drop policy if exists mi_insert on public.member_identity;
create policy mi_insert on public.member_identity for insert
  with check (society_id in (select current_user_society_ids()) and jwt_can_read_pii());

drop policy if exists mi_update on public.member_identity;
create policy mi_update on public.member_identity for update
  using (society_id in (select current_user_society_ids()) and jwt_can_read_pii())
  with check (society_id in (select current_user_society_ids()) and jwt_can_read_pii());

drop policy if exists mi_delete on public.member_identity;
create policy mi_delete on public.member_identity for delete
  using (society_id in (select current_user_society_ids()) and jwt_can_delete());

-- Backfill (idempotent).
insert into public.member_identity (society_id, member_id, aadhaar, pan)
select m.society_id, m.id, nullif(m.aadhaar, ''), nullif(m.pan, '')
from public.members m
where coalesce(m.aadhaar, '') <> '' or coalesce(m.pan, '') <> ''
on conflict (society_id, member_id) do update
  set aadhaar = excluded.aadhaar, pan = excluded.pan, updated_at = now();

commit;

-- VERIFY (read-only):
--   select count(*) from members where coalesce(aadhaar,'')<>'' or coalesce(pan,'')<>'';   -- 2 on prod 2026-10-03
--   select count(*) from member_identity;                                                  -- must equal the above
--   -- as a viewer/cashier/boardMember JWT: select * from member_identity;                 -- must return 0 rows
--   -- as admin JWT of society A: must NOT see society B rows
-- ROLLBACK: drop table public.member_identity; drop function public.jwt_can_read_pii();
-- NOTE (separate finding): jwt_can_write()/jwt_can_delete() are fail-open on a NULL role claim — see
-- memory m0-preflight-production-facts. Not changed here.
