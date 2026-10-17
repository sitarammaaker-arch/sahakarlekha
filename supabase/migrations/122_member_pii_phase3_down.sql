-- 122 down · removes the PII-redirect trigger. It does NOT restore the blanked members.aadhaar / pan — those live on in
-- member_identity (the app reads them from there); the old copies come back only from a backup taken before 122.
begin;
drop trigger if exists members_pii_redirect on public.members;
drop function if exists public.members_pii_redirect();
delete from public.app_migrations where version = '122';
commit;
