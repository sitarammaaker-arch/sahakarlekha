-- 116 · Member admission record (member-area audit M2, 2026-10-16).
--
-- WHY: Haryana Co-operative Societies Rules 1989 r.17 — an application is decided within one month of its receipt and
-- a refusal is communicated with its reasons; Act 1984 s.16 (first proviso) — a PACS applicant is deemed admitted
-- 60 days after the application reaches the society; r.22(b) — the register records the date of entry. The app kept
-- none of these: no application date, no admission date or committee resolution, no reason for a refusal.
--
-- WHAT: six nullable text columns on members. Nothing else changes; no existing row is touched (all start NULL —
-- for older rows the app falls back to "joinDate" as the application date). The app writes these in a separate
-- step-2 update after the member row is saved, so members keep saving before this migration runs (RULE 1).
-- Undo: 116_member_admission_down.sql.

begin;

alter table public.members add column if not exists "applicationDate"         text;
alter table public.members add column if not exists "admissionDate"           text;
alter table public.members add column if not exists "admissionResolutionNo"   text;
alter table public.members add column if not exists "admissionResolutionDate" text;
alter table public.members add column if not exists "rejectionReason"         text;
alter table public.members add column if not exists "decidedAt"               text;

insert into public.app_migrations (version, name) values ('116', 'member_admission')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
