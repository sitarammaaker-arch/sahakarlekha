-- 167 · Referral partners — slice 4: payouts, TDS and clawback (2026-11-14).
--
-- WHAT:
--   • partner_payment_details — PAN, bank / UPI, GSTIN per partner. Entered by the platform admin only (PII; RLS on,
--                               no policy, admin RPCs). The partner sees only "PAN on file: yes/no".
--   • partner_tds_rules       — TDS as DATA, effective-dated and append-only: rate (PAN on file), rate without PAN,
--                               the financial-year threshold, and — REQUIRED — the section and the source it was read
--                               from. Nothing statutory is hard-coded here. If TDS does not apply to the payer, the
--                               admin records a 0% rule with that reason as its source.
--   • partner_payouts / partner_payout_items — one payout = the eligible commissions chosen + every open clawback of
--                               that partner, minus TDS. The money moves OUTSIDE the app (the founder's bank / UPI);
--                               the app records it, with a UTR that is required. Each commission is paid once
--                               (unique commission_id); a paid commission's status becomes 'paid'.
--   • partner_clawbacks       — cancelling a commission that was already PAID (e.g. a refund after payout) creates a
--                               clawback, netted against that partner's next payout.
--
--   TDS on a payout (computed on the server, never trusted from the client):
--     base   = commissions chosen − open clawbacks           (must be > 0)
--     rate   = rule.rate_pct, or rule.no_pan_rate_pct when no PAN is on file
--     If this FY's bases including this one exceed rule.fy_threshold_paise, TDS due on the WHOLE FY base is
--     rate × that total, and this payout deducts (due − TDS already deducted this FY); otherwise 0.
--     (The FY runs 1 April – 31 March.) Amounts are kept in paise; the CA decides any rounding for the return.
--   admin_payout_record re-computes and refuses if the net differs from what the admin previewed (stale screen).
--
--   Public (anon): partner_payouts(token) — that partner's own payouts, open clawbacks and "PAN on file".
--   Admin: admin_partner_payment_details_get/_set · admin_tds_rules_list · admin_tds_rule_add ·
--          admin_payout_preview · admin_payout_record · admin_payouts_list · admin_commission_cancel (now also
--          handles a PAID commission → clawback).
--
-- Needs 164–166. Undo: 167_partner_payouts_down.sql (DESTRUCTIVE: drops payouts, PAN/bank details, TDS rules and
-- clawbacks; restores 166's cancel and status list — run it only before any payout was recorded).

begin;

-- ── commission status gains 'paid' ───────────────────────────────────────────────────────────────────────────
alter table public.partner_commissions drop constraint if exists partner_commissions_status_check;
alter table public.partner_commissions add constraint partner_commissions_status_check
  check (status in ('no_rule','pending','cancelled','paid'));
alter table public.partner_commissions add column if not exists payout_id bigint;

-- ── tables ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.partner_payment_details (
  partner_id        uuid primary key references public.partners(id),
  pan               text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  pan_name          text,
  account_name      text,
  account_no        text check (account_no is null or account_no ~ '^[0-9]{6,20}$'),
  ifsc              text check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  upi_id            text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$'),
  gstin             text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$'),
  updated_by        text not null,
  updated_at        timestamptz not null default now()
);

create table if not exists public.partner_tds_rules (
  id                  bigserial primary key,
  effective_from      date not null unique,
  rate_pct            numeric(5,2) not null check (rate_pct between 0 and 30),
  no_pan_rate_pct     numeric(5,2) not null check (no_pan_rate_pct between 0 and 40),
  fy_threshold_paise  bigint not null check (fy_threshold_paise >= 0),
  section_ref         text not null check (char_length(btrim(section_ref)) >= 3),
  source_ref          text not null check (char_length(btrim(source_ref)) >= 5),
  note                text,
  created_by          text not null,
  created_at          timestamptz not null default now()
);

create table if not exists public.partner_payouts (
  id              bigserial primary key,
  partner_id      uuid not null references public.partners(id),
  payout_date     date not null,
  fy              text not null,
  credit_paise    bigint not null check (credit_paise >= 0),
  clawback_paise  bigint not null default 0 check (clawback_paise >= 0),
  base_paise      bigint not null check (base_paise > 0),
  tds_rule_id     bigint not null references public.partner_tds_rules(id),
  tds_rate_pct    numeric(5,2) not null,
  pan_at_payout   text,
  tds_paise       bigint not null check (tds_paise >= 0),
  net_paise       bigint not null check (net_paise > 0),
  method          text not null check (method in ('bank','upi','other')),
  utr             text not null check (char_length(btrim(utr)) >= 6),
  note            text,
  created_by      text not null,
  created_at      timestamptz not null default now(),
  check (base_paise = credit_paise - clawback_paise),
  check (net_paise = base_paise - tds_paise)
);
create index if not exists idx_partner_payouts_partner_fy on public.partner_payouts (partner_id, fy);

create table if not exists public.partner_payout_items (
  payout_id      bigint not null references public.partner_payouts(id),
  commission_id  bigint not null unique references public.partner_commissions(id),
  primary key (payout_id, commission_id)
);

create table if not exists public.partner_clawbacks (
  id                 bigserial primary key,
  partner_id         uuid not null references public.partners(id),
  commission_id      bigint not null unique references public.partner_commissions(id),
  amount_paise       bigint not null check (amount_paise > 0),
  reason             text not null,
  settled_payout_id  bigint references public.partner_payouts(id),
  created_by         text not null,
  created_at         timestamptz not null default now()
);
create index if not exists idx_partner_clawbacks_open on public.partner_clawbacks (partner_id) where settled_payout_id is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'partner_commissions_payout_fk') then
    alter table public.partner_commissions add constraint partner_commissions_payout_fk
      foreign key (payout_id) references public.partner_payouts(id);
  end if;
end $$;

alter table public.partner_payment_details enable row level security;
alter table public.partner_tds_rules       enable row level security;
alter table public.partner_payouts         enable row level security;
alter table public.partner_payout_items    enable row level security;
alter table public.partner_clawbacks       enable row level security;
revoke all on table public.partner_payment_details from anon, authenticated;
revoke all on table public.partner_tds_rules       from anon, authenticated;
revoke all on table public.partner_payouts         from anon, authenticated;
revoke all on table public.partner_payout_items    from anon, authenticated;
revoke all on table public.partner_clawbacks       from anon, authenticated;
revoke all on sequence public.partner_tds_rules_id_seq  from anon, authenticated;
revoke all on sequence public.partner_payouts_id_seq    from anon, authenticated;
revoke all on sequence public.partner_clawbacks_id_seq  from anon, authenticated;

-- ── helpers (internal) ───────────────────────────────────────────────────────────────────────────────────────
-- Indian financial year of a date: 2026-11-14 → '2026-27', 2027-02-01 → '2026-27', 2027-04-01 → '2027-28'.
create or replace function public._partner_fy(p date)
returns text
language sql
immutable
set search_path = public
as $$
  select case when extract(month from p) >= 4
              then extract(year from p)::int::text || '-' || lpad(((extract(year from p)::int + 1) % 100)::text, 2, '0')
              else (extract(year from p)::int - 1)::text || '-' || lpad((extract(year from p)::int % 100)::text, 2, '0')
         end;
$$;
revoke execute on function public._partner_fy(date) from public, anon, authenticated;

-- The whole payout computation. p_commission_ids NULL = every eligible commission of the partner.
create or replace function public._partner_payout_calc(p_partner_id uuid, p_payout_date date, p_commission_ids bigint[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_ids        bigint[];
  v_bad        integer;
  v_credit     bigint;
  v_claw       bigint;
  v_base       bigint;
  v_fy         text := public._partner_fy(p_payout_date);
  v_pan        text;
  r            public.partner_tds_rules%rowtype;
  v_rate       numeric;
  v_fy_base    bigint;
  v_fy_tds     bigint;
  v_tds        bigint := 0;
begin
  if p_payout_date is null then
    return jsonb_build_object('ok', false, 'error_code', 'date_required');
  end if;
  if p_payout_date > current_date then
    return jsonb_build_object('ok', false, 'error_code', 'future_date');
  end if;

  if p_commission_ids is null then
    select coalesce(array_agg(c.id order by c.invoice_date, c.id), '{}') into v_ids
      from public.partner_commissions c
     where c.partner_id = p_partner_id and c.status = 'pending' and c.commission_paise > 0
       and c.hold_until <= p_payout_date;
  else
    v_ids := p_commission_ids;
    select count(*) into v_bad
      from unnest(v_ids) as x(id)
      left join public.partner_commissions c on c.id = x.id
     where c.id is null or c.partner_id <> p_partner_id or c.status <> 'pending'
        or c.commission_paise <= 0 or c.hold_until > p_payout_date;
    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'error_code', 'commission_not_payable');
    end if;
  end if;

  select coalesce(sum(c.commission_paise), 0) into v_credit from public.partner_commissions c where c.id = any(v_ids);
  select coalesce(sum(k.amount_paise), 0) into v_claw
    from public.partner_clawbacks k where k.partner_id = p_partner_id and k.settled_payout_id is null;
  v_base := v_credit - v_claw;

  select d.pan into v_pan from public.partner_payment_details d where d.partner_id = p_partner_id;
  select * into r from public.partner_tds_rules t where t.effective_from <= p_payout_date
   order by t.effective_from desc limit 1;

  if v_base <= 0 then
    return jsonb_build_object('ok', false, 'error_code', 'nothing_payable',
      'credit_paise', v_credit, 'clawback_paise', v_claw, 'commission_ids', to_jsonb(v_ids));
  end if;
  if r.id is null then
    return jsonb_build_object('ok', false, 'error_code', 'no_tds_rule',
      'credit_paise', v_credit, 'clawback_paise', v_claw, 'commission_ids', to_jsonb(v_ids));
  end if;

  v_rate := case when v_pan is null then r.no_pan_rate_pct else r.rate_pct end;
  select coalesce(sum(p.base_paise), 0), coalesce(sum(p.tds_paise), 0) into v_fy_base, v_fy_tds
    from public.partner_payouts p where p.partner_id = p_partner_id and p.fy = v_fy;
  if v_fy_base + v_base > r.fy_threshold_paise then
    v_tds := greatest(0, round((v_fy_base + v_base) * v_rate / 100)::bigint - v_fy_tds);
  end if;
  v_tds := least(v_tds, v_base - 1);   -- a payout always pays something; never a negative or zero net

  return jsonb_build_object(
    'ok', true, 'fy', v_fy, 'commission_ids', to_jsonb(v_ids),
    'credit_paise', v_credit, 'clawback_paise', v_claw, 'base_paise', v_base,
    'pan_on_file', v_pan is not null, 'tds_rule_id', r.id, 'tds_rate_pct', v_rate,
    'section_ref', r.section_ref, 'fy_threshold_paise', r.fy_threshold_paise,
    'fy_base_before_paise', v_fy_base, 'fy_tds_before_paise', v_fy_tds,
    'tds_paise', v_tds, 'net_paise', v_base - v_tds);
end;
$$;
revoke execute on function public._partner_payout_calc(uuid, date, bigint[]) from public, anon, authenticated;

-- ── admin: payment details ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_partner_payment_details_get(p_partner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  d public.partner_payment_details%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into d from public.partner_payment_details where partner_id = p_partner_id;
  if not found then return jsonb_build_object('ok', true, 'details', null); end if;
  return jsonb_build_object('ok', true, 'details', to_jsonb(d));
end;
$$;

create or replace function public.admin_partner_payment_details_set(
  p_partner_id uuid, p_pan text, p_pan_name text, p_account_name text, p_account_no text,
  p_ifsc text, p_upi_id text, p_gstin text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_pan   text := nullif(upper(regexp_replace(coalesce(p_pan, ''), '\s', '', 'g')), '');
  v_acc   text := nullif(regexp_replace(coalesce(p_account_no, ''), '\s', '', 'g'), '');
  v_ifsc  text := nullif(upper(regexp_replace(coalesce(p_ifsc, ''), '\s', '', 'g')), '');
  v_upi   text := nullif(btrim(coalesce(p_upi_id, '')), '');
  v_gst   text := nullif(upper(regexp_replace(coalesce(p_gstin, ''), '\s', '', 'g')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.partners where id = p_partner_id) then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  if v_pan is not null and v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_pan'); end if;
  if v_acc is not null and v_acc !~ '^[0-9]{6,20}$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_account'); end if;
  if v_ifsc is not null and v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_ifsc'); end if;
  if v_upi is not null and v_upi !~ '^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_upi'); end if;
  if v_gst is not null and v_gst !~ '^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$' then return jsonb_build_object('ok', false, 'error_code', 'invalid_gstin'); end if;
  if (v_acc is null) <> (v_ifsc is null) then return jsonb_build_object('ok', false, 'error_code', 'account_needs_ifsc'); end if;

  insert into public.partner_payment_details (partner_id, pan, pan_name, account_name, account_no, ifsc, upi_id, gstin, updated_by, updated_at)
  values (p_partner_id, v_pan, nullif(btrim(coalesce(p_pan_name, '')), ''), nullif(btrim(coalesce(p_account_name, '')), ''),
          v_acc, v_ifsc, v_upi, v_gst, coalesce(auth.jwt() ->> 'email', 'platform-admin'), now())
  on conflict (partner_id) do update
     set pan = excluded.pan, pan_name = excluded.pan_name, account_name = excluded.account_name,
         account_no = excluded.account_no, ifsc = excluded.ifsc, upi_id = excluded.upi_id, gstin = excluded.gstin,
         updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- ── admin: TDS rules ─────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_tds_rules_list()
returns setof public.partner_tds_rules
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.partner_tds_rules order by effective_from desc;
end;
$$;

create or replace function public.admin_tds_rule_add(
  p_effective_from date, p_rate_pct numeric, p_no_pan_rate_pct numeric, p_fy_threshold_paise bigint,
  p_section_ref text, p_source_ref text, p_note text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_id bigint;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_effective_from is null then return jsonb_build_object('ok', false, 'error_code', 'date_required'); end if;
  if exists (select 1 from public.partner_tds_rules where effective_from = p_effective_from) then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_date');
  end if;
  if p_rate_pct is null or p_rate_pct not between 0 and 30 or p_no_pan_rate_pct is null or p_no_pan_rate_pct not between 0 and 40
     or p_fy_threshold_paise is null or p_fy_threshold_paise < 0 then
    return jsonb_build_object('ok', false, 'error_code', 'out_of_range');
  end if;
  if char_length(btrim(coalesce(p_section_ref, ''))) < 3 or char_length(btrim(coalesce(p_source_ref, ''))) < 5 then
    return jsonb_build_object('ok', false, 'error_code', 'source_required');
  end if;
  insert into public.partner_tds_rules (effective_from, rate_pct, no_pan_rate_pct, fy_threshold_paise, section_ref, source_ref, note, created_by)
  values (p_effective_from, p_rate_pct, p_no_pan_rate_pct, p_fy_threshold_paise, btrim(p_section_ref), btrim(p_source_ref),
          nullif(btrim(coalesce(p_note, '')), ''), coalesce(auth.jwt() ->> 'email', 'platform-admin'))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ── admin: payouts ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_payout_preview(p_partner_id uuid, p_payout_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_calc jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  v_calc := public._partner_payout_calc(p_partner_id, p_payout_date, null);
  return v_calc || jsonb_build_object(
    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'society_name',
               (select s.name from public.societies s where s.id::text = c.society_id),
               'invoice_no', c.invoice_no, 'invoice_date', c.invoice_date, 'commission_paise', c.commission_paise)
             order by c.invoice_date, c.id)
        from public.partner_commissions c
       where c.id in (select (jsonb_array_elements_text(coalesce(v_calc -> 'commission_ids', '[]'::jsonb)))::bigint)), '[]'::jsonb),
    'clawbacks', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'amount_paise', k.amount_paise, 'reason', k.reason, 'created_at', k.created_at))
        from public.partner_clawbacks k where k.partner_id = p_partner_id and k.settled_payout_id is null), '[]'::jsonb),
    'details', (select jsonb_build_object('pan', d.pan, 'account_name', d.account_name, 'account_no', d.account_no,
                                          'ifsc', d.ifsc, 'upi_id', d.upi_id)
                  from public.partner_payment_details d where d.partner_id = p_partner_id));
