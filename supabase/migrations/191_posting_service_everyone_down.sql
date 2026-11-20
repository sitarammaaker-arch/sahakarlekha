-- Undo 191 · restores the old column default and the old posting_service_on() (a missing row = off).
-- The flag rows 191 inserted are NOT removed automatically (turning a society's posting service off is a
-- decision, not a rollback). To see them:  select * from public.society_flags where updated_by = 'ARCH-03 (191)';
-- To turn one off: update public.society_flags set posting_service = false, updated_at = now() where society_id = '<id>';
begin;

alter table public.society_flags alter column posting_service set default false;

create or replace function public.posting_service_on(p_society_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select posting_service from public.society_flags where society_id = p_society_id), false);
$$;
revoke execute on function public.posting_service_on(text) from public, anon;
grant execute on function public.posting_service_on(text) to authenticated;

delete from public.app_migrations where version = '191';

commit;
