-- 105 undo · removes the S4-b guard — direct client writes are allowed again (as before 105).

begin;

do $$
declare t text;
begin
  foreach t in array array['vouchers', 'voucher_entries', 'ledger_events'] loop
    execute format('drop trigger if exists s4_refuse_direct_write on public.%I', t);
  end loop;
end $$;
drop function if exists public._s4_refuse_direct_write();
delete from public.app_migrations where version = '105';

commit;
