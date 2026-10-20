-- 131 · Billing invoices — platform-admin view + "invoice pending" reason (2026-10-20, slice 3).
--
-- WHAT:
--   • orders.invoice_error / invoice_tried_at — why the last issue attempt did not produce an invoice
--     (seller_incomplete / buyer_state_unknown / an error message). Written by the shared issuer
--     (supabase/functions/_shared/issue-invoice.mjs) with the service role; cleared once issued.
--   • admin_list_invoices(from, to)   — every society's invoices in a date range (SuperAdmin + GSTR-1 CSV).
--   • admin_list_pending_invoices()   — paid orders with no invoice row, with the last reason.
--   Both are SECURITY DEFINER and gated on is_platform_admin() (019/085, the JWT + 2FA predicate) — the same
--   gate as admin_list_subscriptions / admin_feedback_list. A non-admin caller gets an error, never rows.
--   The retry itself runs in the admin-retry-invoice Edge Function (issue_invoice stays service-role only).
-- Undo: 131_billing_invoices_admin_down.sql.

begin;

alter table public.orders add column if not exists invoice_error text;
alter table public.orders add column if not exists invoice_tried_at timestamptz;

create or replace function public.admin_list_invoices(p_from date, p_to date)
returns setof public.invoices
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
    select i.* from public.invoices i
    where i.invoice_date between p_from and p_to
    order by i.fy, i.seq;
end;
$$;

create or replace function public.admin_list_pending_invoices()
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

revoke execute on function public.admin_list_invoices(date, date) from public, anon;
grant execute on function public.admin_list_invoices(date, date) to authenticated;
revoke execute on function public.admin_list_pending_invoices() from public, anon;
grant execute on function public.admin_list_pending_invoices() to authenticated;

insert into public.app_migrations (version, name) values ('131', 'billing_invoices_admin')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: cols = 2 | fns = 2 | anon_exec = false | mig = 1):
--   select (select count(*) from information_schema.columns where table_name = 'orders'
--             and column_name in ('invoice_error', 'invoice_tried_at')) as cols,
--          (select count(*) from pg_proc where proname in ('admin_list_invoices', 'admin_list_pending_invoices')) as fns,
--          has_function_privilege('anon', 'public.admin_list_pending_invoices()', 'execute') as anon_exec,
--          (select count(*) from public.app_migrations where version = '131') as mig;
