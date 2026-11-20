-- 189 · SEC-05 + REF-01 (product audit 2026-11-17)
--
-- SEC-05 — app_mfa_admin_reset matched the target login lower-cased while society_users.email was unique only
--   case-sensitively: an admin could insert a case-variant of another society's user and strip that user's 2FA.
--   • society_users gets a unique index on lower(email) (production 2026-11-20: 0 case-variant duplicates);
--   • the reset refuses a login that also belongs to a society the admin does not administer.
-- REF-01 — register_society inserted with jsonb_populate_record, which writes NULL into created_at (the default never
--   ran): 21 of 38 societies have no creation time, and the partner referral attach ("within 30 minutes of signup")
--   could never succeed — 0 attributions. register_society now stamps created_at; the 21 are backfilled from the
--   society's first financial year (else its first login row).
-- Bodies = production (read 2026-11-20) + only the lines marked "189 / …". Undo: the _down file.

begin;

-- ── SEC-05 ──
create unique index if not exists society_users_email_lower_key on public.society_users (lower(email));

CREATE OR REPLACE FUNCTION public.app_mfa_admin_reset(p_admin_email text, p_target_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare me text := _mfa_caller_email(); target text := lower(nullif(p_target_email, '')); allowed boolean;
begin
  perform _mfa_assert_self(p_admin_email, me);
  if target is null then return false; end if;
  select exists(
    select 1
      from society_users a
      join society_users t on t.society_id = a.society_id
     where lower(a.email) = me and a.role = 'admin' and a.is_active = true
       and lower(t.email) = target
  ) into allowed;
  if not allowed then return false; end if;
  -- 189 / SEC-05: the login must belong ONLY to societies this admin administers. society_users.email was unique
  -- case-sensitively while this matches lower-cased, so an admin could add a case-variant of another society's user
  -- and reset THAT user's 2FA. (The new lower(email) unique index closes the variant; this refuses it outright.)
  if exists (select 1 from society_users t
              where lower(t.email) = target
                and t.society_id not in (select a.society_id from society_users a
                                          where lower(a.email) = me and a.role = 'admin' and a.is_active = true)) then
    return false;
  end if;
  delete from user_mfa where email = target;
  delete from user_mfa_recovery where email = target;
  update society_users set mfa_enabled = false where lower(email) = target;
  return true;
end;
$function$
;
revoke execute on function public.app_mfa_admin_reset(text, text) from public, anon;
grant execute on function public.app_mfa_admin_reset(text, text) to authenticated;

-- ── REF-01 ──
CREATE OR REPLACE FUNCTION public.register_society(p_society_id text, p_email text, p_password text, p_name text, p_society jsonb, p_settings jsonb, p_accounts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_society  jsonb;
  v_settings jsonb;
  v_accounts jsonb;
  v_ip       text;
  v_ip_hash  text;
  v_em_hash  text;
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

  -- 181 (MAIL-01): this endpoint is anonymous and every success mails the address it was given. Limit it:
  -- 5 per network per hour, 3 per email per day, 20 in all per hour (real signups are 1–2 a day). Only hashes
  -- are kept, for two days. A refused attempt writes nothing else and sends nothing.
  -- The network address: the proxy's own headers first (a caller can prepend to x-forwarded-for); the global
  -- 20-per-hour cap holds even if every address were forged.
  begin
    v_ip := nullif(trim(coalesce(
      current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip',
      current_setting('request.headers', true)::jsonb ->> 'x-real-ip',
      split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1))), '');
  exception when others then
    v_ip := null;
  end;
  v_ip_hash := encode(extensions.digest(coalesce(v_ip, 'unknown'), 'sha256'), 'hex');
  v_em_hash := encode(extensions.digest(lower(trim(coalesce(p_email, ''))), 'sha256'), 'hex');
  delete from public.signup_attempts where at < now() - interval '2 days';
  if (select count(*) from public.signup_attempts where at > now() - interval '1 hour') >= 20
     or (v_ip is not null and (select count(*) from public.signup_attempts
                                where ip_hash = v_ip_hash and at > now() - interval '1 hour') >= 5)
     or (select count(*) from public.signup_attempts
          where email_hash = v_em_hash and at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'error_code', 'rate_limited',
                              'error_message', 'Too many registration attempts. Please try again later.');
  end if;
  insert into public.signup_attempts (ip_hash, email_hash) values (v_ip_hash, v_em_hash);

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
    -- 189 / REF-01: jsonb_populate_record writes NULL for a column the JSON lacks — overriding created_at's now()
    -- default. 21 of 38 societies had no creation time, so attach_referral_at_signup ("within 30 minutes") always
    -- answered too_late and no partner could ever be credited. The server stamps it; the browser cannot.
    select * from jsonb_populate_record(null::public.societies, v_society || jsonb_build_object('created_at', localtimestamp));

  -- Confirmed Supabase Auth admin + society_users row (existing working RPC,
  -- composed in-transaction; it RAISES on failure, which we catch below).
  -- 181: mark this transaction as a SELF-signup, so the society_users trigger sends the neutral
  -- "confirm your email" mail — never a branded invite carrying names the caller typed.
  perform set_config('sahakarlekha.signup', 'on', true);
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
$function$
;
-- anon-exec: register_society — public sign-up creates the society before any login exists (unchanged since it was added)
grant execute on function public.register_society(text, text, text, text, jsonb, jsonb, jsonb) to anon, authenticated;

update public.societies s
   set created_at = coalesce(
         (select min(f.created_at)::timestamp from public.financial_years f where f.society_id = s.id::text),
         (select min(u.created_at)::timestamp from public.society_users u where u.society_id::text = s.id::text),
         localtimestamp)
 where s.created_at is null;

insert into public.app_migrations (version, name) values ('189', 'mfa_reset_lower_email_and_society_created_at')
  on conflict (version) do nothing;

commit;

-- VERIFY (read-only):
--   select count(*) from public.societies where created_at is null;                                     -- 0
--   select count(*) from pg_indexes where indexname = 'society_users_email_lower_key';                  -- 1
