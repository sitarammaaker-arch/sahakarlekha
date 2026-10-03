-- 102 undo · removes the S4-0 observer (triggers + helpers). Nothing in the books depends on it.

begin;

do $$
declare t text;
begin
  foreach t in array array['vouchers', 'voucher_entries', 'ledger_events'] loop
    execute format('drop trigger if exists s4_observe_ins on public.%I', t);
    execute format('drop trigger if exists s4_observe_upd on public.%I', t);
    execute format('drop trigger if exists s4_observe_del on public.%I', t);
  end loop;
end $$;

drop function if exists public._s4_observe();
drop function if exists public._s4_note_direct_write(text, text, text, integer);
drop function if exists public.posting_service_on(text);
delete from public.app_migrations where version = '102';

commit;
