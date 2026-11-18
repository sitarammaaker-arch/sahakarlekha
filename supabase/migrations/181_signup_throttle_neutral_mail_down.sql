-- Down for 181 — puts back 172's register_society and 143's tg_notify_society_user, and drops signup_attempts.
-- Run only to undo 181 (it re-opens MAIL-01).

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

create or replace function public.tg_notify_society_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email   text := lower(trim(coalesce(new.email, '')));
  v_actor   text := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  v_society text := new.society_id::text;
  v_token   text;
begin
  if v_email = '' or not coalesce(new.is_active, true) then return new; end if;
  begin
    if tg_op = 'INSERT' then
      if not exists (select 1 from public.email_verifications where email = v_email and verified_at is not null) then
        v_token := encode(gen_random_bytes(24), 'hex');
        insert into public.email_verifications as v (email, token_hash, token_expires_at, requested_at)
        values (v_email, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '48 hours', now())
        on conflict (email) do update
          set token_hash = excluded.token_hash, token_expires_at = excluded.token_expires_at,
              requested_at = excluded.requested_at;
      end if;
      perform public.enqueue_notification(
        v_society, 'user_invite', v_email,
        jsonb_strip_nulls(jsonb_build_object('token', v_token, 'name', new.name, 'role', new.role,
          'society_name', public.notify_society_name(v_society), 'by', coalesce(v_actor, 'system'))),
        'user_invite:' || new.id::text);
    elsif new.role is distinct from old.role then
      perform public.enqueue_notification(
        v_society, 'role_changed', v_email,
        jsonb_build_object('name', new.name, 'old_role', old.role, 'new_role', new.role,
          'society_name', public.notify_society_name(v_society), 'by', coalesce(v_actor, 'system')),
        'role_changed:' || new.id::text || ':' || coalesce(new.role, '') || ':' || extract(epoch from clock_timestamp())::bigint);
    end if;
  exception when others then
    raise warning 'tg_notify_society_user: notification not queued (%)', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.tg_notify_society_user() from public, anon, authenticated;

drop table if exists public.signup_attempts;

delete from public.app_migrations where version = '181';

commit;
