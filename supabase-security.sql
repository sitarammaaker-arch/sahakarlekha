-- ============================================================================
--  SahakarLekha — Database Security Hardening (Row-Level Security)
-- ----------------------------------------------------------------------------
--  Replaces the open "allow_all" policies with SOCIETY-SCOPED access control.
--  After this runs, the public anon key in the website bundle can NO LONGER be
--  used to read / change / delete any society's data via the REST API. Each
--  logged-in user can only touch the society/societies they belong to (matched
--  by their email in society_users).
--
--  Run in: Supabase Dashboard → SQL Editor. READ THE STEP-BY-STEP FIRST.
--  NOTE: society_id is stored as text on some tables and uuid on others, so
--        every comparison below casts to ::text and the helpers return text.
-- ============================================================================
--
--  ⚠️  BEFORE YOU RUN (so nobody gets locked out)
--  ------------------------------------------------
--  Strict RLS works only for users who log in through Supabase Auth (JWT).
--  Run ONLY "STEP 0" first (while allow_all is still active). For every user it
--  lists, create them in Supabase → Authentication → Users → "Add user"
--  (Auto-confirm ON), or use the login page "Forgot password". Re-run STEP 0
--  until it returns ZERO rows, THEN run STEP 1 onward. After running, log out
--  and back in and confirm your data loads. If anything breaks, run the
--  ROLLBACK block at the bottom to restore the old open access.
-- ============================================================================


-- ============================================================================
--  STATUS: LIVE since 2026-06-06. Society-scoped RLS is ACTIVE on all data
--  tables, accounts, society_settings, societies, society_users, platform_admins.
--
--  LOGIN ARCHITECTURE (two paths, both secure):
--    1. supabase.auth.signInWithPassword -> real JWT -> RLS scopes rows by
--       auth.jwt()->>'email' (via current_user_society_ids()). PRIMARY path.
--       REQUIRES every active society_users row to have a HEALTHY auth.users +
--       auth.identities row (same email, confirmed, password synced).
--    2. public.app_login(email, password) -> SECURITY DEFINER RPC fallback
--       (see supabase-app-login.sql). Verifies server-side; works even without a
--       JWT, BUT then data tables return nothing (RLS needs the JWT). So path 1
--       MUST work for each user, or they log in yet see no data.
--
--  HARD-WON PREREQUISITE (do NOT skip): the legacy "forgot password" flow created
--  BROKEN auth rows — auth.users present but auth.identities MISSING — which makes
--  signInWithPassword fail SILENTLY (pw_ok=true yet no JWT). Symptom: user logs in
--  via the RPC fallback but sees empty data once strict RLS is on.
--  FIX per affected user: delete the auth row in SQL (cascades), then recreate via
--  Dashboard -> Authentication -> Add user (Auto Confirm ON) using their
--  society_users password. Verify auth.users.last_sign_in_at updates after a fresh
--  login. Confirm ALL active users have a populated last_sign_in_at BEFORE enabling
--  strict RLS, else they are locked out of their own data.
-- ============================================================================


-- ── STEP 0: PRE-FLIGHT — every active user must have a HEALTHY gotrue login.
--    Flags users with: no auth row, unconfirmed email, OR zero identities
--    (zero identities => signInWithPassword fails silently — see note above).
--    Must return ZERO rows before running STEP 1+.
select su.email, su.name, s.name as society,
       (au.id is not null)                 as has_auth_row,
       (au.email_confirmed_at is not null) as confirmed,
       (select count(*) from auth.identities i where i.user_id = au.id) as identities,
       au.last_sign_in_at
from public.society_users su
left join public.societies s on s.id::text = su.society_id::text
left join auth.users au on lower(au.email) = lower(su.email)
where su.is_active
  and (au.id is null
       or au.email_confirmed_at is null
       or (select count(*) from auth.identities i where i.user_id = au.id) = 0)
order by s.name, su.email;


-- ============================================================================
-- STEP 1: Helper functions (SECURITY DEFINER → bypass RLS internally).
--          Return / accept TEXT so they work whether society_id is text or uuid.
-- ============================================================================
drop function if exists public.current_user_society_ids();
drop function if exists public.is_society_admin(uuid);
drop function if exists public.is_society_admin(text);
drop function if exists public.society_has_users(uuid);
drop function if exists public.society_has_users(text);

create or replace function public.current_user_society_ids()
returns setof text language sql stable security definer set search_path = public as $$
  select su.society_id::text from public.society_users su
  where lower(su.email) = lower(auth.jwt() ->> 'email') and su.is_active;
$$;

create or replace function public.is_society_admin(p_society_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.society_users su
    where lower(su.email) = lower(auth.jwt() ->> 'email')
      and su.society_id::text = p_society_id and su.role = 'admin' and su.is_active);
$$;

create or replace function public.society_has_users(p_society_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.society_users where society_id::text = p_society_id);
$$;

grant execute on function public.current_user_society_ids() to authenticated;
grant execute on function public.is_society_admin(text) to authenticated, anon;
grant execute on function public.society_has_users(text) to authenticated, anon;


