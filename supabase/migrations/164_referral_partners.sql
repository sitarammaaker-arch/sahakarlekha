-- 164 · Referral partners — slice 1: who applied, who is approved, which society came through whom (2026-11-14).
--
-- WHAT (no money in this slice — commission and payouts are slices 3/4):
--   • partners                      — one row per applicant. code is NULL until a platform admin approves.
--                                     token is the applicant's secret status-link key (/partner/status?t=…).
--   • referral_attributions         — one row per society: which partner brought it (first touch, then locked).
--   • referral_attribution_events   — append-only history of every attach / change / remove, with the actor.
--   All three: RLS ON with NO policies and table privileges revoked — the client can never read or write them
--   directly. Every read/write goes through the SECURITY DEFINER functions below (same rule as subscriptions, 055).
--
--   Public (anon) functions:
--     partner_apply(...)                 — submit an application; returns the status token.
--     partner_status(token)              — status + code (once approved) + how many societies joined.
--     referral_code_check(code)          — is this an approved, active code? (boolean only; no names leak)
--     attach_referral_at_signup(society, code, source)
--                                        — right after register_society: only for a society created in the last
--                                          30 minutes, only if it has no partner yet, never the partner's own society.
--   Platform-admin functions (is_platform_admin(), 019/085 — a non-admin gets an error, never rows):
--     admin_partners_list() · admin_partner_decide(id, status, note)
--     admin_referrals_list() · admin_referral_set(society, code, reason)
--
-- POLICY (founder 2026-11-14): government officers — inspectors, ARCS, departmental auditors — are NEVER partners.
-- The applicant must declare (both boxes, stored with declaration_version) that they are not a public servant and
-- not a front / nominee for one. The CHECKs make an undeclared row impossible.
--
-- Undo: 164_referral_partners_down.sql.

begin;

create table if not exists public.partners (
  id                           uuid primary key default gen_random_uuid(),
  code                         text unique,
  token                        uuid not null unique default gen_random_uuid(),
  name                         text not null check (char_length(btrim(name)) between 2 and 80),
  phone                        text not null check (phone ~ '^[6-9][0-9]{9}$'),
  email                        text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  category                     text not null
                                 check (category in ('creator','accountant','ca','consultant','retired','other')),
  district                     text,
  state                        text,
  note                         text check (note is null or char_length(note) <= 1000),
  declared_not_public_servant  boolean not null check (declared_not_public_servant),
  declared_not_proxy           boolean not null check (declared_not_proxy),
  declaration_version          text not null default 'v1',
  status                       text not null default 'pending'
                                 check (status in ('pending','approved','rejected','suspended')),
  admin_note                   text,
  decided_at                   timestamptz,
  decided_by                   text,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint partners_code_when_approved check (status <> 'approved' or code is not null)
);

-- One live application per mobile number (a rejected one does not block re-applying).
create unique index if not exists uq_partners_phone_live on public.partners (phone) where status <> 'rejected';
create index if not exists idx_partners_status on public.partners (status, created_at desc);

create table if not exists public.referral_attributions (
  society_id     text primary key,
  partner_id     uuid not null references public.partners(id),
  code           text not null,
  source         text not null check (source in ('link','code','admin')),
  attributed_at  timestamptz not null default now(),
  attributed_by  text not null
);
create index if not exists idx_referral_attributions_partner on public.referral_attributions (partner_id);

create table if not exists public.referral_attribution_events (
  id               bigserial primary key,
  society_id       text not null,
  action           text not null check (action in ('attach','change','remove')),
  old_partner_id   uuid,
  new_partner_id   uuid,
  source           text,
  reason           text,
  actor            text not null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_referral_events_society on public.referral_attribution_events (society_id, created_at);

alter table public.partners                    enable row level security;
alter table public.referral_attributions       enable row level security;
alter table public.referral_attribution_events enable row level security;
revoke all on table public.partners                    from anon, authenticated;
revoke all on table public.referral_attributions       from anon, authenticated;
revoke all on table public.referral_attribution_events from anon, authenticated;
revoke all on sequence public.referral_attribution_events_id_seq from anon, authenticated;

-- ── helpers (not callable by clients) ─────────────────────────────────────────────────────────────────────────
-- 10-digit Indian mobile from whatever was typed (spaces, +91, leading 0). NULL when it is not one.
create or replace function public._partner_norm_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
           when d ~ '^[6-9][0-9]{9}$'      then d
           when d ~ '^91[6-9][0-9]{9}$'    then substr(d, 3)
           when d ~ '^0[6-9][0-9]{9}$'     then substr(d, 2)
           else null
         end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;

-- Codes look like SL-7KQ2MD: no 0/O/1/I/L, so they survive being read out over the phone.
create or replace function public._partner_new_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := 'SL-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from public.partners where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public._partner_norm_code(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')), '');
$$;

revoke all on function public._partner_norm_phone(text) from public, anon, authenticated;
revoke all on function public._partner_new_code()      from public, anon, authenticated;
revoke all on function public._partner_norm_code(text) from public, anon, authenticated;

