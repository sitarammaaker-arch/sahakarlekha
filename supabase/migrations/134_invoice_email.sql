-- 134 · Email the tax invoice to the society (2026-10-21, billing slice 4).
--
-- WHAT:
--   • orders.payer_email — the signed-in user who opened the order (create-order already verifies it against
--     society_users). Written in create-order's own update AFTER the base insert, so checkout still works
--     before this migration runs. The invoice email goes here; orders without it fall back to the society's
--     active admins.
--   • invoices.emailed_at / emailed_to / email_error — the send state, written by the shared sender
--     (supabase/functions/_shared/invoice-email.mjs) with the service role:
--       emailed_at set   = claimed / sent (the claim is `where emailed_at is null`, so a repeated webhook or a
--                          double click never sends twice);
--       email_error set  = the last attempt failed or could not start (no recipient, not configured …);
--       both null        = never tried (an invoice issued before this migration).
--     Until this migration runs the claim fails and the sender sends NOTHING — no idempotency, no email.
--   admin_list_invoices returns setof public.invoices, so the new columns reach SuperAdmin without a change.
-- Additive. Undo: 134_invoice_email_down.sql.

begin;

alter table public.orders add column if not exists payer_email text;
alter table public.invoices add column if not exists emailed_at timestamptz;
alter table public.invoices add column if not exists emailed_to text;
alter table public.invoices add column if not exists email_error text;

insert into public.app_migrations (version, name) values ('134', 'invoice_email')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: order_col = 1 | invoice_cols = 3 | mig = 1):
--   select (select count(*) from information_schema.columns where table_name = 'orders' and column_name = 'payer_email') as order_col,
--          (select count(*) from information_schema.columns where table_name = 'invoices'
--             and column_name in ('emailed_at', 'emailed_to', 'email_error')) as invoice_cols,
--          (select count(*) from public.app_migrations where version = '134') as mig;
