-- 172 · register_society: every row it inserts belongs to the society being registered
--
-- Audit 2026-11-16 (docs/audits/SAHAKARLEKHA-USER-JOURNEY-CONVERSION-AUDIT.md, S-1).
--
-- register_society is the ANONYMOUS signup RPC. It is SECURITY DEFINER, so its inserts bypass RLS, and it
-- inserted three client-built payloads exactly as sent:
--     p_society   → public.societies
--     p_settings  → public.society_settings
--     p_accounts  → public.accounts        (one row per ledger head)
-- Nothing checked that those rows carried p_society_id. A caller could register a throw-away society while
-- sending p_accounts rows whose society_id was ANOTHER society's id — adding ledger heads to that society's
-- chart without ever logging in. A society's id is not a secret (it is in every member-portal link).
--
-- Fix: the function no longer trusts those ids. It OVERWRITES them with p_society_id before inserting:
--     societies.id, society_settings.id, society_settings.society_id, accounts[].society_id
-- The app already sends exactly these values (src/pages/Register.tsx), so a normal signup is unchanged.
-- Also refused, with a clean error instead of a raw SQL message: a p_society_id that is not a uuid, a
-- p_accounts that is not a JSON array, and a chart of more than 2,000 rows (the largest template is a few
-- hundred; this only stops the endpoint being used to bulk-load junk).
--
-- Everything else — the bootstrap guard, the duplicate checks, app_register_admin, the error codes the
-- page reads (society_exists / duplicate_registration / duplicate_email / error) — is 006's body unchanged.
--
-- anon-exec: register_society — signup runs before any login exists (Register.tsx); CREATE OR REPLACE keeps
-- the anon/authenticated grants from 006. The function creates only a NEW society and its own rows.
--
-- Idempotent. Undo: 172_register_society_own_rows_down.sql.

begin;

create or replace function public.register_society(
  p_society_id text,
  p_email      text,
  p_password   text,
  p_name       text,
  p_society    jsonb,   -- public.societies row (client-built)
  p_settings   jsonb,   -- public.society_settings row
  p_accounts   jsonb    -- array of public.accounts rows
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_society  jsonb;
  v_settings jsonb;
  v_accounts jsonb;
begin
  -- 172: shape checks, before anything is written.
  if p_society_id is null
     or p_society_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return jsonb_build_object('ok', false, 'error_code', 'error',
                              'error_message', 'Registration could not be completed. Please reload the page and try again.');
  end if;
  if p_society is null or jsonb_typeof(p_society) <> 'object'
     or p_settings is null or jsonb_typeof(p_settings) <> 'object'
     or p_accounts is null or jsonb_typeof(p_accounts) <> 'array'
     or jsonb_array_length(p_accounts) > 2000 then
    return jsonb_build_object('ok', false, 'error_code', 'error',
                              'error_message', 'Registration could not be completed. Please reload the page and try again.');
  end if;

  -- 172: the ids are OURS, never the caller's. Whatever the payloads said, every row lands in p_society_id.
  v_society  := p_society  || jsonb_build_object('id', p_society_id);
  v_settings := p_settings || jsonb_build_object('id', p_society_id, 'society_id', p_society_id);
  select coalesce(jsonb_agg(a.elem || jsonb_build_object('society_id', p_society_id)), '[]'::jsonb)
    into v_accounts
    from jsonb_array_elements(p_accounts) as a(elem)
   where jsonb_typeof(a.elem) = 'object';

  -- Bootstrap guard — never touch an already-registered society (anti-hijack / idempotency).
  -- societies.id / society_users.society_id are uuid; p_society_id is text → compare as text.
  if exists (select 1 from public.societies      where id::text = p_society_id)
     or exists (select 1 from public.society_users where society_id::text = p_society_id) then
    return jsonb_build_object('ok', false, 'error_code', 'society_exists',
                              'error_message', 'This society is already registered.');
  end if;

  -- Clean duplicate-registration UX (the atomic block below still guards races).
  if exists (select 1 from public.societies where registration_no = v_society->>'registration_no') then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_registration',
                              'error_message', 'Registration number already exists.');
  end if;

  -- ── Atomic bootstrap: ANY failure rolls the WHOLE thing back ──────────────
  insert into public.societies
    select * from jsonb_populate_record(null::public.societies, v_society);

  -- Confirmed Supabase Auth admin + society_users row (existing working RPC,
  -- composed in-transaction; it RAISES on failure, which we catch below).
  perform public.app_register_admin(
    p_email      => p_email,
    p_password   => p_password,
    p_name       => p_name,
    p_society_id => p_society_id
  );

  insert into public.society_settings
    select * from jsonb_populate_record(null::public.society_settings, v_settings);

  insert into public.accounts
    select * from jsonb_populate_recordset(null::public.accounts, v_accounts);

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
$function$;

insert into public.app_migrations (version, name) values ('172', 'register_society_own_rows')
  on conflict (version) do nothing;

commit;

-- VERIFY (run after the migration; read-only):
--   select pg_get_functiondef('public.register_society(text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure)
--          ~ 'jsonb_build_object\(''society_id'', p_society_id\)' as forces_society_id;          -- expect: true
--   select has_function_privilege('anon', 'public.register_society(text,text,text,text,jsonb,jsonb,jsonb)', 'execute')
--          as anon_can_sign_up;                                                                    -- expect: true