end;
$$;

create or replace function public.admin_payout_record(
  p_partner_id uuid, p_payout_date date, p_commission_ids bigint[], p_expected_net_paise bigint,
  p_method text, p_utr text, p_note text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_calc   jsonb;
  v_id     bigint;
  v_actor  text := coalesce(auth.jwt() ->> 'email', 'platform-admin');
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_method not in ('bank','upi','other') then return jsonb_build_object('ok', false, 'error_code', 'invalid_method'); end if;
  if char_length(btrim(coalesce(p_utr, ''))) < 6 then return jsonb_build_object('ok', false, 'error_code', 'utr_required'); end if;
  if p_commission_ids is null or cardinality(p_commission_ids) = 0 then
    return jsonb_build_object('ok', false, 'error_code', 'commission_not_payable');
  end if;

  -- lock the partner's commissions and clawbacks so two admins cannot pay the same rows
  perform 1 from public.partner_commissions where partner_id = p_partner_id for update;
  perform 1 from public.partner_clawbacks where partner_id = p_partner_id and settled_payout_id is null for update;

  v_calc := public._partner_payout_calc(p_partner_id, p_payout_date, p_commission_ids);
  if not (v_calc ->> 'ok')::boolean then return v_calc; end if;
  if (v_calc ->> 'net_paise')::bigint is distinct from p_expected_net_paise then
    return jsonb_build_object('ok', false, 'error_code', 'stale_preview', 'net_paise', (v_calc ->> 'net_paise')::bigint);
  end if;

  insert into public.partner_payouts (partner_id, payout_date, fy, credit_paise, clawback_paise, base_paise, tds_rule_id,
                                      tds_rate_pct, pan_at_payout, tds_paise, net_paise, method, utr, note, created_by)
  values (p_partner_id, p_payout_date, v_calc ->> 'fy', (v_calc ->> 'credit_paise')::bigint, (v_calc ->> 'clawback_paise')::bigint,
          (v_calc ->> 'base_paise')::bigint, (v_calc ->> 'tds_rule_id')::bigint, (v_calc ->> 'tds_rate_pct')::numeric,
          (select d.pan from public.partner_payment_details d where d.partner_id = p_partner_id),
          (v_calc ->> 'tds_paise')::bigint, (v_calc ->> 'net_paise')::bigint, p_method, btrim(p_utr),
          nullif(btrim(coalesce(p_note, '')), ''), v_actor)
  returning id into v_id;

  insert into public.partner_payout_items (payout_id, commission_id) select v_id, x from unnest(p_commission_ids) as x;
  update public.partner_commissions set status = 'paid', payout_id = v_id, updated_at = now() where id = any(p_commission_ids);
  update public.partner_clawbacks set settled_payout_id = v_id where partner_id = p_partner_id and settled_payout_id is null;

  return jsonb_build_object('ok', true, 'id', v_id, 'net_paise', (v_calc ->> 'net_paise')::bigint, 'tds_paise', (v_calc ->> 'tds_paise')::bigint);
end;
$$;

create or replace function public.admin_payouts_list()
returns table (
  id bigint, partner_id uuid, partner_name text, code text, payout_date date, fy text, credit_paise bigint,
  clawback_paise bigint, base_paise bigint, tds_rate_pct numeric, section_ref text, pan_at_payout text,
  tds_paise bigint, net_paise bigint, method text, utr text, note text, created_by text, created_at timestamptz,
  commission_count bigint
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
    select p.id, p.partner_id, pr.name, pr.code, p.payout_date, p.fy, p.credit_paise, p.clawback_paise, p.base_paise,
           p.tds_rate_pct, t.section_ref, p.pan_at_payout, p.tds_paise, p.net_paise, p.method, p.utr, p.note,
           p.created_by, p.created_at, (select count(*) from public.partner_payout_items i where i.payout_id = p.id)
      from public.partner_payouts p
      join public.partners pr on pr.id = p.partner_id
      join public.partner_tds_rules t on t.id = p.tds_rule_id
     order by p.payout_date desc, p.id desc;
end;
$$;

-- Cancel a commission. Pending / no-rule → cancelled (as 166). PAID → cancelled AND a clawback for its amount,
-- netted against the partner's next payout.
create or replace function public.admin_commission_cancel(p_id bigint, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor  text := coalesce(auth.jwt() ->> 'email', 'platform-admin');
  c        public.partner_commissions%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    return jsonb_build_object('ok', false, 'error_code', 'reason_required');
  end if;
  select * into c from public.partner_commissions where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  if c.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error_code', 'already_cancelled');
  end if;
  if c.status = 'paid' and c.commission_paise > 0 then
    insert into public.partner_clawbacks (partner_id, commission_id, amount_paise, reason, created_by)
    values (c.partner_id, c.id, c.commission_paise, v_reason, v_actor);
  end if;
  update public.partner_commissions
     set status = 'cancelled', cancel_reason = v_reason, cancelled_at = now(), cancelled_by = v_actor, updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true, 'clawback', c.status = 'paid');
end;
$$;

-- ── public: the partner's own payouts ────────────────────────────────────────────────────────────────────────
create or replace function public.partner_payouts(p_token uuid)
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
  if v.status not in ('approved', 'suspended') then
    return jsonb_build_object('ok', true, 'payouts', '[]'::jsonb, 'clawbacks', '[]'::jsonb, 'pan_on_file', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'pan_on_file', exists (select 1 from public.partner_payment_details d where d.partner_id = v.id and d.pan is not null),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'payout_date', p.payout_date, 'fy', p.fy, 'credit_paise', p.credit_paise,
                         'clawback_paise', p.clawback_paise, 'base_paise', p.base_paise, 'tds_rate_pct', p.tds_rate_pct,
                         'tds_paise', p.tds_paise, 'net_paise', p.net_paise, 'method', p.method, 'utr', p.utr)
             order by p.payout_date desc, p.id desc)
        from public.partner_payouts p where p.partner_id = v.id), '[]'::jsonb),
    'clawbacks', coalesce((
      select jsonb_agg(jsonb_build_object('amount_paise', k.amount_paise, 'reason', k.reason, 'created_at', k.created_at))
        from public.partner_clawbacks k where k.partner_id = v.id and k.settled_payout_id is null), '[]'::jsonb));
