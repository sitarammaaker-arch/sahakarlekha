-- 017 DOWN · Drop the typed settlement-money columns.
-- Safe: gross/netPayable/amountPaid still live in the retained JSONB, so nothing is lost.
-- (Revert the T-05 client dual-write too, else it will keep trying to write these columns.)
alter table procurement_settlements drop column if exists "grossAmountMinor";
alter table procurement_settlements drop column if exists "grossCurrency";
alter table procurement_settlements drop column if exists "netPayableAmountMinor";
alter table procurement_settlements drop column if exists "netPayableCurrency";
alter table procurement_settlements drop column if exists "amountPaidAmountMinor";
alter table procurement_settlements drop column if exists "amountPaidCurrency";
