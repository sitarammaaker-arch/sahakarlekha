-- 076 down · drop voucher_lines and the historical FYs 076 created. Nothing reads either yet.
begin;
drop policy if exists voucher_lines_tenant_select on public.voucher_lines;
drop table if exists public.voucher_lines;
delete from public.financial_years where close_authority = 'backfill (S2): pre-M1 history';
delete from public.app_migrations where version = '076';
commit;
