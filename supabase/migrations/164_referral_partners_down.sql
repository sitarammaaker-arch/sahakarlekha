-- 164 down · remove the referral-partner tables and functions. DESTRUCTIVE: drops every application and every
-- society → partner link. Export them first (admin_partners_list / admin_referrals_list) if they matter.
begin;

drop function if exists public.admin_referral_set(text, text, text);
drop function if exists public.admin_referrals_list();
drop function if exists public.admin_partner_decide(uuid, text, text);
drop function if exists public.admin_partners_list();
drop function if exists public.attach_referral_at_signup(text, text, text);
drop function if exists public.referral_code_check(text);
drop function if exists public.partner_status(uuid);
drop function if exists public.partner_apply(text, text, text, text, text, text, text, boolean, boolean);
drop function if exists public._partner_norm_code(text);
drop function if exists public._partner_new_code();
drop function if exists public._partner_norm_phone(text);

drop table if exists public.referral_attribution_events;
drop table if exists public.referral_attributions;
drop table if exists public.partners;

delete from public.app_migrations where version = '164';

commit;

notify pgrst, 'reload schema';
