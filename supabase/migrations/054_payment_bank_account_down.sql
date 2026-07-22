-- 054 DOWN · remove the payment bank-account columns.
-- Any recorded "which bank" choice is lost; the rows and their vouchers survive (the voucher
-- already carries the correct bank leg), so bank entries just revert to the default-bank display.
alter table sales          drop column if exists "bankAccountId";
alter table purchases      drop column if exists "bankAccountId";
alter table salary_records drop column if exists "bankAccountId";
