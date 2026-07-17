-- 052 · TCS on purchases — the income tax a SELLER collects from us.
--
-- WHY: a forest-depot timber bill reads
--        base 41,03,009 + IGST 18% 7,38,542 + "I.T." 2% 82,060 = 49,23,611.
-- That 2% is NOT the TDS we deduct from a supplier — it runs the other way. The depot collects
-- it FROM the society and ADDS it to the bill; it is the society's own income-tax credit (it
-- shows in 26AS) and is Dr'd to 3307 "TDS / TCS Receivable", an ASSET. TDS is the mirror image:
-- we withhold it, the payable goes DOWN, and it is Cr'd to 2202 TDS Payable, a LIABILITY.
--
-- Before this, the only field on the purchase screen was tdsPct, which SUBTRACTS. Putting the
-- depot's 2% there produced ₹47,59,491 against a ₹49,23,611 bill — short by twice the tax — and
-- parked ₹82,060 in TDS Payable, asserting the society owed the government money it had in fact
-- already paid to the depot. There was no field that could record this bill correctly.
--
-- ADDITIVE + INERT: both columns default 0, so running this changes no existing row and no
-- existing total (grandTotal = net + tax + 0 − tds is exactly today's formula). Reversible via
-- _down. Byte-for-byte identical to the DDL in supabase-tables.sql (idempotent).
--
-- REQUIRED before TCS can be saved: the app writes tcsPct/tcsAmount in the step-2 extras update
-- (RULE 1), so without this migration the purchase itself still saves — but its TCS silently does
-- not, and the reloaded purchase would disagree with its own voucher. The app raises a
-- destructive toast naming this migration when that update fails.

alter table purchases add column if not exists "tcsPct" numeric default 0;
alter table purchases add column if not exists "tcsAmount" numeric default 0;
