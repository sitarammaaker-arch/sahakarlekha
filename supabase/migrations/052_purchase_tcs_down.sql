-- 052 DOWN · remove the purchase TCS columns.
-- Destroys any recorded TCS rate/amount; the purchase rows and their vouchers survive, but a
-- TCS purchase would reload as if the seller had never collected the tax.
alter table purchases drop column if exists "tcsPct";
alter table purchases drop column if exists "tcsAmount";
