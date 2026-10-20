-- 132 down · drops orders.buyer_* — LOSES the buyer details entered at checkout (issued invoices keep
-- their own snapshot; only not-yet-invoiced orders fall back to society_settings).
begin;
alter table public.orders drop column if exists buyer_address;
alter table public.orders drop column if exists buyer_state_code;
alter table public.orders drop column if exists buyer_gstin;
alter table public.orders drop column if exists buyer_name;
delete from public.app_migrations where version = '132';
commit;
notify pgrst, 'reload schema';
