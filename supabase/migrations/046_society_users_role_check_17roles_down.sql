-- 046 down · restore the legacy role whitelist (+ auditor, which the original list was
-- missing — re-adding the strict 3-name check would fail if any auditor row exists).
-- NOTE: fails if any row holds one of the 12 new roles; reassign those users first.
alter table society_users drop constraint if exists society_users_role_check;
alter table society_users add constraint society_users_role_check check (role in (
  'admin', 'accountant', 'viewer', 'auditor'
));
