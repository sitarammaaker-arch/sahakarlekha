-- 046 · ECR-06 17-role rollout — widen society_users' role CHECK to the 16 assignable names.
--
-- FOUND BY THE S4 PILOT (exactly what the pilot exists for): creating a 'cashier' failed with
--   new row for relation "society_users" violates check constraint "society_users_role_check"
-- The role whitelist the runbook went looking for was not in app_add_society_user (p_role is
-- an unchecked text) — it is a CHECK CONSTRAINT on the table itself, and its list is
-- ('admin','accountant','viewer'): it does not even include 'auditor', so assigning the
-- legacy auditor role via this path would have failed the same way.
--
-- The new list = the UserRole union (types/index.ts) = the 16 names the dropdown offers.
-- Existing rows all hold one of the legacy names, so re-adding the constraint validates fine.
alter table society_users drop constraint if exists society_users_role_check;
alter table society_users add constraint society_users_role_check check (role in (
  'admin', 'accountant', 'viewer', 'auditor',
  'manager', 'secretary', 'cashier', 'storeKeeper', 'procurementOfficer',
  'salesOperator', 'internalAuditor', 'externalCA', 'boardMember', 'chairman',
  'employee', 'dataEntry'
));
