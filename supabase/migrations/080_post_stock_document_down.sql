-- 080 down · drop post_stock_document. Sales/purchases already posted through it stay (ordinary rows,
-- vouchers, movements); only the functions go.
begin;
drop function if exists public.post_stock_document(text, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists public._official_doc_no(text, text, text, text);
delete from public.app_migrations where version = '080';
commit;
