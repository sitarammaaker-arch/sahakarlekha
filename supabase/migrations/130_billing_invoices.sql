-- 130 · Billing invoices — a GST tax invoice for every paid subscription order (2026-10-20).
--
-- WHAT: after razorpay-webhook marks an order paid, it computes the GST split (the CI-tested pure core
--   supabase/functions/_shared/invoice-core.mjs) and calls issue_invoice(). This migration adds:
--     • billing_seller   — ONE row: SahakarLekha's own legal name / GSTIN / address / state / SAC / rate.
--                          Left EMPTY on purpose: the founder fills it (paste-ready SQL at the bottom).
--                          While it is incomplete, issue_invoice issues NOTHING and burns no number.
--     • invoice_counters — one row per FY ('2026-27'); the series restarts at 0001 every 1 April (IST).
--     • invoices         — one per order (unique order_id); a frozen snapshot of seller + buyer + amounts.
--                          No client write path, no UPDATE/DELETE policy — an issued invoice never changes
--                          (a refund will be a credit note, a later slice).
--     • issue_invoice()  — service-role only. Locks the order, re-checks every amount invariant, takes the
--                          next number IN THE SAME TRANSACTION as the insert (a failed insert rolls the
--                          counter back, so the series has no gaps), returns { status, invoice_no }.
--   A paid order with no invoice row = "invoice pending" (seller incomplete / buyer state unknown / error);
--   the SuperAdmin retry (slice 3) calls issue_invoice again — it is idempotent per order.
-- Amounts are integer paise. Prices are GST-INCLUSIVE (founder 2026-10-20): total = the order amount.
-- Undo: 130_billing_invoices_down.sql (drops the invoices — only before any real invoice is issued).

begin;

-- ── Seller (platform) — a single row ──────────────────────────────────────────
create table if not exists public.billing_seller (
  id             boolean primary key default true check (id),
  legal_name     text,
  gstin          text check (gstin is null or gstin ~ '^[0-3][0-9][A-Z0-9]{13}$'),
  address        text,
  state_code     text check (state_code is null or state_code ~ '^[0-3][0-9]$'),
  sac            text,
  gst_rate_pct   numeric check (gst_rate_pct is null or (gst_rate_pct >= 0 and gst_rate_pct <= 28)),
  invoice_prefix text not null default 'SL',
  updated_at     timestamptz not null default now()
);
insert into public.billing_seller (id) values (true) on conflict (id) do nothing;
alter table public.billing_seller enable row level security;  -- no policies: server (service-role) only

-- ── Per-FY counter ────────────────────────────────────────────────────────────
create table if not exists public.invoice_counters (
  fy      text primary key check (fy ~ '^\d{4}-\d{2}$'),
  last_no integer not null default 0
);
alter table public.invoice_counters enable row level security;  -- no policies: server only

-- ── Invoices ──────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_no        text not null unique,
  fy                text not null,
  seq               integer not null,
  invoice_date      date not null,
  society_id        text not null,
  order_id          text not null unique references public.orders(id),
  payment_id        text,
  plan              text not null,
  kind              text not null,
  -- seller snapshot (as on the invoice date)
  seller_name       text not null,
  seller_gstin      text not null,
  seller_address    text not null,
  seller_state_code text not null,
  -- buyer snapshot
  buyer_name        text not null,
  buyer_address     text,
  buyer_state_code  text not null,
  buyer_gstin       text,
  place_of_supply   text not null,
  sac               text not null,
  gst_rate_pct      numeric not null,
  -- money (paise)
  taxable_paise     bigint not null check (taxable_paise >= 0),
  cgst_paise        bigint not null default 0 check (cgst_paise >= 0),
  sgst_paise        bigint not null default 0 check (sgst_paise >= 0),
  igst_paise        bigint not null default 0 check (igst_paise >= 0),
  total_paise       bigint not null check (total_paise > 0),
  created_at        timestamptz not null default now(),
  unique (fy, seq),
  check (taxable_paise + cgst_paise + sgst_paise + igst_paise = total_paise),
  check (cgst_paise = sgst_paise),
  check ((place_of_supply = seller_state_code and igst_paise = 0)
      or (place_of_supply <> seller_state_code and cgst_paise = 0 and sgst_paise = 0))
);
create index if not exists idx_invoices_society on public.invoices (society_id);

alter table public.invoices enable row level security;
-- Read-own-society only (the slice-2 download list); no client write policy → server writes only.
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
  for select using (society_id = get_current_society_id());

