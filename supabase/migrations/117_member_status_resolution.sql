-- 117 · Member status resolution (member-area audit M4, 2026-10-17).
--
-- WHY: Haryana Co-operative Societies Rules 1989 r.19 — a member is expelled by a resolution of a general meeting
-- (two-thirds of members present and entitled to vote); Model Bye-laws cl.7(10) — a withdrawal is accepted by a
-- Board resolution. The app recorded the reason and (now) the effective date of a lifecycle change, but not the
-- resolution behind it.
--
-- WHAT: two nullable text columns on members. No existing row is touched. The app writes them in their own update
-- after the status change, so the status change keeps working before this migration runs (RULE 1).
-- Undo: 117_member_status_resolution_down.sql.

begin;

alter table public.members add column if not exists "statusResolutionNo"   text;
alter table public.members add column if not exists "statusResolutionDate" text;

insert into public.app_migrations (version, name) values ('117', 'member_status_resolution')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
