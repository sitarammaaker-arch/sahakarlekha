-- 089 · a NEW society starts with the posting service ON (Phase-2 B2).
--
-- Every voucher of a society registered from now on is written by the server (post_voucher & co.) from
-- its first day — no client-side three-step saves, so none of the drift the heal tools clean up can
-- start. Existing societies are switched by the B2 batch (scripts/posting-flag-batch.mjs), not here.
-- Requires 088 (a new society needs its open financial_years row to post).
--
-- After a society_settings row is INSERTED, insert society_flags(posting_service = true) unless the
-- society already has a flags row. Idempotent. Undo: 089_posting_service_default_on_down.sql.

begin;

create or replace function public.tg_posting_service_for_new_society()
returns trigger language plpgsql security definer
set search_path = public as $fn$
begin
  insert into public.society_flags (society_id, posting_service, updated_at, updated_by)
  values (new.society_id, true, now(), 'default for new society (089)')
  on conflict (society_id) do nothing;
  return new;
end;
$fn$;
revoke execute on function public.tg_posting_service_for_new_society() from public, anon, authenticated;

drop trigger if exists trg_posting_service_for_new_society on public.society_settings;
create trigger trg_posting_service_for_new_society
  after insert on public.society_settings
  for each row execute function public.tg_posting_service_for_new_society();

insert into public.app_migrations (version, name) values ('089', 'posting_service_default_on')
  on conflict (version) do nothing;

commit;
