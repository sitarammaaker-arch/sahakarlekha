-- 091 undo · removes the year-close functions. A year already closed STAYS closed (its two fy.close
-- vouchers are real postings); reopening one is a manual, audited act — cancel both vouchers, then set
-- the year back to 'closing'.

begin;

drop function if exists public.close_financial_year(text, text, bigint);
drop function if exists public._fy_balances(text, date);
drop function if exists public._fy_close_post(text, text, date, text, text, jsonb, text);
delete from public.app_migrations where version = '091';

commit;
