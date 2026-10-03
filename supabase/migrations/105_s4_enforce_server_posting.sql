-- 105 · S4-b — the DATABASE enforces server posting (docs/accounting/S4-CLIENT-WRITE-ENFORCEMENT.md §3).
--
-- For a society whose posting service is ON, a signed-in client (current_user = 'authenticated') may no longer
-- INSERT / UPDATE / DELETE rows of vouchers, voucher_entries or ledger_events directly. Every accounting write
-- goes through the SECURITY DEFINER posting functions (post_voucher, edit_voucher, cancel_voucher,
-- approve_voucher, the stock-document fns, close_financial_year, and S4-a's reject_voucher /
-- set_voucher_cleared / link_voucher_reversal / sync_account_opening_event / merge_accounts /
-- save_pending_voucher). Inside them current_user is postgres, so they pass; the service role (edge fns) and
-- the owner pass too. A posting-OFF society (SSK) is unaffected. Reads are unaffected.
--
-- WHY A TRIGGER, NOT A RESTRICTIVE RLS POLICY: a restrictive USING clause makes a refused UPDATE/DELETE match
-- zero rows and return SUCCESS — a silent no-op the app would take for a save (RULE 1). The trigger RAISES
-- ('post_voucher:direct_write_refused', SQLSTATE 42501), so a missed path fails loudly: the app rolls back and
-- shows its destructive toast.
--
-- Apply ONLY after the S4-0 observer (102) has logged no direct writes for 7 days (window ends 2026-10-10).
-- Undo: 105_s4_enforce_server_posting_down.sql (drops the triggers + function).

begin;

create or replace function public._s4_refuse_direct_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sid text := case when tg_op = 'DELETE' then old.society_id::text else new.society_id::text end;
begin
  if current_user = 'authenticated' and public.posting_service_on(v_sid) then
    raise exception 'post_voucher:direct_write_refused'
      using errcode = '42501',
            detail = format('%s %s for a posting-service society must go through the server posting functions', tg_op, tg_table_name);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['vouchers', 'voucher_entries', 'ledger_events'] loop
    execute format('drop trigger if exists s4_refuse_direct_write on public.%I', t);
    execute format('create trigger s4_refuse_direct_write before insert or update or delete on public.%I for each row execute function public._s4_refuse_direct_write()', t);
  end loop;
end $$;

insert into public.app_migrations (version, name) values ('105', 's4_enforce_server_posting')
  on conflict (version) do nothing;

commit;
