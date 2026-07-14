-- 037 down · T-09 — remove the per-tenant ledger read-cut flag.
-- Safe: the column defaults false and reads fall back to voucher-state; dropping it reverts every
-- society to the voucher-state trial balance (today's behaviour).
alter table society_settings drop column if exists "ledgerReadsEnabled";
