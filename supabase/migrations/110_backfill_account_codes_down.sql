-- 110 undo · drops the backfill function. The codes it wrote STAY (they are indistinguishable from
-- codes the app assigned on create, and nothing depends on them — ids are untouched). To clear every
-- readable code instead: update public.accounts set code = null;  (then 109's down drops the column)

begin;

drop function if exists public.assign_missing_account_codes(text, boolean);

commit;
