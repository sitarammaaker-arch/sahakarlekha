-- 168 · Referral partners — the partner portal: email OTP login, own session, PAN/bank change requests (2026-11-14).
--
-- WHY: the status link (164's token) was the partner's only key — forwarded once, it never expired, and a forgotten
-- link needed the admin. Now a partner signs in at /partner/login with the email on file and a 6-digit code.
--
-- WHAT:
--   • partners.email becomes REQUIRED for new applications (partner_apply refuses 'email_required'); existing rows
--     without one get it from the admin (admin_partner_set_email). One live partner per email.
--   • partner_login_codes — a code is issued ONLY by the partner-auth Edge Function (service role) through
--     partner_login_issue(email): 6 digits, sha256-hashed, 10 minutes, single use, 5 tries; at most 3 codes per
--     15 minutes and 10 per day per partner, and 300 per hour overall. Rejected partners get nothing. The function
--     always answers the same, so nobody learns which emails are partners.
--   • partner_sessions — partner_login_verify(email, code) (anon) returns a random 64-hex session token (stored
--     hashed, 30 days). It is NOT a Supabase Auth login: no auth.users row is created, so the same email can still
--     register a society, and the society RLS is untouched. A good code also marks the email verified for the outbox.
--   • partner_portal(session) — everything the dashboard shows (status, code, societies, commissions, payouts, masked
--     payment details, any pending change request). partner_logout(session).
--   • partner_detail_requests — the partner submits PAN / bank / UPI / GSTIN; NOTHING is applied until the admin
--     approves (admin_detail_requests_list / admin_detail_request_decide). A stolen session therefore cannot redirect
--     a payout. The portal shows saved details masked, never in full.
--   • The 164–167 token RPCs (partner_status / partner_dashboard / partner_commissions / partner_payouts) are no
--     longer callable by anon: the old status links stop working; /partner/status now points to the login.
--   • admin_partner_welcome_info(id) — for the Edge Function's welcome email after approval (admin JWT only).
--
-- Needs 164–167. Undo: 168_partner_portal_otp_down.sql (drops sessions, codes and change requests; restores anon on
-- the token RPCs and 164's partner_apply).

begin;

-- ── email on partners ─────────────────────────────────────────────────────────────────────────────────────────
create unique index if not exists uq_partners_email_live on public.partners (lower(email))
  where email is not null and status <> 'rejected';

-- ── tables ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.partner_login_codes (
  id          bigserial primary key,
  partner_id  uuid not null references public.partners(id),
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_partner_login_codes_partner on public.partner_login_codes (partner_id, created_at desc);

create table if not exists public.partner_sessions (
  id            bigserial primary key,
  partner_id    uuid not null references public.partners(id),
  token_hash    text not null unique,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz,
  revoked_at    timestamptz
);
create index if not exists idx_partner_sessions_partner on public.partner_sessions (partner_id);

create table if not exists public.partner_detail_requests (
  id            bigserial primary key,
  partner_id    uuid not null references public.partners(id),
  pan           text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  pan_name      text,
  account_name  text,
  account_no    text check (account_no is null or account_no ~ '^[0-9]{6,20}$'),
  ifsc          text check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  upi_id        text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$'),
  gstin         text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$'),
  status        text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  admin_note    text,
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_partner_detail_requests_pending on public.partner_detail_requests (partner_id) where status = 'pending';

alter table public.partner_login_codes     enable row level security;
alter table public.partner_sessions        enable row level security;
alter table public.partner_detail_requests enable row level security;
revoke all on table public.partner_login_codes     from anon, authenticated;
revoke all on table public.partner_sessions        from anon, authenticated;
revoke all on table public.partner_detail_requests from anon, authenticated;
revoke all on sequence public.partner_login_codes_id_seq     from anon, authenticated;
revoke all on sequence public.partner_sessions_id_seq        from anon, authenticated;
revoke all on sequence public.partner_detail_requests_id_seq from anon, authenticated;

-- ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public._partner_norm_email(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(lower(btrim(coalesce(p, ''))), '');
$$;
revoke execute on function public._partner_norm_email(text) from public, anon, authenticated;

-- The partner behind a live session, or NULL. Touches last_seen_at.
create or replace function public._partner_from_session(p_session text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_session is null or p_session !~ '^[0-9a-f]{64}$' then return null; end if;
  update public.partner_sessions s
     set last_seen_at = now()
   where s.token_hash = encode(digest(p_session, 'sha256'), 'hex')
     and s.revoked_at is null and s.expires_at > now()
  returning s.partner_id into v_id;
  if v_id is null then return null; end if;
  if not exists (select 1 from public.partners p where p.id = v_id and p.status <> 'rejected') then return null; end if;
  return v_id;
end;
$$;
revoke execute on function public._partner_from_session(text) from public, anon, authenticated;

-- ── partner_apply: email now required (same signature as 164) ─────────────────────────────────────────────────
create or replace function public.partner_apply(
  p_name text, p_phone text, p_email text, p_category text,
  p_district text, p_state text, p_note text,
  p_declared_not_public_servant boolean, p_declared_not_proxy boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_phone text := public._partner_norm_phone(p_phone);
  v_email text := public._partner_norm_email(p_email);
  v_token uuid;
begin
  if coalesce(p_declared_not_public_servant, false) is false or coalesce(p_declared_not_proxy, false) is false then
    return jsonb_build_object('ok', false, 'error_code', 'declaration_required');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_name');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_phone');
  end if;
  if v_email is null then
    return jsonb_build_object('ok', false, 'error_code', 'email_required');
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_email');
  end if;
  if p_category not in ('creator','accountant','ca','consultant','retired','other') then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_category');
  end if;
  if exists (select 1 from public.partners where phone = v_phone and status <> 'rejected') then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_phone');
  end if;
  if exists (select 1 from public.partners where lower(email) = v_email and status <> 'rejected') then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_email');
  end if;
  if (select count(*) from public.partners where created_at > now() - interval '1 hour') >= 200 then
    return jsonb_build_object('ok', false, 'error_code', 'rate_limited');
  end if;

  insert into public.partners (name, phone, email, category, district, state, note,
                               declared_not_public_servant, declared_not_proxy)
  values (btrim(p_name), v_phone, v_email, p_category,
          nullif(btrim(coalesce(p_district, '')), ''), nullif(btrim(coalesce(p_state, '')), ''),
          nullif(left(btrim(coalesce(p_note, '')), 1000), ''),
          true, true)
  returning token into v_token;

  return jsonb_build_object('ok', true, 'token', v_token);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error_code', 'duplicate_phone');
end;
$$;

-- ── login: issue (service role only — the Edge Function sends the email) ──────────────────────────────────────
create or replace function public.partner_login_issue(p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_email text := public._partner_norm_email(p_email);
  v       public.partners%rowtype;
  v_code  text;
begin
  if v_email is null then return jsonb_build_object('ok', false, 'reason', 'no_partner'); end if;
  select * into v from public.partners where lower(email) = v_email and status <> 'rejected'
   order by created_at desc limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_partner'); end if;

  if (select count(*) from public.partner_login_codes where created_at > now() - interval '1 hour') >= 300
     or (select count(*) from public.partner_login_codes where partner_id = v.id and created_at > now() - interval '15 minutes') >= 3
     or (select count(*) from public.partner_login_codes where partner_id = v.id and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  v_code := lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
  -- a newer code replaces any older unused one
  update public.partner_login_codes set used_at = now() where partner_id = v.id and used_at is null;
  insert into public.partner_login_codes (partner_id, code_hash, expires_at)
  values (v.id, encode(digest(v.id::text || ':' || v_code, 'sha256'), 'hex'), now() + interval '10 minutes');

  return jsonb_build_object('ok', true, 'email', v.email, 'name', v.name, 'code', v_code);
end;
$$;

-- ── login: verify (anon) ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.partner_login_verify(p_email text, p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_email   text := public._partner_norm_email(p_email);
  v         public.partners%rowtype;
  c         public.partner_login_codes%rowtype;
  v_session text;
begin
  if v_email is null or coalesce(p_code, '') !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_code');
  end if;
  select * into v from public.partners where lower(email) = v_email and status <> 'rejected'
   order by created_at desc limit 1;
  if not found then return jsonb_build_object('ok', false, 'error_code', 'invalid_code'); end if;

  select * into c from public.partner_login_codes
   where partner_id = v.id and used_at is null and expires_at > now()
   order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('ok', false, 'error_code', 'code_expired'); end if;
  if c.attempts >= 5 then
    update public.partner_login_codes set used_at = now() where id = c.id;
    return jsonb_build_object('ok', false, 'error_code', 'too_many_attempts');
  end if;
  if c.code_hash <> encode(digest(v.id::text || ':' || p_code, 'sha256'), 'hex') then
    update public.partner_login_codes set attempts = attempts + 1 where id = c.id;
    return jsonb_build_object('ok', false, 'error_code', 'invalid_code', 'attempts_left', greatest(0, 4 - c.attempts));
  end if;

  update public.partner_login_codes set used_at = now() where id = c.id;
  v_session := encode(gen_random_bytes(32), 'hex');
  insert into public.partner_sessions (partner_id, token_hash, expires_at, last_seen_at)
  values (v.id, encode(digest(v_session, 'sha256'), 'hex'), now() + interval '30 days', now());

  -- the code reached this inbox, so the address is proven for the notification outbox (142) too
  insert into public.email_verifications (email, verified_at)
  values (v_email, now())
  on conflict (email) do update set verified_at = coalesce(public.email_verifications.verified_at, now());

  return jsonb_build_object('ok', true, 'session', v_session, 'expires_in_days', 30);
end;
$$;

create or replace function public.partner_logout(p_session text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  if p_session is null or p_session !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', true); end if;
  update public.partner_sessions set revoked_at = now()
   where token_hash = encode(digest(p_session, 'sha256'), 'hex') and revoked_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── the portal ───────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.partner_portal(p_session text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := public._partner_from_session(p_session);
  v    public.partners%rowtype;
  d    public.partner_payment_details%rowtype;
  r    public.partner_detail_requests%rowtype;
  mask_tail text;
begin
  if v_id is null then return jsonb_build_object('ok', false, 'error_code', 'session_expired'); end if;
  select * into v from public.partners where id = v_id;
  select * into d from public.partner_payment_details where partner_id = v_id;
  select * into r from public.partner_detail_requests where partner_id = v_id and status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'partner', jsonb_build_object(
      'name', v.name, 'status', v.status, 'email', v.email,
      'code', case when v.status = 'approved' then v.code end,
      'phone_masked', 'XXXXXX' || right(v.phone, 4),
      'applied_at', v.created_at),
    -- the 165–167 builders, called server-side with the partner's own token (never returned)
    'dashboard',   public.partner_dashboard(v.token),
    'commissions', public.partner_commissions(v.token),
    'payouts',     public.partner_payouts(v.token),
    'details', case when d.partner_id is null then null else jsonb_build_object(
      'pan_masked', case when d.pan is null then null else left(d.pan, 5) || '****' || right(d.pan, 1) end,
      'pan_name', d.pan_name,
      'account_masked', case when d.account_no is null then null else repeat('X', greatest(0, char_length(d.account_no) - 4)) || right(d.account_no, 4) end,
      'ifsc', d.ifsc,
      'upi_masked', case when d.upi_id is null then null else left(d.upi_id, 2) || '***' || substr(d.upi_id, position('@' in d.upi_id)) end,
      'gstin', d.gstin,
      'updated_at', d.updated_at) end,
    'pending_request', case when r.id is null then null else jsonb_build_object('id', r.id, 'created_at', r.created_at) end,
    'last_decision', (select jsonb_build_object('status', x.status, 'admin_note', x.admin_note, 'decided_at', x.decided_at)
                        from public.partner_detail_requests x
                       where x.partner_id = v_id and x.status in ('approved','rejected')
                       order by x.decided_at desc nulls last limit 1));
end;
$$;

-- The partner asks for their PAN / bank / UPI / GSTIN to be set. Applied only when the admin approves.
create or replace function public.partner_details_request(
  p_session text, p_pan text, p_pan_name text, p_account_name text, p_account_no text,
  p_ifsc text, p_upi_id text, p_gstin text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_id   uuid := public._partner_from_session(p_session);
  v_pan  text := nullif(upper(regexp_replace(coalesce(p_pan, ''), '\s', '', 'g')), '');
  v_acc  text := nullif(regexp_replace(coalesce(p_account_no, ''), '\s', '', 'g'), '');
  v_ifsc text := nullif(upper(regexp_replace(coalesce(p_ifsc, ''), '\s', '', 'g')), '');
  v_upi  text := nullif(btrim(coalesce(p_upi_id, '')), '');
  v_gst  text := nullif(upper(regexp_replace(coalesce(p_gstin, ''), '\s', '', 'g')), '');
  v_rid  bigint;
begin
  if v_id is null then return jsonb_build_object('ok', false, 'error_code', 'session_expired'); end if;
  if v_pan is not null and v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_pan'); end if;
  if v_acc is not null and v_acc !~ '^[0-9]{6,20}$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_account'); end if;
  if v_ifsc is not null and v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_ifsc'); end if;
  if v_upi is not null and v_upi !~ '^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_upi'); end if;
  if v_gst is not null and v_gst !~ '^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_gstin'); end if;
  if (v_acc is null) <> (v_ifsc is null) then return jsonb_build_object('ok', false, 'error_code', 'account_needs_ifsc'); end if;
  if v_pan is null and v_acc is null and v_upi is null and v_gst is null then
    return jsonb_build_object('ok', false, 'error_code', 'nothing_to_save');
  end if;
  if (select count(*) from public.partner_detail_requests where partner_id = v_id and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('ok', false, 'error_code', 'rate_limited');
  end if;

  update public.partner_detail_requests set status = 'superseded', decided_at = now()
   where partner_id = v_id and status = 'pending';
  insert into public.partner_detail_requests (partner_id, pan, pan_name, account_name, account_no, ifsc, upi_id, gstin)
  values (v_id, v_pan, nullif(btrim(coalesce(p_pan_name, '')), ''), nullif(btrim(coalesce(p_account_name, '')), ''),
          v_acc, v_ifsc, v_upi, v_gst)
  returning id into v_rid;
  return jsonb_build_object('ok', true, 'id', v_rid);
end;
$$;

-- ── admin ────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_partner_set_email(p_id uuid, p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_email text := public._partner_norm_email(p_email);
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_email');
  end if;
  if exists (select 1 from public.partners where lower(email) = v_email and status <> 'rejected' and id <> p_id) then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_email');
  end if;
  update public.partners set email = v_email, updated_at = now() where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error_code', 'not_found'); end if;
  -- a changed email ends every open session of that partner
  update public.partner_sessions set revoked_at = now() where partner_id = p_id and revoked_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_partner_welcome_info(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v public.partners%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v from public.partners where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error_code', 'not_found'); end if;
  if v.status <> 'approved' or v.code is null then return jsonb_build_object('ok', false, 'error_code', 'not_approved'); end if;
  if v.email is null then return jsonb_build_object('ok', false, 'error_code', 'no_email'); end if;
  return jsonb_build_object('ok', true, 'name', v.name, 'email', v.email, 'code', v.code, 'phone', v.phone);
end;
$$;

create or replace function public.admin_detail_requests_list()
returns table (
  id bigint, partner_id uuid, partner_name text, partner_code text, pan text, pan_name text, account_name text,
  account_no text, ifsc text, upi_id text, gstin text, created_at timestamptz,
  current_pan text, current_account_no text, current_upi_id text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select r.id, r.partner_id, p.name, p.code, r.pan, r.pan_name, r.account_name, r.account_no, r.ifsc, r.upi_id, r.gstin,
           r.created_at, d.pan, d.account_no, d.upi_id
      from public.partner_detail_requests r
      join public.partners p on p.id = r.partner_id
      left join public.partner_payment_details d on d.partner_id = r.partner_id
     where r.status = 'pending'
     order by r.created_at;
end;
$$;

-- Approve → the requested values replace the saved ones (fields left empty in the request keep the saved value).
create or replace function public.admin_detail_request_decide(p_id bigint, p_decision text, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  r       public.partner_detail_requests%rowtype;
  d       public.partner_payment_details%rowtype;
  v_actor text := coalesce(auth.jwt() ->> 'email', 'platform-admin');
  v_res   jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_decision not in ('approved','rejected') then return jsonb_build_object('ok', false, 'error_code', 'invalid_decision'); end if;
  select * into r from public.partner_detail_requests where id = p_id for update;
  if not found or r.status <> 'pending' then return jsonb_build_object('ok', false, 'error_code', 'not_pending'); end if;
  if p_decision = 'rejected' and char_length(btrim(coalesce(p_note, ''))) < 3 then
    return jsonb_build_object('ok', false, 'error_code', 'reason_required');
  end if;

  if p_decision = 'approved' then
    select * into d from public.partner_payment_details where partner_id = r.partner_id;
    v_res := public.admin_partner_payment_details_set(
      r.partner_id,
      coalesce(r.pan, d.pan), coalesce(r.pan_name, d.pan_name),
      case when r.account_no is not null then r.account_name else coalesce(r.account_name, d.account_name) end,
      coalesce(r.account_no, d.account_no), coalesce(r.ifsc, d.ifsc),
      coalesce(r.upi_id, d.upi_id), coalesce(r.gstin, d.gstin));
    if not (v_res ->> 'ok')::boolean then return v_res; end if;
  end if;

  update public.partner_detail_requests
     set status = p_decision, admin_note = nullif(btrim(coalesce(p_note, '')), ''), decided_by = v_actor, decided_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── grants ───────────────────────────────────────────────────────────────────────────────────────────────────
-- anon-exec: partner_apply — redefined here (email now required); the /partner application form is public, grants unchanged from 164.
-- anon-exec: partner_login_verify — /partner/login is signed-out by nature; it needs the code that was emailed, 5 tries per code, codes expire in 10 minutes.
-- anon-exec: partner_logout — ends the caller's own session; knowing a session token is the only way to use it.
-- anon-exec: partner_portal — the partner portal has no Supabase login; it answers only for a live 256-bit session token and returns that partner's own data, payment details masked.
-- anon-exec: partner_details_request — same session gate; it only files a request that does nothing until the platform admin approves it.
revoke all on function public.partner_login_verify(text, text) from public;
revoke all on function public.partner_logout(text) from public;
revoke all on function public.partner_portal(text) from public;
revoke all on function public.partner_details_request(text, text, text, text, text, text, text, text) from public;
grant execute on function public.partner_login_verify(text, text) to anon, authenticated;
grant execute on function public.partner_logout(text) to anon, authenticated;
grant execute on function public.partner_portal(text) to anon, authenticated;
grant execute on function public.partner_details_request(text, text, text, text, text, text, text, text) to anon, authenticated;

revoke execute on function public.partner_login_issue(text) from public, anon, authenticated;
grant execute on function public.partner_login_issue(text) to service_role;

revoke execute on function public.admin_partner_set_email(uuid, text)           from public, anon;
revoke execute on function public.admin_partner_welcome_info(uuid)              from public, anon;
revoke execute on function public.admin_detail_requests_list()                  from public, anon;
revoke execute on function public.admin_detail_request_decide(bigint, text, text) from public, anon;
grant execute on function public.admin_partner_set_email(uuid, text)            to authenticated;
grant execute on function public.admin_partner_welcome_info(uuid)               to authenticated;
grant execute on function public.admin_detail_requests_list()                   to authenticated;
grant execute on function public.admin_detail_request_decide(bigint, text, text) to authenticated;

-- the old status-link RPCs are server-side building blocks now
revoke execute on function public.partner_status(uuid)      from public, anon, authenticated;
revoke execute on function public.partner_dashboard(uuid)   from public, anon, authenticated;
revoke execute on function public.partner_commissions(uuid) from public, anon, authenticated;
revoke execute on function public.partner_payouts(uuid)     from public, anon, authenticated;

insert into public.app_migrations (version, name) values ('168', 'partner_portal_otp')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tables = 3 | rls = 3 | policies = 0 | anon_verify = true | anon_issue = false | anon_old_status = false | mig = 1):
--   select (select count(*) from pg_tables where schemaname = 'public' and tablename in ('partner_login_codes','partner_sessions','partner_detail_requests')) as tables,
--          (select count(*) from pg_class where relname in ('partner_login_codes','partner_sessions','partner_detail_requests') and relrowsecurity) as rls,
--          (select count(*) from pg_policies where tablename in ('partner_login_codes','partner_sessions','partner_detail_requests')) as policies,
--          has_function_privilege('anon', 'public.partner_login_verify(text,text)', 'execute') as anon_verify,
--          has_function_privilege('anon', 'public.partner_login_issue(text)', 'execute') as anon_issue,
--          has_function_privilege('anon', 'public.partner_status(uuid)', 'execute') as anon_old_status,
--          (select count(*) from public.app_migrations where version = '168') as mig;
