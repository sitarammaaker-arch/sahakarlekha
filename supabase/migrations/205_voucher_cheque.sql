-- 205 · Cheque / DD number and date on a voucher (चेक नं. / तारीख़).
--
-- WHY: the HAFED Accounts Manual (1976, paras 4.6–4.8; Proformas IV/1 and IV/2) keeps a Cheque Issue Register and a
-- Cheque Collection Register. A voucher had nowhere to hold the cheque number — users typed it into the narration —
-- so neither register could be drawn. The rest of both registers already exists: the party is the voucher's other
-- account, the bank is its bank account, and the date of realisation is the bank-reconciliation clearedDate.
--
-- WHAT: two nullable columns. No existing row changes and no ledger is touched.
-- The app writes them in their OWN patch after the voucher is saved (not with lines / approvalStatus), so a database
-- that has not run this keeps every voucher whole and only loses the cheque number, with a mild warning.
--
-- Run BEFORE deploying the code. Reversible: 205_voucher_cheque_down.sql.

alter table public.vouchers add column if not exists "chequeNo" text;
alter table public.vouchers add column if not exists "chequeDate" date;

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('205', 'voucher_cheque')
  on conflict do nothing;

-- VERIFY: expect 2.
select count(*) as new_columns from information_schema.columns
 where table_schema = 'public' and table_name = 'vouchers' and column_name in ('chequeNo', 'chequeDate');