end;
$$;

-- anon-exec: partner_payouts — /partner/status opens signed-out; it answers only for the secret 128-bit token and returns that partner's own payouts, open clawbacks and whether a PAN is on file (never the PAN or bank details).
revoke all on function public.partner_payouts(uuid) from public;
grant execute on function public.partner_payouts(uuid) to anon, authenticated;

revoke execute on function public.admin_partner_payment_details_get(uuid)                                    from public, anon;
revoke execute on function public.admin_partner_payment_details_set(uuid, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.admin_tds_rules_list()                                                     from public, anon;
revoke execute on function public.admin_tds_rule_add(date, numeric, numeric, bigint, text, text, text)        from public, anon;
revoke execute on function public.admin_payout_preview(uuid, date)                                           from public, anon;
revoke execute on function public.admin_payout_record(uuid, date, bigint[], bigint, text, text, text)        from public, anon;
revoke execute on function public.admin_payouts_list()                                                       from public, anon;
revoke execute on function public.admin_commission_cancel(bigint, text)                                      from public, anon;
grant execute on function public.admin_partner_payment_details_get(uuid)                                     to authenticated;
grant execute on function public.admin_partner_payment_details_set(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_tds_rules_list()                                                      to authenticated;
grant execute on function public.admin_tds_rule_add(date, numeric, numeric, bigint, text, text, text)         to authenticated;
grant execute on function public.admin_payout_preview(uuid, date)                                            to authenticated;
grant execute on function public.admin_payout_record(uuid, date, bigint[], bigint, text, text, text)         to authenticated;
grant execute on function public.admin_payouts_list()                                                        to authenticated;
grant execute on function public.admin_commission_cancel(bigint, text)                                       to authenticated;

insert into public.app_migrations (version, name) values ('167', 'partner_payouts')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tables = 5 | rls = 5 | policies = 0 | anon_payouts = true | anon_record = false | anon_details = false | mig = 1):
--   select (select count(*) from pg_tables where schemaname = 'public' and tablename in ('partner_payment_details','partner_tds_rules','partner_payouts','partner_payout_items','partner_clawbacks')) as tables,
--          (select count(*) from pg_class where relname in ('partner_payment_details','partner_tds_rules','partner_payouts','partner_payout_items','partner_clawbacks') and relrowsecurity) as rls,
--          (select count(*) from pg_policies where tablename in ('partner_payment_details','partner_tds_rules','partner_payouts','partner_payout_items','partner_clawbacks')) as policies,
--          has_function_privilege('anon', 'public.partner_payouts(uuid)', 'execute') as anon_payouts,
--          has_function_privilege('anon', 'public.admin_payout_record(uuid,date,bigint[],bigint,text,text,text)', 'execute') as anon_record,
--          has_function_privilege('anon', 'public.admin_partner_payment_details_get(uuid)', 'execute') as anon_details,
--          (select count(*) from public.app_migrations where version = '167') as mig;
