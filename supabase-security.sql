-- ============================================================================
--  SahakarLekha — Database Security Hardening (Row-Level Security)
-- ----------------------------------------------------------------------------
--  Replaces the open "allow_all" policies with SOCIETY-SCOPED access control.
--  After this runs, the public anon key in the website bundle can NO LONGER be
--  used to read / change / delete any society's data. Each logged-in user can
--  only touch the society/societies they belong to (matched by their email).
--
--  Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--  READ THE STEP-BY-STEP BELOW FIRST. It is written to be safe and reversible.
-- ============================================================================
--
--  ⚠️  BEFORE YOU RUN (so nobody gets locked out)
--  ------------------------------------------------
--  Strict RLS works only for users who log in through Supabase Auth (JWT).
--  Any active user who still exists ONLY in the old society_users table (legacy
--  plain-text password) would lose access. So:
--
--    1. Run ONLY "STEP 0" below first (while the old allow_all is still active).
--       It lists active users who are NOT yet in Supabase Auth.
--    2. For EACH such user: open the SahakarLekha login page → "Forgot password"
--       (this auto-creates their Supabase Auth account), or add them in
--       Supabase → Authentication → Users. Do this NOW, before STEP 1+.
--    3. Re-run STEP 0 until it returns ZERO rows. THEN run STEP 1 onward.
--    4. After running, log out and log back in and confirm you see your data.
--       If anything is wrong, paste the ROLLBACK block at the very bottom to
--       instantly restore the old open access, and contact your developer.
-- ============================================================================


-- ── STEP 0: PRE-FLIGHT — who is NOT yet in Supabase Auth? (migrate these first)
-- Run this ALONE first. If it returns rows, migrate those users (see note above)
-- BEFORE running anything else. When it returns nothing, continue to STEP 1.
select su.email, su.name, su.role, s.name as society
from public.society_users su
left join public.societies s on s.id = su.society_id
where su.is_active
  and not exists (
    select 1 from auth.users au where lower(au.email) = lower(su.email)
  )
order by s.name, su.email;


-- ============================================================================
-- STEP 1: Helper functions (SECURITY DEFINER → they run with owner rights, so
--          they read society_users WITHOUT triggering RLS / recursion).
-- ============================================================================

-- The set of society ids the CURRENT logged-in user (by JWT email) belongs to.
create or replace function public.current_user_society_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select su.society_id
  from public.society_users su
  where lower(su.email) = lower(auth.jwt() ->> 'email')
    and su.is_active;
$$;

-- Is the current user an ADMIN of the given society?
create or replace function public.is_society_admin(p_society_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.society_users su
    where lower(su.email) = lower(auth.jwt() ->> 'email')
      and su.society_id = p_society_id
      and su.role = 'admin'
      and su.is_active
  );
$$;

-- Does this society already have at least one user? (used to allow ONLY the
-- very first admin to be created at registration, and block everything else.)
create or replace function public.society_has_users(p_society_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.society_users where society_id = p_society_id);
$$;

revoke all on function public.current_user_society_ids() from public;
revoke all on function public.is_society_admin(uuid) from public;
revoke all on function public.society_has_users(uuid) from public;
grant execute on function public.current_user_society_ids() to authenticated;
grant execute on function public.is_society_admin(uuid) to authenticated, anon;
grant execute on function public.society_has_users(uuid) to authenticated, anon;


-- ============================================================================
-- STEP 2: Society-scoped policies on every per-society DATA table.
--          (read/write only by an authenticated MEMBER of that society.)
--          These tables are NOT touched during registration, so they need no
--          anon access at all — fully locked to logged-in members.
-- ============================================================================
do $$
declare
  t text;
  data_tables text[] := array[
    'assets','audit_objections','budgets','customers','elections','employees',
    'eway_bills','hsn_master','kcc_loans','loans','meeting_register','members',
    'purchases','salary_records','sales','stock_items','stock_movements',
    'suppliers','voucher_entries','vouchers'
  ];
begin
  foreach t in array data_tables loop
    execute format('alter table public.%I enable row level security;', t);
    -- remove the old open policies (whatever they were named)
    execute format('drop policy if exists "allow_all" on public.%I;', t);
    execute format('drop policy if exists "society_rw" on public.%I;', t);
    -- new: only an authenticated member of the row''s society
    execute format($p$
      create policy "society_rw" on public.%I
        for all to authenticated
        using      (society_id in (select public.current_user_society_ids()))
        with check (society_id in (select public.current_user_society_ids()));
    $p$, t);
  end loop;
