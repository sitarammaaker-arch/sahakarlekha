-- 040 down · revert the ledger-reads default. New societies go back to voucher-state reads by
-- default. Existing flags are LEFT AS-IS (flipping them off blindly could hide a tenant that has
-- been relying on ledger reads); to fully revert a specific tenant, set it false explicitly.
alter table society_settings alter column "ledgerReadsEnabled" set default false;
