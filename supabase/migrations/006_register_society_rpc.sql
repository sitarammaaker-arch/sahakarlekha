-- ============================================================================
-- P1-SEC-1a · register_society — atomic new-society bootstrap (SECURITY DEFINER)
-- ============================================================================
-- WHY: registration currently does 4 direct client inserts (societies,
-- society_settings, accounts) + an app_register_admin RPC, with a manual
-- "delete society on admin failure" rollback. Those direct inserts happen BEFORE
-- the user has any society_users mapping, so once P1-SEC-1b scopes those tables
-- by society_id they would be DENIED. This RPC moves the whole bootstrap
-- server-side and makes it ATOMIC, so the RLS migration can safely scope those
-- tables without breaking signup.
--
-- BEHAVIOUR: identical to the current flow — same rows, same seed accounts, same
-- confirmed-admin creation (it composes the existing, working app_register_admin
-- RPC in-transaction), same error surfaces — but now all-or-nothing (no orphan
-- society/admin on partial failure) in a single call.
--
-- SECURITY: SECURITY DEFINER (runs as owner → bypasses RLS for the bootstrap,
-- which is correct: there is no tenant context yet). search_path is pinned to ''
-- and every object is schema-qualified (guards against search-path hijacking).
-- A bootstrap guard refuses any society that already exists / already has users,
-- so this cannot be used to hijack or re-seed an existing tenant.
--
-- Column mapping uses jsonb_populate_record against each table's own rowtype, so
-- the RPC needs no column list — the client passes the SAME objects it inserts
-- today, keeping behaviour identical.
-- ============================================================================

create or replace function public.register_society(
  p_society_id text,
  p_email      text,
  p_password   text,
  p_name       text,
  p_society    jsonb,   -- full public.societies row (client-built, incl. id)
  p_settings   jsonb,   -- full public.society_settings row
  p_accounts   jsonb    -- array of public.accounts rows (each carries society_id)
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Bootstrap guard — never touch an already-registered society (anti-hijack / idempotency).
  -- societies.id / society_users.society_id are uuid; p_society_id is text → compare as text.
  if exists (select 1 from public.societies      where id::text = p_society_id)
     or exists (select 1 from public.society_users where society_id::text = p_society_id) then
    return jsonb_build_object('ok', false, 'error_code', 'society_exists',
                              'error_message', 'This society is already registered.');
  end if;

  -- Clean duplicate-registration UX (the atomic block below still guards races).
  if exists (select 1 from public.societies where registration_no = p_society->>'registration_no') then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_registration',
                              'error_message', 'Registration number already exists.');
  end if;

  -- ── Atomic bootstrap: ANY failure rolls the WHOLE thing back ──────────────
  insert into public.societies
    select * from jsonb_populate_record(null::public.societies, p_society);

  -- Confirmed Supabase Auth admin + society_users row (existing working RPC,
  -- composed in-transaction; it RAISES on failure, which we catch below).
  perform public.app_register_admin(
    p_email      => p_email,
    p_password   => p_password,
    p_name       => p_name,
    p_society_id => p_society_id
  );

  insert into public.society_settings
    select * from jsonb_populate_record(null::public.society_settings, p_settings);

  insert into public.accounts
    select * from jsonb_populate_recordset(null::public.accounts, p_accounts);

  return jsonb_build_object('ok', true, 'society_id', p_society_id);

exception
  when others then
    -- Everything above is rolled back atomically. Map to the same error surfaces
    -- the old client flow showed; return the raw message for anything unexpected.
    if SQLSTATE = '23505' or SQLERRM ilike '%already%' or SQLERRM ilike '%duplicate%' then
      return jsonb_build_object('ok', false, 'error_code', 'duplicate_email',
                                'error_message', SQLERRM);
    end if;
    return jsonb_build_object('ok', false, 'error_code', 'error', 'error_message', SQLERRM);
end;
$$;

-- Registration is unauthenticated → anon must be able to call it (as it calls
-- app_register_admin today). authenticated is granted for completeness.
grant execute on function public.register_society(text, text, text, text, jsonb, jsonb, jsonb)
  to anon, authenticated;
