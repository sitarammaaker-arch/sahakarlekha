-- DRAFT — NOT APPLIED. Phase 1 of docs/reports-audit/design/MEMBER-PII-ROLE-SCOPED-READ.md
-- Additive only: creates a role-scoped table and copies PII into it. No existing read/write changes.
-- Run only after founder sign-off, on STAGING first. Whole file is one transaction.
-- Pattern copied from migrations 029-031 (jwt_* helpers, get_current_society_id()).
-- ⚠ society_id is mixed uuid/text across tables (memory: p1-sec-1-rls-live) → always compare ::text.

begin;

create table if not exists public.member_identity (
  society_id  text not null,
  member_id   text not null,
  aadhaar     text,
  pan         text,
  updated_at  timestamptz not null default now(),
  primary key (society_id, member_id)
);

alter table public.member_identity enable row level security;

-- Who may READ identity data. NOTE: confirm the helper below exists in prod
-- (jwt_can_write() = admin + accountant, migration 029). Secretary/manager need their own
-- check — decision #1 in the design note; until then this matches jwt_can_write().
drop policy if exists mi_select on public.member_identity;
create policy mi_select on public.member_identity for select
  using (society_id::text = get_current_society_id()::text and jwt_can_write());

drop policy if exists mi_insert on public.member_identity;
create policy mi_insert on public.member_identity for insert
  with check (society_id::text = get_current_society_id()::text and jwt_can_write());

drop policy if exists mi_update on public.member_identity;
create policy mi_update on public.member_identity for update
  using (society_id::text = get_current_society_id()::text and jwt_can_write())
  with check (society_id::text = get_current_society_id()::text and jwt_can_write());

drop policy if exists mi_delete on public.member_identity;
create policy mi_delete on public.member_identity for delete
  using (society_id::text = get_current_society_id()::text and jwt_can_delete());

-- Backfill (idempotent). members.id / society_id column names: VERIFY against prod before running.
insert into public.member_identity (society_id, member_id, aadhaar, pan)
select m.society_id::text, m.id::text, nullif(m.aadhaar, ''), nullif(m.pan, '')
from public.members m
where coalesce(m.aadhaar, '') <> '' or coalesce(m.pan, '') <> ''
on conflict (society_id, member_id) do update
  set aadhaar = excluded.aadhaar, pan = excluded.pan, updated_at = now();

commit;

-- VERIFY (read-only):
--   select count(*) from members where coalesce(aadhaar,'')<>'' or coalesce(pan,'')<>'';
--   select count(*) from member_identity;                       -- must be equal
--   -- as a viewer-role JWT: select * from member_identity;      -- must return 0 rows
-- ROLLBACK: drop table public.member_identity;