-- ── issue_invoice ─────────────────────────────────────────────────────────────
-- p_calc = the core's output: { buyer_name, buyer_address, buyer_state_code, buyer_gstin, place_of_supply,
--   gst_rate_pct, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise }. Every figure is
-- re-checked here against the order and the seller row — the caller's arithmetic is never trusted blind.
create or replace function public.issue_invoice(p_order_id text, p_calc jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order   public.orders%rowtype;
  v_seller  public.billing_seller%rowtype;
  v_existing text;
  v_date    date := (now() at time zone 'Asia/Kolkata')::date;
  v_fy      text;
  v_seq     integer;
  v_no      text;
  v_total   bigint;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('status', 'unknown_order'); end if;
  if v_order.status <> 'paid' then return jsonb_build_object('status', 'order_not_paid'); end if;

  select invoice_no into v_existing from public.invoices where order_id = p_order_id;
  if v_existing is not null then return jsonb_build_object('status', 'already', 'invoice_no', v_existing); end if;

  select * into v_seller from public.billing_seller where id;
  if v_seller.legal_name is null or v_seller.gstin is null or v_seller.address is null
     or v_seller.state_code is null or v_seller.sac is null or v_seller.gst_rate_pct is null then
    return jsonb_build_object('status', 'seller_incomplete');
  end if;
  if coalesce(p_calc ->> 'place_of_supply', '') !~ '^[0-3][0-9]$' then
    return jsonb_build_object('status', 'buyer_state_unknown');
  end if;

  v_total := (p_calc ->> 'total_paise')::bigint;
  if v_total <> v_order.amount::bigint * 100 then
    raise exception 'issue_invoice: total % paise ≠ order % × 100', v_total, v_order.amount;
  end if;
  if (p_calc ->> 'gst_rate_pct')::numeric <> v_seller.gst_rate_pct then
    raise exception 'issue_invoice: rate % ≠ seller rate %', p_calc ->> 'gst_rate_pct', v_seller.gst_rate_pct;
  end if;

  -- FY of the invoice date (IST): April–March, label 'YYYY-YY'.
  v_fy := case when extract(month from v_date) >= 4
               then to_char(v_date, 'YYYY') || '-' || to_char(v_date + interval '1 year', 'YY')
               else to_char(v_date - interval '1 year', 'YYYY') || '-' || to_char(v_date, 'YY') end;

  insert into public.invoice_counters as c (fy, last_no) values (v_fy, 1)
    on conflict (fy) do update set last_no = c.last_no + 1
    returning last_no into v_seq;
  v_no := v_seller.invoice_prefix || '/' || v_fy || '/' || lpad(v_seq::text, 4, '0');
  if length(v_no) > 16 then raise exception 'issue_invoice: invoice number % is longer than 16 characters', v_no; end if;

  -- The table's CHECKs enforce taxable + taxes = total, CGST = SGST, and intra (CGST/SGST) vs inter (IGST).
  insert into public.invoices (
    invoice_no, fy, seq, invoice_date, society_id, order_id, payment_id, plan, kind,
    seller_name, seller_gstin, seller_address, seller_state_code,
    buyer_name, buyer_address, buyer_state_code, buyer_gstin, place_of_supply, sac, gst_rate_pct,
    taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise
  ) values (
    v_no, v_fy, v_seq, v_date, v_order.society_id, v_order.id, v_order.payment_id, v_order.plan, v_order.kind,
    v_seller.legal_name, v_seller.gstin, v_seller.address, v_seller.state_code,
    coalesce(nullif(p_calc ->> 'buyer_name', ''), v_order.society_id), nullif(p_calc ->> 'buyer_address', ''),
    p_calc ->> 'buyer_state_code', nullif(p_calc ->> 'buyer_gstin', ''), p_calc ->> 'place_of_supply',
    v_seller.sac, v_seller.gst_rate_pct,
    (p_calc ->> 'taxable_paise')::bigint, (p_calc ->> 'cgst_paise')::bigint, (p_calc ->> 'sgst_paise')::bigint,
    (p_calc ->> 'igst_paise')::bigint, v_total
  );

  return jsonb_build_object('status', 'issued', 'invoice_no', v_no);
end;
$$;

revoke execute on function public.issue_invoice(text, jsonb) from public, anon, authenticated;
grant execute on function public.issue_invoice(text, jsonb) to service_role;

insert into public.app_migrations (version, name) values ('130', 'billing_invoices')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tables = 3 | seller_rows = 1 | anon_exec = false | mig = 1):
--   select (select count(*) from information_schema.tables where table_schema = 'public'
--             and table_name in ('billing_seller', 'invoice_counters', 'invoices')) as tables,
--          (select count(*) from public.billing_seller) as seller_rows,
--          has_function_privilege('anon', 'public.issue_invoice(text, jsonb)', 'execute') as anon_exec,
--          (select count(*) from public.app_migrations where version = '130') as mig;
--
-- FILL THE SELLER (founder — once the details and the CA-confirmed SAC + rate are in hand):
--   update public.billing_seller set
--     legal_name   = '<कानूनी नाम>',
--     gstin        = '<15-अक्षर GSTIN>',
--     address      = '<पूरा पता>',
--     state_code   = '<GSTIN के पहले 2 अंक, जैसे 06>',
--     sac          = '<CA से पक्का SAC>',
--     gst_rate_pct = <CA से पक्की दर>,
--     updated_at   = now()
--   where id;
