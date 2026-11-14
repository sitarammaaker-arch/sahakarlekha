-- 165 down · drop the slice-2 functions. No data is touched (the tables belong to 164).
begin;

drop function if exists public.admin_partner_rotate_token(uuid);
drop function if exists public.admin_referral_events(text);
drop function if exists public.partner_dashboard(uuid);

delete from public.app_migrations where version = '165';

commit;

notify pgrst, 'reload schema';
