-- 166 down · remove commission accrual. DESTRUCTIVE: drops every commission row and every rule. Export them first
-- (admin_commissions_list / admin_commission_rules_list) if they matter. Invoices are not touched.
begin;

drop trigger if exists trg_invoice_partner_commission on public.invoices;
drop function if exists public.tg_invoice_partner_commission();
drop function if exists public.admin_commission_sync();
drop function if exists public.admin_commission_cancel(bigint, text);
drop function if exists public.admin_commissions_list();
drop function if exists public.admin_commission_rule_add(date, numeric, numeric, integer, integer, text);
drop function if exists public.admin_commission_rules_list();
drop function if exists public.partner_commissions(uuid);
drop function if exists public._partner_commission_record(uuid);
drop function if exists public._partner_commission_price(uuid);

drop table if exists public.partner_commissions;
drop table if exists public.partner_commission_rules;

delete from public.app_migrations where version = '166';

commit;

notify pgrst, 'reload schema';
