-- 054 · which bank account a bank purchase / sale / salary payment hits.
--
-- WHY: the purchase, sale and salary screens all offer Payment Mode = Bank, but none let the
-- operator pick WHICH bank. The posting code silently routed every bank payment to
-- getBankAccountIds(accounts)[0] — the FIRST bank. A society with HDFC + a cooperative bank
-- could not send salary from HDFC and PF from the cooperative bank; every bank entry landed on
-- whichever bank happened to be first. This adds the column the UI now writes the chosen bank to.
--
-- sales/purchases: the Purchase/Sale types already carried bankAccountId and the posting already
-- read data.bankAccountId ?? getBankAccountIds[0] — only the column and the UI picker were missing.
-- salary_records: SalaryRecord gains bankAccountId to match.
--
-- ADDITIVE + NULLABLE, no default: running this changes NO existing row and NO existing behaviour
-- (a null bankAccountId falls back to getBankAccountIds[0], exactly as today). Reversible via _down.
-- Byte-for-byte identical to the DDL added to supabase-tables.sql (idempotent).
--
-- AFTER RUNNING: reload the PostgREST schema cache so the API sees the new columns immediately —
--   NOTIFY pgrst, 'reload schema';
-- Without it the app's step-2 save may not find the column until the cache refreshes on its own.

alter table sales          add column if not exists "bankAccountId" text;
alter table purchases      add column if not exists "bankAccountId" text;
alter table salary_records add column if not exists "bankAccountId" text;
