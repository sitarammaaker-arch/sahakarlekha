-- 077 down · drop post_voucher and society_flags. Vouchers already posted through it stay (they are
-- ordinary vouchers with lines, entries and a journal event); only the function and the switch go.
begin;
drop function if exists public.post_voucher(jsonb, jsonb, jsonb);
drop policy if exists society_flags_tenant_select on public.society_flags;
drop table if exists public.society_flags;
delete from public.app_migrations where version = '077';
commit;
