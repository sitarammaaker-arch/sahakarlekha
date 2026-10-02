-- 097 down · restore the exact-match helper. Email normalisation is NOT reverted (lower-case emails
-- are what Supabase Auth stores; reverting would re-break the affected user).
create or replace function public.get_current_society_id()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select society_id::text from public.society_users
  where email = auth.jwt() ->> 'email' and not public.jwt_mfa_pending()
  limit 1;
$function$;
