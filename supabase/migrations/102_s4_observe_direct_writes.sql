-- 102 · S4-0 — OBSERVE direct client writes to the accounting tables (docs/accounting/S4-CLIENT-WRITE-ENFORCEMENT.md).
--
-- Changes NOTHING in the books and refuses NOTHING. For a society whose posting service is ON, every
-- statement that a signed-in client (current_user = 'authenticated') runs against vouchers /
-- voucher_entries / ledger_events writes ONE error_log row (source 's4-direct-write': table, operation,
-- row count). The posting functions (post_voucher, edit_voucher, cancel_voucher, approve_voucher, the
-- stock-document fns, close_financial_year) are SECURITY DEFINER owned by postgres, so inside them
-- current_user is postgres and they are NOT logged; the service role (edge fns) is not logged either.
-- A week of these rows is the measured inventory S4-a must cover before S4-b may refuse anything.
--
-- Safety: statement-level (one row per statement per society, not per row); every failure inside the
-- logger is swallowed — it can never fail the user's write. The trigger function is SECURITY INVOKER on
-- purpose (it must see the caller's role); the two helpers it calls are SECURITY DEFINER, so they read
-- society_flags and insert into error_log regardless of the caller's RLS.
-- Undo: 102_s4_observe_direct_writes_down.sql.

begin;

-- Reused by S4-b's restrictive policies: is the posting service ON for this society?
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

create or replace function public._s4_note_direct_write(p_society_id text, p_table text, p_op text, p_rows integer)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.error_log (id, society_id, source, message, context, actor_name)   -- error_log.id has no default
  values (gen_random_uuid()::text, p_society_id, 's4-direct-write', p_table || ' ' || p_op,
          jsonb_build_object('table', p_table, 'op', p_op, 'rows', p_rows),
          nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email', ''));
$$;
revoke execute on function public._s4_note_direct_write(text, text, text, integer) from public, anon;
-- authenticated needs EXECUTE because the invoker trigger calls it as the client. It writes a fixed shape
-- (table / op / count) to error_log, which clients can already insert into — no new capability.
grant execute on function public._s4_note_direct_write(text, text, text, integer) to authenticated;

create or replace function public._s4_observe()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
begin
  if current_user <> 'authenticated' then
    return null;                               -- posting fns (postgres), service role, owner: not a client write
  end if;
  begin
    for r in
      execute format(
        'select society_id, count(*)::int n from %s group by society_id',
        case when tg_op = 'DELETE' then 'old_rows' else 'new_rows' end)
    loop
      if public.posting_service_on(r.society_id) then
        perform public._s4_note_direct_write(r.society_id, tg_table_name, tg_op, r.n);
      end if;
    end loop;
  exception when others then
    null;                                      -- observing must never break the write
  end;
  return null;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['vouchers', 'voucher_entries', 'ledger_events'] loop
    execute format('drop trigger if exists s4_observe_ins on public.%I', t);
    execute format('drop trigger if exists s4_observe_upd on public.%I', t);
    execute format('drop trigger if exists s4_observe_del on public.%I', t);
    execute format('create trigger s4_observe_ins after insert on public.%I referencing new table as new_rows for each statement execute function public._s4_observe()', t);
    execute format('create trigger s4_observe_upd after update on public.%I referencing new table as new_rows for each statement execute function public._s4_observe()', t);
    execute format('create trigger s4_observe_del after delete on public.%I referencing old table as old_rows for each statement execute function public._s4_observe()', t);
  end loop;
end $$;

insert into public.app_migrations (version, name) values ('102', 's4_observe_direct_writes')
  on conflict (version) do nothing;

commit;
