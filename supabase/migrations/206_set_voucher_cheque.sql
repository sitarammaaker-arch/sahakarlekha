-- 206 · set_voucher_cheque — the cheque / DD no. and date on a voucher, through the server (posting-service societies).
--
-- WHY: migration 205 added vouchers."chequeNo" / "chequeDate" and the app wrote them with a direct UPDATE. For a society
-- whose posting service is ON, migration 105's trigger refuses every direct write to vouchers
-- ('post_voucher:direct_write_refused') — found on the live site 2026-11-24 (Rania): the voucher saved, the cheque no.
-- did not. Every other voucher write for such a society goes through a SECURITY DEFINER function (set_voucher_cleared
-- for the bank-reconciliation flag is the model); this is the same for the two cheque columns.
--
-- WHAT: one function. It touches ONLY "chequeNo" / "chequeDate" — never the amount, accounts, lines, entries or journal —
-- so it is allowed on an approved or posted voucher, like set_voucher_cleared. Refused when the voucher is cancelled,
-- when the year is audit-locked, or when the login cannot write. A posting-OFF society keeps the direct update.
--
-- Run BEFORE deploying the code. Reversible: 206_set_voucher_cheque_down.sql.

begin;

create or replace function public.set_voucher_cheque(p_id text, p_cheque_no text, p_cheque_date text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid  text := public.get_current_society_id();
  v_cur  public.vouchers;
  v_no   text := nullif(btrim(coalesce(p_cheque_no, '')), '');
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if exists (select 1 from public.society_settings s where s.society_id::text = v_sid and coalesce(s."fyLocked", false)) then
    raise exception 'post_voucher:fy_locked';
  end if;
  if p_cheque_date is not null and p_cheque_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'post_voucher:bad_date'; end if;
  if v_no is not null and length(v_no) > 40 then raise exception 'post_voucher:bad_cheque_no'; end if;
  select * into v_cur from public.vouchers where id = p_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_cur."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
  update public.vouchers set "chequeNo" = v_no, "chequeDate" = p_cheque_date::date where id = p_id;
  return jsonb_build_object('status', 'ok', 'id', p_id, 'chequeNo', v_no, 'chequeDate', p_cheque_date);
end;
$$;

revoke execute on function public.set_voucher_cheque(text, text, text) from public, anon;
grant execute on function public.set_voucher_cheque(text, text, text) to authenticated;

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('206', 'set_voucher_cheque')
  on conflict do nothing;

commit;

-- VERIFY: expect fn = 1, security_definer = true, migration = 1.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_voucher_cheque') as fn,
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_voucher_cheque') as security_definer,
  (select count(*) from public.app_migrations where version = '206') as migration;
