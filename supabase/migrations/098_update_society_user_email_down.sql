-- 098 down · drop the email-change RPC. Emails already changed stay as they are (Auth and
-- society_users agree, which is the safe state).
begin;
drop function if exists public.app_update_society_user_email(text, text);
delete from public.app_migrations where version = '098';
commit;
