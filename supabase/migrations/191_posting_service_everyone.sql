-- 191 · ARCH-03 (product audit 2026-11-17) — the posting service is ON for every society.
--
-- Before: 37 of 38 societies had society_flags.posting_service = true; one society (created before the 089
-- trigger) had no flag row at all, so it ran the client's old multi-call sale / purchase save (3 + 2N separate
-- requests, partial rollback) and the 105 direct-write guard did not protect it.
--
-- 1. Every society without a flag row gets one, ON (the same row 089's trigger writes for a new society).
-- 2. The column default becomes true, so a row written any other way is ON too.
-- 3. posting_service_on() reads a MISSING row as ON (was: off) — the 105 guard can no longer be skipped by a
--    society that has no row. An explicit false row still means off (kept as the emergency switch).
--
-- The app (same PR) also reads a missing row / read error as ON, and sales / purchases no longer have a client
-- save at all — they go only through post_stock_document / update_stock_document / cancel_stock_document.
-- Undo: 191_posting_service_everyone_down.sql (restores the old default and function; the inserted rows stay —
-- the down file lists how to find them).
begin;

insert into public.society_flags (society_id, posting_service, updated_at, updated_by)
select s.society_id::text, true, now(), 'ARCH-03 (191)'
  from public.society_settings s
 where not exists (select 1 from public.society_flags f where f.society_id = s.society_id::text)
on conflict (society_id) do nothing;

alter table public.society_flags alter column posting_service set default true;

create or replace function public.posting_service_on(p_society_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select posting_service from public.society_flags where society_id = p_society_id), true);
$$;
revoke execute on function public.posting_service_on(text) from public, anon;
grant execute on function public.posting_service_on(text) to authenticated;

insert into public.app_migrations (version, name) values ('191', 'posting_service_everyone')
  on conflict (version) do nothing;

commit;
