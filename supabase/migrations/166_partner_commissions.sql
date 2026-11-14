-- 166 · Referral partners — slice 3: commission accrual (2026-11-14). Still no payout — that is slice 4.
--
-- WHAT:
--   • partner_commission_rules  — the rate, as DATA, effective-dated and append-only. The founder sets it from
--                                 /super-admin/partners; nothing is hard-coded. A rule = first-year %, renewal %,
--                                 how many renewal years earn, and the hold (refund window) in days.
--   • partner_commissions       — one row per INVOICE of a referred society (unique invoice_id). Invoices exist only
--                                 for live, paid orders (130/133), so a test-mode payment never earns. The base is
--                                 the invoice's taxable value (GST excluded).
--   • trg_invoice_partner_commission — AFTER INSERT on invoices: records the commission. It can never stop an invoice
--                                 from being issued (errors are swallowed); admin_commission_sync() catches up anything
--                                 missed, idempotently.
--
--   Basis, by the invoice date against the society's FIRST invoice date:
--     within 12 months of the first invoice (the new sale, and any upgrade that year) → first_year
--     within the next renewal_years years                                               → renewal
--     later                                                                              → none (₹0, shown, not hidden)
--   No rule in force on the invoice date → status 'no_rule', ₹0; adding a rule re-prices every 'no_rule' row it covers.
--   Status: no_rule → pending → (cancelled). "Eligible" = pending and hold_until has passed (computed, not stored).
--   There is no automatic refund flow in the product: when a payment is refunded in Razorpay, the admin cancels the
--   commission here with a reason. Paid-out commissions and clawbacks come with slice 4.
--
--   Public (anon): partner_commissions(token) — the partner's own rows, approved or suspended partners only.
--   Admin: admin_commission_rules_list · admin_commission_rule_add · admin_commissions_list ·
--          admin_commission_cancel · admin_commission_sync.
--
-- Needs 164 (partners) and 130 (invoices). Undo: 166_partner_commissions_down.sql (DESTRUCTIVE: drops the rows).

begin;

