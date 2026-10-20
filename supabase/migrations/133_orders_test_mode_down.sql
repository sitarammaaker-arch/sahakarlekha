-- 133 down · restores issue_invoice (130 body) and admin_list_pending_invoices (131), drops orders.is_test.
-- After this, test-mode payments can be invoiced again — do not run it once live billing has started.
begin;

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

drop function if exists public.admin_list_pending_invoices();
create function public.admin_list_pending_invoices()
returns table (
  order_id text, society_id text, society_name text, plan text, kind text, amount integer,
  paid_at timestamptz, invoice_error text, invoice_tried_at timestamptz
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
           o.plan, o.kind, o.amount, o.updated_at, o.invoice_error, o.invoice_tried_at
    from public.orders o
    where o.status = 'paid'
      and not exists (select 1 from public.invoices i where i.order_id = o.id)
    order by o.updated_at;
end;
$$;

revoke execute on function public.admin_list_pending_invoices() from public, anon;
grant execute on function public.admin_list_pending_invoices() to authenticated;

alter table public.orders drop column if exists is_test;
delete from public.app_migrations where version = '133';
commit;
notify pgrst, 'reload schema';
