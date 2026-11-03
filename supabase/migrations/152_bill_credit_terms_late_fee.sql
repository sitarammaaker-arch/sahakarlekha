-- 152 · Credit terms on a bill, and the rule for the late-payment charge (विलंब शुल्क).
--
-- WHY: "credit days" were stored on the party but never reached a bill, so nothing knew when a bill fell due.
-- A bill now carries its own creditDays and dueDate, plus the charge rule that applied the day it was made, so a
-- later change of rule never alters an old bill. The rule lives on the society (one each for sales and purchases)
-- and optionally on a party.
--
-- WHAT: adds nullable columns only. No existing row changes and no ledger is touched: the charge is calculated on
-- screen and nothing posts it. Every society's rule stays empty, which means off.
--
-- Run BEFORE deploying the code: post_stock_document ignores a key with no column, so a bill saved earlier would
-- lose its terms without a word. Reversible: 152_bill_credit_terms_late_fee_down.sql.

alter table public.sales            add column if not exists "creditDays"   integer;
alter table public.sales            add column if not exists "dueDate"      text;
alter table public.sales            add column if not exists "lateFeeRule"  jsonb;
alter table public.purchases        add column if not exists "creditDays"   integer;
alter table public.purchases        add column if not exists "dueDate"      text;
alter table public.purchases        add column if not exists "lateFeeRule"  jsonb;
alter table public.customers        add column if not exists "lateFeeRule"  jsonb;
alter table public.suppliers        add column if not exists "lateFeeRule"  jsonb;
alter table public.society_settings add column if not exists "lateFeeRules" jsonb;

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('152', 'bill_credit_terms_late_fee')
  on conflict do nothing;

-- VERIFY: expect 9.
select count(*) as new_columns from information_schema.columns
 where table_schema = 'public'
   and ((table_name in ('sales', 'purchases') and column_name in ('creditDays', 'dueDate', 'lateFeeRule'))
     or (table_name in ('customers', 'suppliers') and column_name = 'lateFeeRule')
     or (table_name = 'society_settings' and column_name = 'lateFeeRules'));
