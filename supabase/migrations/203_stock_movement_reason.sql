-- 203 · Why the stock changed, and who answers for it (गोदाम घटत / बढ़त).
--
-- WHY: the HAFED Accounts Manual (1976, paras 9.19, 9.25, 10.20; heads 23.13 / 32.12) books a godown shortage against
-- the person responsible ("Shortage recoverable") and keeps normal driage, damage and excess apart. A manual stock
-- adjustment kept only a signed quantity and free narration, so the shortage register could not say why stock fell
-- or from whom it is due.
--
-- WHAT: two nullable columns on stock_movements. No existing row changes and no ledger is touched:
--   reason            — normalLoss | damage | shortageRecoverable | shortageReversal | excess | other
--   responsiblePerson — the name of the person a recoverable shortage is booked to (the ledger carries the money)
-- The app writes both in its step-2 patch, so a movement still saves before this runs — it only loses the reason.
--
-- Run BEFORE deploying the code. Reversible: 203_stock_movement_reason_down.sql.

alter table public.stock_movements add column if not exists "reason" text;
alter table public.stock_movements add column if not exists "responsiblePerson" text;

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('203', 'stock_movement_reason')
  on conflict do nothing;

-- VERIFY: expect 2.
select count(*) as new_columns from information_schema.columns
 where table_schema = 'public' and table_name = 'stock_movements' and column_name in ('reason', 'responsiblePerson');
