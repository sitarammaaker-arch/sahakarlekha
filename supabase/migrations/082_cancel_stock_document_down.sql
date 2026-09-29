-- 082 down · drop cancel_stock_document. Deletions already made through it stay; only the function goes.
begin;
drop function if exists public.cancel_stock_document(text, text, text, text);
delete from public.app_migrations where version = '082';
commit;