-- ── public: apply ─────────────────────────────────────────────────────────────────────────────────────────────
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
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
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
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_email');
  end if;
  if p_category not in ('creator','accountant','ca','consultant','retired','other') then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_category');
  end if;
  if exists (select 1 from public.partners where phone = v_phone and status <> 'rejected') then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_phone');
  end if;
  -- crude flood guard: an anonymous form must not be able to fill the table
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

-- ── public: status by secret token ────────────────────────────────────────────────────────────────────────────
create or replace function public.partner_status(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v public.partners%rowtype;
begin
  select * into v from public.partners where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  return jsonb_build_object(
    'ok', true,
    'name', v.name,
    'status', v.status,
    'code', case when v.status = 'approved' then v.code end,
    'applied_at', v.created_at,
    'societies_count', (select count(*) from public.referral_attributions a where a.partner_id = v.id)
  );
end;
$$;

-- ── public: is this code usable? (boolean only) ───────────────────────────────────────────────────────────────
create or replace function public.referral_code_check(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.partners
                  where code = public._partner_norm_code(p_code) and status = 'approved');
$$;

-- ── public: attach right after signup ─────────────────────────────────────────────────────────────────────────
create or replace function public.attach_referral_at_signup(p_society_id text, p_code text, p_source text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_code    text := public._partner_norm_code(p_code);
  v_source  text := case when p_source = 'link' then 'link' else 'code' end;
  v_partner public.partners%rowtype;
  v_created timestamptz;
  v_phone   text;
begin
  select * into v_partner from public.partners where code = v_code and status = 'approved';
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_code');
  end if;

  select s.created_at::timestamptz, public._partner_norm_phone(s.phone)
    into v_created, v_phone
    from public.societies s where s.id::text = p_society_id;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  -- Only the person who just registered knows the new society's id; the window keeps this from ever being a way
  -- to claim an older society.
  if v_created is null or v_created < now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'error_code', 'too_late');
  end if;
  if exists (select 1 from public.referral_attributions where society_id = p_society_id) then
    return jsonb_build_object('ok', false, 'error_code', 'already_attributed');
  end if;
  -- A partner never earns on their own society.
  if (v_phone is not null and v_phone = v_partner.phone)
     or (v_partner.email is not null and exists (
           select 1 from public.society_users u
            where u.society_id::text = p_society_id and lower(u.email) = v_partner.email)) then
    return jsonb_build_object('ok', false, 'error_code', 'self_referral');
  end if;

  insert into public.referral_attributions (society_id, partner_id, code, source, attributed_by)
  values (p_society_id, v_partner.id, v_partner.code, v_source, 'signup');
  insert into public.referral_attribution_events (society_id, action, new_partner_id, source, actor)
  values (p_society_id, 'attach', v_partner.id, v_source, 'signup');

  return jsonb_build_object('ok', true, 'code', v_partner.code);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error_code', 'already_attributed');
end;
$$;

-- ── platform admin ────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_partners_list()
returns table (
  id uuid, code text, token uuid, name text, phone text, email text, category text,
  district text, state text, note text, declaration_version text, status text, admin_note text,
  decided_at timestamptz, decided_by text, created_at timestamptz, societies_count bigint
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
    select p.id, p.code, p.token, p.name, p.phone, p.email, p.category,
           p.district, p.state, p.note, p.declaration_version, p.status, p.admin_note,
           p.decided_at, p.decided_by, p.created_at,
           (select count(*) from public.referral_attributions a where a.partner_id = p.id)
      from public.partners p
     order by (p.status = 'pending') desc, p.created_at desc;
end;
$$;

create or replace function public.admin_partner_decide(p_id uuid, p_status text, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v public.partners%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('approved','rejected','suspended') then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_status');
  end if;
  select * into v from public.partners where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  -- A rejected application stays rejected (the person may apply again); re-approving needs a fresh application.
  if v.status = 'rejected' then
    return jsonb_build_object('ok', false, 'error_code', 'already_rejected');
  end if;
  if p_status = 'rejected' and exists (select 1 from public.referral_attributions where partner_id = p_id) then
    return jsonb_build_object('ok', false, 'error_code', 'has_societies');
  end if;

  update public.partners
     set status     = p_status,
         code       = case when p_status = 'approved' and code is null then public._partner_new_code() else code end,
         admin_note = nullif(btrim(coalesce(p_note, '')), ''),
         decided_at = now(),
         decided_by = coalesce(auth.jwt() ->> 'email', 'platform-admin'),
         updated_at = now()
   where id = p_id
  returning * into v;

  return jsonb_build_object('ok', true, 'status', v.status, 'code', v.code);
end;
$$;

create or replace function public.admin_referrals_list()
returns table (
  society_id text, society_name text, partner_id uuid, partner_name text, code text,
  source text, attributed_at timestamptz, attributed_by text, has_paid boolean
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
    select a.society_id,
           (select s.name from public.societies s where s.id::text = a.society_id limit 1),
           a.partner_id, p.name, a.code, a.source, a.attributed_at, a.attributed_by,
           exists (select 1 from public.orders o where o.society_id = a.society_id and o.status = 'paid')
      from public.referral_attributions a
      join public.partners p on p.id = a.partner_id
     order by a.attributed_at desc;
end;
$$;

-- Attach, change or (p_code empty) remove a society's partner. A reason is required and recorded. Once the society
-- has paid, the partner is locked: commission (slice 3) must never move to someone else after the money arrived.
create or replace function public.admin_referral_set(p_society_id text, p_code text, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_code    text := public._partner_norm_code(p_code);
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor   text := coalesce(auth.jwt() ->> 'email', 'platform-admin');
  v_old     public.referral_attributions%rowtype;
  v_partner public.partners%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    return jsonb_build_object('ok', false, 'error_code', 'reason_required');
  end if;
  if not exists (select 1 from public.societies s where s.id::text = p_society_id) then
    return jsonb_build_object('ok', false, 'error_code', 'society_not_found');
  end if;
  if exists (select 1 from public.orders o where o.society_id = p_society_id and o.status = 'paid') then
    return jsonb_build_object('ok', false, 'error_code', 'locked_after_payment');
  end if;

  select * into v_old from public.referral_attributions where society_id = p_society_id for update;

  if v_code is null then
    if v_old.society_id is null then
      return jsonb_build_object('ok', false, 'error_code', 'nothing_to_remove');
    end if;
    delete from public.referral_attributions where society_id = p_society_id;
    insert into public.referral_attribution_events (society_id, action, old_partner_id, source, reason, actor)
    values (p_society_id, 'remove', v_old.partner_id, 'admin', v_reason, v_actor);
    return jsonb_build_object('ok', true, 'action', 'remove');
  end if;

  select * into v_partner from public.partners where code = v_code and status = 'approved';
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_code');
  end if;
  if v_old.partner_id = v_partner.id then
    return jsonb_build_object('ok', false, 'error_code', 'unchanged');
  end if;

  insert into public.referral_attributions (society_id, partner_id, code, source, attributed_by)
  values (p_society_id, v_partner.id, v_partner.code, 'admin', v_actor)
  on conflict (society_id) do update
     set partner_id = excluded.partner_id, code = excluded.code, source = 'admin',
         attributed_at = now(), attributed_by = excluded.attributed_by;
  insert into public.referral_attribution_events (society_id, action, old_partner_id, new_partner_id, source, reason, actor)
  values (p_society_id, case when v_old.society_id is null then 'attach' else 'change' end,
          v_old.partner_id, v_partner.id, 'admin', v_reason, v_actor);

  return jsonb_build_object('ok', true, 'action', case when v_old.society_id is null then 'attach' else 'change' end,
                            'code', v_partner.code);
end;
$$;

-- anon-exec: partner_apply — the /partner application form is public (applicants have no account); it only inserts a pending row after validating every field, with a flood guard.
-- anon-exec: partner_status — /partner/status opens signed-out; it answers only for the secret 128-bit token and returns the applicant's own name/status/code/count.
-- anon-exec: referral_code_check — returns a boolean for a code; no name or other partner data leaks.
-- anon-exec: attach_referral_at_signup — runs right after the anon register_society call; it only links a society created in the last 30 minutes that has no partner yet.
revoke all on function public.partner_apply(text, text, text, text, text, text, text, boolean, boolean) from public;
revoke all on function public.partner_status(uuid)                                                   from public;
revoke all on function public.referral_code_check(text)                                              from public;
revoke all on function public.attach_referral_at_signup(text, text, text)                            from public;
grant execute on function public.partner_apply(text, text, text, text, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.partner_status(uuid)                                                   to anon, authenticated;
grant execute on function public.referral_code_check(text)                                              to anon, authenticated;
grant execute on function public.attach_referral_at_signup(text, text, text)                            to anon, authenticated;

revoke execute on function public.admin_partners_list()                       from public, anon;
revoke execute on function public.admin_partner_decide(uuid, text, text)      from public, anon;
revoke execute on function public.admin_referrals_list()                      from public, anon;
revoke execute on function public.admin_referral_set(text, text, text)        from public, anon;
grant execute on function public.admin_partners_list()                    to authenticated;
grant execute on function public.admin_partner_decide(uuid, text, text)   to authenticated;
grant execute on function public.admin_referrals_list()                   to authenticated;
grant execute on function public.admin_referral_set(text, text, text)     to authenticated;

insert into public.app_migrations (version, name) values ('164', 'referral_partners')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tables = 3 | rls = 3 | policies = 0 | anon_apply = true | anon_admin = false | mig = 1):
--   select (select count(*) from pg_tables where schemaname = 'public'
--             and tablename in ('partners','referral_attributions','referral_attribution_events')) as tables,
--          (select count(*) from pg_class where relname in ('partners','referral_attributions','referral_attribution_events')
--             and relrowsecurity) as rls,
--          (select count(*) from pg_policies where tablename in ('partners','referral_attributions','referral_attribution_events')) as policies,
--          has_function_privilege('anon', 'public.partner_apply(text,text,text,text,text,text,text,boolean,boolean)', 'execute') as anon_apply,
--          has_function_privilege('anon', 'public.admin_partners_list()', 'execute') as anon_admin,
--          (select count(*) from public.app_migrations where version = '164') as mig;