end $$;


-- ============================================================================
-- STEP 3: accounts — same member rule, PLUS an anon INSERT so the registration
--          page can seed the chart of accounts for a brand-new society.
-- ============================================================================
alter table public.accounts enable row level security;
drop policy if exists "allow_all"        on public.accounts;
drop policy if exists "society_rw"       on public.accounts;
drop policy if exists "accounts_seed"    on public.accounts;
create policy "society_rw" on public.accounts
  for all to authenticated
  using      (society_id in (select public.current_user_society_ids()))
  with check (society_id in (select public.current_user_society_ids()));
create policy "accounts_seed" on public.accounts
  for insert to anon with check (true);   -- registration only inserts; never reads


-- ============================================================================
-- STEP 4: society_settings — members read/update; anon may INSERT at registration.
-- ============================================================================
alter table public.society_settings enable row level security;
drop policy if exists "allow_all"               on public.society_settings;
drop policy if exists "society_settings_member"  on public.society_settings;
drop policy if exists "society_settings_seed"    on public.society_settings;
create policy "society_settings_member" on public.society_settings
  for all to authenticated
  using      (society_id in (select public.current_user_society_ids()))
  with check (society_id in (select public.current_user_society_ids()));
create policy "society_settings_seed" on public.society_settings
  for insert to anon with check (true);


-- ============================================================================
-- STEP 5: society_users — THE sensitive table (membership = data access).
--          • members may READ their own society's user list
--          • only an ADMIN of the society may add / edit / remove users
--          • anon may insert ONLY the FIRST admin of a society with no users
--            (registration bootstrap) — this blocks anyone inserting themselves
--            into an EXISTING society to steal its data.
-- ============================================================================
alter table public.society_users enable row level security;
drop policy if exists "allow_all_society_users" on public.society_users;
drop policy if exists "allow_all"               on public.society_users;
drop policy if exists "society_users_read"      on public.society_users;
drop policy if exists "society_users_admin"     on public.society_users;
drop policy if exists "society_users_bootstrap" on public.society_users;

create policy "society_users_read" on public.society_users
  for select to authenticated
  using (society_id in (select public.current_user_society_ids()));

create policy "society_users_admin" on public.society_users
  for all to authenticated
  using      (public.is_society_admin(society_id))
  with check (public.is_society_admin(society_id));

create policy "society_users_bootstrap" on public.society_users
  for insert to anon
  with check (role = 'admin' and not public.society_has_users(society_id));


-- ============================================================================
-- STEP 6: societies — members read; admins update; anon may INSERT at registration.
-- ============================================================================
alter table public.societies enable row level security;
drop policy if exists "allow_all_societies" on public.societies;
drop policy if exists "allow_all"           on public.societies;
drop policy if exists "societies_read"      on public.societies;
drop policy if exists "societies_admin"     on public.societies;
drop policy if exists "societies_seed"      on public.societies;
create policy "societies_read" on public.societies
  for select to authenticated
  using (id in (select public.current_user_society_ids()));
create policy "societies_admin" on public.societies
  for update to authenticated
  using (public.is_society_admin(id)) with check (public.is_society_admin(id));
create policy "societies_seed" on public.societies
  for insert to anon with check (true);


-- ============================================================================
-- STEP 7: platform_admins — a super-admin may read ONLY their own row.
-- ============================================================================
alter table public.platform_admins enable row level security;
drop policy if exists "allow_all"            on public.platform_admins;
drop policy if exists "platform_admins_self" on public.platform_admins;
create policy "platform_admins_self" on public.platform_admins
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));


-- ============================================================================
--  DONE. Now: log out of SahakarLekha, log back in, and confirm your data
--  loads and you can create a voucher. Other societies' data must be invisible.
-- ============================================================================


-- ============================================================================
--  ROLLBACK (EMERGENCY ONLY) — restores the old OPEN access on every table.
--  Use this ONLY if the new policies locked you out. Uncomment and run.
-- ============================================================================
-- do $$
-- declare t text;
--   all_tables text[] := array[
--     'accounts','assets','audit_objections','budgets','customers','elections',
--     'employees','eway_bills','hsn_master','kcc_loans','loans','meeting_register',
--     'members','platform_admins','purchases','salary_records','sales','societies',
--     'society_settings','society_users','stock_items','stock_movements','suppliers',
--     'voucher_entries','vouchers'
--   ];
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
