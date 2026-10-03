-- 106 · member_identity — PAN / Aadhaar moved behind a role-scoped RLS table (audit D-S02/D-S03).
-- Design + rehearsal notes: docs/reports-audit/design/MEMBER-PII-ROLE-SCOPED-READ.md
-- ADDITIVE: creates the table + a fail-closed gate function and copies the existing PII. Nothing is
-- removed from `members` here (that is Phase 3, deliberately later). The app detects this table at
-- load; until it exists the app runs in legacy mode, so this can be applied at any time.
-- Hand-run (Supabase SQL Editor): run on STAGING first, check the VERIFY block, then prod.
-- Rehearsed 2026-10-03 on staging in a rolled-back transaction (visibility per role, tenant isolation,
-- null-role fail-closed, backfill count) — all as expected.
--
-- society_id/id are TEXT on prod members. jwt_can_write() is NOT reused: it admits cashier/dataEntry/…
-- and is TRUE on a NULL role claim.

begin;

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

insert into public.member_identity (society_id, member_id, aadhaar, pan)
select m.society_id, m.id, nullif(m.aadhaar, ''), nullif(m.pan, '')
from public.members m
where coalesce(m.aadhaar, '') <> '' or coalesce(m.pan, '') <> ''
on conflict (society_id, member_id) do update
  set aadhaar = excluded.aadhaar, pan = excluded.pan, updated_at = now();

insert into public.app_migrations (version, name) values ('106', 'member_identity')
  on conflict (version) do nothing;

commit;

-- VERIFY (read-only):
--   select count(*) from members where coalesce(aadhaar,'')<>'' or coalesce(pan,'')<>'';   -- (2 on prod 2026-10-03)
--   select count(*) from member_identity;                                                  -- must be equal
--   -- as a cashier/viewer/boardMember JWT: select * from member_identity;                 -- 0 rows
