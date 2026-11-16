-- 173 down · the helpers stop looking at is_active again (097's and 085's bodies).
begin;

create or replace function public.get_current_society_id()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select society_id::text from public.society_users
  where lower(email) = lower(auth.jwt() ->> 'email') and not public.jwt_mfa_pending()
  limit 1;
$function$;

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select role from public.society_users
  where email = auth.jwt() ->> 'email' and not public.jwt_mfa_pending()
  limit 1;
$function$;

delete from public.app_migrations where version = '173';

commit;
