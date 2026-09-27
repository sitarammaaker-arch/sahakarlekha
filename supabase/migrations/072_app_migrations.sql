-- 072 · app_migrations — the record of which migrations have run (Phase-3 M1, decision 1-A).
--
-- WHY: production has no supabase_migrations history (every migration so far was run by hand in
-- the SQL Editor), so "is 0NN applied?" could only be answered by fingerprinting objects (M0).
-- From 072 on, every migration inserts its own row here as its last statement, inside the same
-- transaction — so a row exists if and only if the migration committed. Migrations before 072
-- are NOT back-filled (their state stays fingerprint-verified; see the M0 report).
--
-- Not tenant data: no society_id, RLS on with NO policies, and no grants to anon/authenticated,
-- so only the SQL Editor (postgres) and service_role can read it.
--
-- ADDITIVE ONLY: creates one new table; touches no existing table or row.
-- Reversible: 072_app_migrations_down.sql.

begin;

create table if not exists public.app_migrations (
  version    text primary key check (version ~ '^\d{3}$'),
  name       text not null,
  applied_at timestamptz not null default now(),
  applied_by text not null default current_user
);

alter table public.app_migrations enable row level security;
revoke all on public.app_migrations from anon, authenticated;

comment on table public.app_migrations is
  'One row per migration (072+) that committed. Written by the migration itself as its last statement.';

insert into public.app_migrations (version, name) values ('072', 'app_migrations')
  on conflict (version) do nothing;

commit;
