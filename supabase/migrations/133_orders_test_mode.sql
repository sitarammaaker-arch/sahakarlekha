-- 133 · Never a tax invoice for a TEST-mode payment (2026-10-20).
--
-- WHY: production has 6 "paid" orders from 21–22 Aug 2026 — the day Razorpay checkout was verified in TEST mode
--   (one society bought Starter four times). Once billing_seller is filled they would have shown as "invoice
--   pending", and a retry would have spent real GST invoice numbers (SL/2026-27/0001…) on test payments. Same for
--   every future payment while the Supabase secrets still hold rzp_test_ keys.
-- WHAT:
--   • orders.is_test — true = test-mode key, false = live key, null = unknown (created before this). create-order
--     sets it from RAZORPAY_KEY_ID's prefix, in its own update after the base insert.
--   • issue_invoice = 130's body + ONE guard: invoices only where is_test = false (test → 'test_mode',
--     null → 'mode_unknown'), checked before a number is taken.
--   • admin_list_pending_invoices also returns is_test (return type changes → drop + create) and leaves
--     test-mode orders out of "pending" — they will never get an invoice.
--   Marking the 6 old orders as test is a separate founder SQL step (data, not schema) — see the bottom.
-- Undo: 133_orders_test_mode_down.sql.

begin;

alter table public.orders add column if not exists is_test boolean;

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

drop function if exists public.admin_list_pending_invoices();
create function public.admin_list_pending_invoices()
returns table (
  order_id text, society_id text, society_name text, plan text, kind text, amount integer,
  paid_at timestamptz, invoice_error text, invoice_tried_at timestamptz, is_test boolean
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
    select o.id, o.society_id,
           (select s.name from public.society_settings s where s.society_id = o.society_id limit 1),
           o.plan, o.kind, o.amount, o.updated_at, o.invoice_error, o.invoice_tried_at, o.is_test
    from public.orders o
    where o.status = 'paid'
      and o.is_test is distinct from true
      and not exists (select 1 from public.invoices i where i.order_id = o.id)
    order by o.updated_at;
end;
$$;

revoke execute on function public.admin_list_pending_invoices() from public, anon;
grant execute on function public.admin_list_pending_invoices() to authenticated;

insert into public.app_migrations (version, name) values ('133', 'orders_test_mode')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: col = 1 | guard = true | anon_exec = false | mig = 1):
--   select (select count(*) from information_schema.columns where table_name = 'orders' and column_name = 'is_test') as col,
--          (select prosrc like '%is_test is distinct from false%' from pg_proc where proname = 'issue_invoice') as guard,
--          has_function_privilege('anon', 'public.issue_invoice(text, jsonb)', 'execute') as anon_exec,
--          (select count(*) from public.app_migrations where version = '133') as mig;
--
-- MARK THE 6 TEST ORDERS (founder, after 133; ids read from prod 2026-10-20 — expect "UPDATE 6"):
--   update public.orders set is_test = true
--   where status = 'paid' and is_test is null
--     and id in ('order_TSYmz8H2tZeGf6', 'order_TSfhw5X8QqxXLc', 'order_TSfmz0AaGXypUo',
--                'order_TSgI2SVJtVrN0m', 'order_TSgLGVIEvjCqHl', 'order_TSmlXNqNBmYIKH');
