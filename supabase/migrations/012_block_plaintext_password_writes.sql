-- ============================================================================
-- P1-SEC-5 · B — block ALL plain-text writes to society_users.password
-- ============================================================================
-- 011·A wiped the existing 20 plain-text passwords, but the write-paths
-- (app_register_admin, app_add_society_user, app_set_my_password, and the
-- UserManagement edit's direct .update) would re-introduce plain-text for every
-- NEW / edited / reset user — and society_users is tenant-readable under RLS.
--
-- Instead of rewriting each write-path (and risking the schema-drift that breaks
-- create-or-replace — see 009), a single BEFORE INSERT/UPDATE trigger forces the
-- column to '' on every write, from any source. Durable and drift-proof: the RPCs
-- and clients are untouched — they still pass p_password for the auth.users bcrypt
-- credential (the real login store); only the society_users copy is blanked.
--
-- The column stays (always ''), which is harmless. Dropping it entirely (+ the
-- test-export-registry assertion) is an optional later polish.
-- ============================================================================

begin;

create or replace function public.force_blank_society_user_password()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.password := '';   -- society_users.password is a dead legacy column; never store a secret
  return new;
end;
$$;

drop trigger if exists trg_force_blank_su_password on public.society_users;
create trigger trg_force_blank_su_password
  before insert or update on public.society_users
  for each row execute function public.force_blank_society_user_password();

commit;