create table if not exists public.partner_commission_rules (
  id              bigserial primary key,
  effective_from  date not null unique,
  first_year_pct  numeric(5,2) not null check (first_year_pct between 0 and 50),
  renewal_pct     numeric(5,2) not null check (renewal_pct between 0 and 50),
  renewal_years   integer not null check (renewal_years between 0 and 10),
  hold_days       integer not null default 15 check (hold_days between 0 and 90),
  note            text,
  created_by      text not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.partner_commissions (
  id               bigserial primary key,
  invoice_id       uuid not null unique references public.invoices(id),
  invoice_no       text not null,
  invoice_date     date not null,
  society_id       text not null,
  partner_id       uuid not null references public.partners(id),
  code             text not null,
  kind             text not null,
  basis            text not null check (basis in ('first_year','renewal','none')),
  taxable_paise    bigint not null check (taxable_paise >= 0),
  rule_id          bigint references public.partner_commission_rules(id),
  rate_pct         numeric(5,2),
  commission_paise bigint not null default 0 check (commission_paise >= 0),
  status           text not null default 'pending' check (status in ('no_rule','pending','cancelled')),
  hold_until       date not null,
  cancel_reason    text,
  cancelled_by     text,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint partner_commissions_rule_when_priced check (status = 'no_rule' or rule_id is not null or status = 'cancelled')
);
create index if not exists idx_partner_commissions_partner on public.partner_commissions (partner_id, invoice_date);
create index if not exists idx_partner_commissions_status  on public.partner_commissions (status);

alter table public.partner_commission_rules enable row level security;
alter table public.partner_commissions      enable row level security;
revoke all on table public.partner_commission_rules from anon, authenticated;
revoke all on table public.partner_commissions      from anon, authenticated;
revoke all on sequence public.partner_commission_rules_id_seq from anon, authenticated;
revoke all on sequence public.partner_commissions_id_seq      from anon, authenticated;

-- ── pricing one invoice (internal) ───────────────────────────────────────────────────────────────────────────
-- Returns the priced fields for an invoice of a referred society, or NULL when the society has no partner.
create or replace function public._partner_commission_price(p_invoice_id uuid)
returns table (
  society_id text, partner_id uuid, code text, invoice_no text, invoice_date date, kind text,
  basis text, taxable_paise bigint, rule_id bigint, rate_pct numeric, commission_paise bigint,
  status text, hold_until date
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  i      public.invoices%rowtype;
  a      public.referral_attributions%rowtype;
  r      public.partner_commission_rules%rowtype;
  v_first date;
  v_basis text;
  v_rate  numeric;
begin
  select * into i from public.invoices where id = p_invoice_id;
  if not found then return; end if;
  select * into a from public.referral_attributions ra where ra.society_id = i.society_id;
  if not found then return; end if;

  select min(x.invoice_date) into v_first from public.invoices x where x.society_id = i.society_id;
  select * into r from public.partner_commission_rules cr
   where cr.effective_from <= i.invoice_date order by cr.effective_from desc limit 1;

  if i.invoice_date < (v_first + interval '12 months')::date then
    v_basis := 'first_year';
  elsif r.id is null or i.invoice_date < (v_first + make_interval(years => 1 + r.renewal_years))::date then
    v_basis := 'renewal';   -- provisional while there is no rule; re-priced when one is added
  else
    v_basis := 'none';
  end if;

  if r.id is null then
    return query select i.society_id, a.partner_id, a.code, i.invoice_no, i.invoice_date, i.kind,
                        v_basis, i.taxable_paise, null::bigint, null::numeric, 0::bigint,
                        'no_rule'::text, (i.invoice_date + 15)::date;
    return;
  end if;

  v_rate := case v_basis when 'first_year' then r.first_year_pct when 'renewal' then r.renewal_pct else 0 end;
  return query select i.society_id, a.partner_id, a.code, i.invoice_no, i.invoice_date, i.kind,
                      v_basis, i.taxable_paise, r.id, v_rate,
                      round(i.taxable_paise * v_rate / 100)::bigint,
                      'pending'::text, (i.invoice_date + r.hold_days)::date;
end;
$$;

-- Insert the commission for one invoice if it is owed and not yet recorded. Idempotent. Returns true if inserted.
create or replace function public._partner_commission_record(p_invoice_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  p record;
begin
  select * into p from public._partner_commission_price(p_invoice_id);
  if p.partner_id is null then return false; end if;
  insert into public.partner_commissions (invoice_id, invoice_no, invoice_date, society_id, partner_id, code, kind,
                                          basis, taxable_paise, rule_id, rate_pct, commission_paise, status, hold_until)
  values (p_invoice_id, p.invoice_no, p.invoice_date, p.society_id, p.partner_id, p.code, p.kind,
          p.basis, p.taxable_paise, p.rule_id, p.rate_pct, p.commission_paise, p.status, p.hold_until)
  on conflict (invoice_id) do nothing;
  return found;
end;
$$;

revoke execute on function public._partner_commission_price(uuid)  from public, anon, authenticated;
revoke execute on function public._partner_commission_record(uuid) from public, anon, authenticated;

-- ── the trigger: an invoice was issued ───────────────────────────────────────────────────────────────────────
create or replace function public.tg_invoice_partner_commission()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    perform public._partner_commission_record(new.id);
  exception when others then
    -- Never block the tax invoice. admin_commission_sync() records anything missed.
    raise warning 'partner commission not recorded for invoice %: %', new.invoice_no, sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.tg_invoice_partner_commission() from public, anon, authenticated;

drop trigger if exists trg_invoice_partner_commission on public.invoices;
create trigger trg_invoice_partner_commission
  after insert on public.invoices
  for each row execute function public.tg_invoice_partner_commission();

-- ── public: the partner's own commissions ────────────────────────────────────────────────────────────────────
create or replace function public.partner_commissions(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v public.partners%rowtype;
  v_rows jsonb;
begin
  select * into v from public.partners where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  if v.status not in ('approved', 'suspended') then
    return jsonb_build_object('ok', true, 'rows', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.invoice_date desc, x.id desc), '[]'::jsonb)
    into v_rows
    from (
      select c.id,
             (select s.name from public.societies s where s.id::text = c.society_id) as society_name,
             c.invoice_date, c.kind, c.basis, c.taxable_paise, c.rate_pct, c.commission_paise, c.status,
             c.hold_until, (c.status = 'pending' and c.hold_until <= current_date) as eligible, c.cancel_reason
        from public.partner_commissions c
       where c.partner_id = v.id
    ) x;
  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

-- ── platform admin ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_commission_rules_list()
returns setof public.partner_commission_rules
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.partner_commission_rules order by effective_from desc;
end;
$$;

-- Add a rule (append-only: to change the rate, add a rule with a later date). Then price every 'no_rule' row it
-- now covers. Returns how many rows were re-priced.
create or replace function public.admin_commission_rule_add(
  p_effective_from date, p_first_year_pct numeric, p_renewal_pct numeric, p_renewal_years integer,
  p_hold_days integer, p_note text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_actor text := coalesce(auth.jwt() ->> 'email', 'platform-admin');
  v_id    bigint;
  v_n     integer := 0;
  c       record;
  p       record;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_effective_from is null then
    return jsonb_build_object('ok', false, 'error_code', 'date_required');
  end if;
  if exists (select 1 from public.partner_commission_rules where effective_from = p_effective_from) then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_date');
  end if;
  if p_first_year_pct is null or p_first_year_pct not between 0 and 50
     or p_renewal_pct is null or p_renewal_pct not between 0 and 50
     or p_renewal_years is null or p_renewal_years not between 0 and 10
     or p_hold_days is null or p_hold_days not between 0 and 90 then
    return jsonb_build_object('ok', false, 'error_code', 'out_of_range');
  end if;

  insert into public.partner_commission_rules (effective_from, first_year_pct, renewal_pct, renewal_years, hold_days, note, created_by)
  values (p_effective_from, p_first_year_pct, p_renewal_pct, p_renewal_years, p_hold_days,
          nullif(btrim(coalesce(p_note, '')), ''), v_actor)
  returning id into v_id;

  for c in select id, invoice_id from public.partner_commissions where status = 'no_rule' and invoice_date >= p_effective_from loop
    select * into p from public._partner_commission_price(c.invoice_id);
    if p.status = 'pending' then
      update public.partner_commissions
         set basis = p.basis, rule_id = p.rule_id, rate_pct = p.rate_pct, commission_paise = p.commission_paise,
             status = 'pending', hold_until = p.hold_until, updated_at = now()
       where id = c.id;
      v_n := v_n + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'repriced', v_n);
end;
$$;

create or replace function public.admin_commissions_list()
returns table (
  id bigint, partner_id uuid, partner_name text, code text, society_id text, society_name text,
  invoice_no text, invoice_date date, kind text, basis text, taxable_paise bigint, rate_pct numeric,
  commission_paise bigint, status text, hold_until date, eligible boolean,
  cancel_reason text, cancelled_by text, cancelled_at timestamptz
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
    select c.id, c.partner_id, p.name, c.code, c.society_id,
           (select s.name from public.societies s where s.id::text = c.society_id),
           c.invoice_no, c.invoice_date, c.kind, c.basis, c.taxable_paise, c.rate_pct,
           c.commission_paise, c.status, c.hold_until, (c.status = 'pending' and c.hold_until <= current_date),
           c.cancel_reason, c.cancelled_by, c.cancelled_at
      from public.partner_commissions c
      join public.partners p on p.id = c.partner_id
     order by c.invoice_date desc, c.id desc;
end;
$$;

-- Cancel a commission (e.g. the payment was refunded). A reason is required and kept.
create or replace function public.admin_commission_cancel(p_id bigint, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    return jsonb_build_object('ok', false, 'error_code', 'reason_required');
  end if;
  select status into v_status from public.partner_commissions where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  if v_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error_code', 'already_cancelled');
  end if;
  update public.partner_commissions
     set status = 'cancelled', cancel_reason = v_reason, cancelled_at = now(),
         cancelled_by = coalesce(auth.jwt() ->> 'email', 'platform-admin'), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Record any commission the trigger missed (an invoice of a referred society with no commission row). Idempotent.
create or replace function public.admin_commission_sync()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_n integer := 0;
  i   record;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for i in
    select inv.id from public.invoices inv
      join public.referral_attributions a on a.society_id = inv.society_id
     where not exists (select 1 from public.partner_commissions c where c.invoice_id = inv.id)
     order by inv.invoice_date, inv.seq
  loop
    if public._partner_commission_record(i.id) then v_n := v_n + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'recorded', v_n);
end;
$$;

-- anon-exec: partner_commissions — /partner/status opens signed-out; it answers only for the secret 128-bit token and returns that partner's own commission rows (society name, date, basis, amounts, status).
revoke all on function public.partner_commissions(uuid) from public;
grant execute on function public.partner_commissions(uuid) to anon, authenticated;

revoke execute on function public.admin_commission_rules_list()                                       from public, anon;
revoke execute on function public.admin_commission_rule_add(date, numeric, numeric, integer, integer, text) from public, anon;
revoke execute on function public.admin_commissions_list()                                            from public, anon;
revoke execute on function public.admin_commission_cancel(bigint, text)                               from public, anon;
revoke execute on function public.admin_commission_sync()                                             from public, anon;
grant execute on function public.admin_commission_rules_list()                                        to authenticated;
grant execute on function public.admin_commission_rule_add(date, numeric, numeric, integer, integer, text) to authenticated;
grant execute on function public.admin_commissions_list()                                             to authenticated;
grant execute on function public.admin_commission_cancel(bigint, text)                                to authenticated;
grant execute on function public.admin_commission_sync()                                              to authenticated;

insert into public.app_migrations (version, name) values ('166', 'partner_commissions')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tables = 2 | rls = 2 | policies = 0 | trigger = 1 | anon_comm = true | anon_admin = false | mig = 1):
--   select (select count(*) from pg_tables where schemaname = 'public' and tablename in ('partner_commission_rules','partner_commissions')) as tables,
--          (select count(*) from pg_class where relname in ('partner_commission_rules','partner_commissions') and relrowsecurity) as rls,
--          (select count(*) from pg_policies where tablename in ('partner_commission_rules','partner_commissions')) as policies,
--          (select count(*) from pg_trigger where tgname = 'trg_invoice_partner_commission' and not tgisinternal) as trigger,
--          has_function_privilege('anon', 'public.partner_commissions(uuid)', 'execute') as anon_comm,
--          has_function_privilege('anon', 'public.admin_commissions_list()', 'execute') as anon_admin,
--          (select count(*) from public.app_migrations where version = '166') as mig;
