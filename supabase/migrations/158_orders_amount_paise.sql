-- 158 · Subscription prices become "+ GST": an order is charged to the paisa (2026-11-11).
--
-- WHY: founder 2026-11-11 — plan prices are now GST-EXCLUSIVE (Starter ₹2,999 · Plus ₹6,999 · Pro ₹14,999, plus
--   GST). ₹2,999 + 18% = ₹3,538.82, but orders.amount is whole rupees and issue_invoice() insisted that the
--   invoice total = amount × 100. A "+ GST" order could never be invoiced.
-- WHAT:
--   • orders.amount_paise — the exact amount charged (Razorpay amount), set by create-order in the base insert.
--     orders.amount stays (whole rupees, rounded) for the older readers; null amount_paise = an order from
--     before this migration, where amount × 100 is still the charge.
--   • issue_invoice = 133's body with ONE change: the total is checked against
--     coalesce(amount_paise, amount × 100).
-- ORDER OF ROLL-OUT: run this BEFORE deploying the new create-order. The new create-order writes amount_paise in
--   its base insert, so without this column every checkout stops at "Order could not be saved — nothing was
--   charged" (fail-closed; no customer pays for an order that cannot be invoiced).
-- Undo: 158_orders_amount_paise_down.sql.

begin;

alter table public.orders add column if not exists amount_paise bigint check (amount_paise is null or amount_paise > 0);

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
  -- 133: a tax invoice only for a payment KNOWN to be live. Test-mode (true) and unknown (null — orders
  -- created before create-order recorded the mode) are refused BEFORE a number is taken.
  if v_order.is_test is distinct from false then
    return jsonb_build_object('status', case when v_order.is_test then 'test_mode' else 'mode_unknown' end);
  end if;

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

  -- 158: the invoice total must be exactly what was charged. amount_paise is the charge to the paisa
  -- ("price + GST" orders); orders from before 158 only have whole rupees in amount.
  v_total := (p_calc ->> 'total_paise')::bigint;
  if v_total <> coalesce(v_order.amount_paise, v_order.amount::bigint * 100) then
    raise exception 'issue_invoice: total % paise ≠ order charge % paise', v_total, coalesce(v_order.amount_paise, v_order.amount::bigint * 100);
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

insert into public.app_migrations (version, name) values ('158', 'orders_amount_paise')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: col = 1 | guard = true | test_guard = true | anon_exec = false | mig = 1):
--   select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'amount_paise') as col,
--          (select prosrc like '%coalesce(v_order.amount_paise%' from pg_proc where proname = 'issue_invoice') as guard,
--          (select prosrc like '%is_test is distinct from false%' from pg_proc where proname = 'issue_invoice') as test_guard,
--          has_function_privilege('anon', 'public.issue_invoice(text, jsonb)', 'execute') as anon_exec,
--          (select count(*) from public.app_migrations where version = '158') as mig;