-- ============================================================================
-- STEP 2: every per-society DATA table → only an authenticated member.
-- ============================================================================
do $$
declare t text;
  data_tables text[] := array[
    'assets','audit_objections','budgets','customers','elections','employees',
    'eway_bills','hsn_master','kcc_loans','loans','meeting_register','members',
    'purchases','salary_records','sales','stock_items','stock_movements',
    'suppliers','voucher_entries','vouchers'];
begin
  foreach t in array data_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "allow_all" on public.%I;', t);
    execute format('drop policy if exists "society_rw" on public.%I;', t);
    execute format($p$create policy "society_rw" on public.%I for all to authenticated
      using (society_id::text in (select public.current_user_society_ids()))
      with check (society_id::text in (select public.current_user_society_ids()));$p$, t);
  end loop;
end $$;


-- ── STEP 3: accounts (member rule + anon INSERT for registration seeding) ────
alter table public.accounts enable row level security;
drop policy if exists "allow_all" on public.accounts;
drop policy if exists "society_rw" on public.accounts;
drop policy if exists "accounts_seed" on public.accounts;
create policy "society_rw" on public.accounts for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "accounts_seed" on public.accounts for insert to anon with check (true);


-- ── STEP 4: society_settings ─────────────────────────────────────────────────
alter table public.society_settings enable row level security;
drop policy if exists "allow_all" on public.society_settings;
drop policy if exists "society_settings_member" on public.society_settings;
drop policy if exists "society_settings_seed" on public.society_settings;
create policy "society_settings_member" on public.society_settings for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_settings_seed" on public.society_settings for insert to anon with check (true);


-- ── STEP 5: society_users (members read; admins manage; first-admin bootstrap)
alter table public.society_users enable row level security;
drop policy if exists "allow_all_society_users" on public.society_users;
drop policy if exists "allow_all" on public.society_users;
drop policy if exists "society_users_read" on public.society_users;
drop policy if exists "society_users_admin" on public.society_users;
drop policy if exists "society_users_bootstrap" on public.society_users;
create policy "society_users_read" on public.society_users for select to authenticated
  using (society_id::text in (select public.current_user_society_ids()));
create policy "society_users_admin" on public.society_users for all to authenticated
  using (public.is_society_admin(society_id::text)) with check (public.is_society_admin(society_id::text));
create policy "society_users_bootstrap" on public.society_users for insert to anon
  with check (role = 'admin' and not public.society_has_users(society_id::text));


-- ── STEP 6: societies ────────────────────────────────────────────────────────
alter table public.societies enable row level security;
drop policy if exists "allow_all_societies" on public.societies;
drop policy if exists "allow_all" on public.societies;
drop policy if exists "societies_read" on public.societies;
drop policy if exists "societies_admin" on public.societies;
drop policy if exists "societies_seed" on public.societies;
create policy "societies_read" on public.societies for select to authenticated
  using (id::text in (select public.current_user_society_ids()));
create policy "societies_admin" on public.societies for update to authenticated
  using (public.is_society_admin(id::text)) with check (public.is_society_admin(id::text));
create policy "societies_seed" on public.societies for insert to anon with check (true);


-- ── STEP 7: platform_admins (super-admin reads own row only) ─────────────────
alter table public.platform_admins enable row level security;
drop policy if exists "allow_all" on public.platform_admins;
drop policy if exists "platform_admins_self" on public.platform_admins;
create policy "platform_admins_self" on public.platform_admins for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));


-- ============================================================================
--  ROLLBACK (EMERGENCY ONLY) — restores the old OPEN access. Uncomment & run.
-- ============================================================================
-- do $$ declare t text;
--   all_tables text[] := array['accounts','assets','audit_objections','budgets','customers','elections','employees','eway_bills','hsn_master','kcc_loans','loans','meeting_register','members','platform_admins','purchases','salary_records','sales','societies','society_settings','society_users','stock_items','stock_movements','suppliers','voucher_entries','vouchers'];
-- begin
--   foreach t in array all_tables loop
--     execute format('drop policy if exists "society_rw" on public.%I;', t);
--     execute format('drop policy if exists "society_settings_member" on public.%I;', t);
--     execute format('drop policy if exists "society_settings_seed" on public.%I;', t);
--     execute format('drop policy if exists "accounts_seed" on public.%I;', t);
--     execute format('drop policy if exists "society_users_read" on public.%I;', t);
--     execute format('drop policy if exists "society_users_admin" on public.%I;', t);
--     execute format('drop policy if exists "society_users_bootstrap" on public.%I;', t);
--     execute format('drop policy if exists "societies_read" on public.%I;', t);
--     execute format('drop policy if exists "societies_admin" on public.%I;', t);
--     execute format('drop policy if exists "societies_seed" on public.%I;', t);
--     execute format('drop policy if exists "platform_admins_self" on public.%I;', t);
--     execute format('create policy "allow_all" on public.%I for all using (true) with check (true);', t);
--   end loop;
-- end $$;
