-- 118 · Member gender + date of birth (member-area audit M5, 2026-10-17).
--
-- WHY: Haryana Co-operative Societies Act 1984 s.28(1) (2013 amendment) — every committee has at least two women
-- (and one SC; one BC when BC members are ≥ 10%). The app had caste but no gender, so the women count behind the
-- reservation could not be produced. A date of birth keeps the age current (a stored age goes stale every year).
--
-- WHAT: two nullable text columns on members. No existing row is touched (older members stay blank; the app asks a
-- NEW member for the gender). Written in their own update after the member row (RULE 1), so members keep saving
-- before this runs. Undo: 118_member_gender_dob_down.sql.

begin;

alter table public.members add column if not exists "gender"      text;
alter table public.members add column if not exists "dateOfBirth" text;

insert into public.app_migrations (version, name) values ('118', 'member_gender_dob')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
