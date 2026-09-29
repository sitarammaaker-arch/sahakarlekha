-- 083 down · drop update_stock_document + _cancel_voucher_core; restore 078's self-contained cancel_voucher.
begin;
drop function if exists public.update_stock_document(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text);

create or replace function public.cancel_voucher(p_id text, p_reason text default null, p_deleted_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid        text := public.get_current_society_id();
  v_role       text := auth.jwt() ->> 'user_role';
  v_cur        public.vouchers;
  v_date       date;
  v_juris      text;
  v_locked     boolean;
  v_lock_date  text;
  v_posting    public.ledger_events;
  v_seq        int;
  v_at         timestamptz := now();
  v_ev_id      text;
  v_events     jsonb := '[]'::jsonb;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_delete() then raise exception 'post_voucher:role_cannot_delete'; end if;
  if p_id is null or p_id = '' then raise exception 'post_voucher:missing_voucher_id'; end if;

  select * into v_cur from public.vouchers where id = p_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_cur."isDeleted", false) then
    return jsonb_build_object('status', 'already_cancelled', 'id', p_id, 'events', '[]'::jsonb);
  end if;
  if v_cur."reversedBy" is not null and v_cur."reversedBy" <> '' then raise exception 'post_voucher:voucher_reversed'; end if;
  if coalesce(v_cur.origin, '') = 'engine' then raise exception 'post_voucher:engine_voucher'; end if;

  begin
    v_date := substr(v_cur.date, 1, 10)::date;
  exception when others then raise exception 'post_voucher:bad_date';
  end;
  select coalesce(s."fyLocked", false), s."periodLockDate", s.jurisdiction into v_locked, v_lock_date, v_juris
  from public.society_settings s where s.society_id::text = v_sid;
  if v_locked then raise exception 'post_voucher:fy_locked'; end if;
  if v_lock_date ~ '^\d{4}-\d{2}-\d{2}' and v_date <= substr(v_lock_date, 1, 10)::date then
    raise exception 'post_voucher:period_locked';
  end if;
  if not exists (select 1 from public.financial_years f where f.society_id = v_sid and f.status = 'open'
                 and v_date between f.start_date and f.end_date) then
    raise exception 'post_voucher:voucher_in_closed_fy';
  end if;

  select * into v_posting from public.ledger_events e
  where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = p_id
    and e.event_type in ('voucher.posted', 'voucher.reposted')
  order by (e.event_type = 'voucher.reposted') desc, e.sequence desc limit 1;
  select coalesce(max(e.sequence), 0) into v_seq from public.ledger_events e
  where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = p_id;

  -- THE WRITES.
  update public.vouchers set "isDeleted" = true, "deletedAt" = to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
         "deletedBy" = p_deleted_by, "deletedReason" = p_reason
  where id = p_id;
  update public.voucher_lines set status = 'reversed' where voucher_id = p_id and status = 'posted';
  delete from public.voucher_entries where "voucherId" = p_id;

  -- Reverse the current posting, unless the journal holds none or it is already cancelled.
  if v_posting.event_id is not null and not exists (
       select 1 from public.ledger_events e where e.society_id = v_sid and e.aggregate_type = 'voucher'
       and e.aggregate_id = p_id and e.event_type = 'voucher.cancelled') then
    v_ev_id := gen_random_uuid()::text;
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values (v_ev_id, 'voucher.cancelled', 1, v_sid, v_juris, 'voucher', p_id, v_seq + 1, v_at, 'human', p_deleted_by, null, v_posting.event_id,
            (v_posting.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_posting.payload -> 'lines'), 'reason', coalesce(p_reason, '')));
    select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_events from public.ledger_events e where e.event_id = v_ev_id;
  end if;

  return jsonb_build_object('status', 'cancelled', 'id', p_id, 'events', v_events);
end;
$$;
revoke all on function public.cancel_voucher(text, text, text) from public, anon;
grant execute on function public.cancel_voucher(text, text, text) to authenticated;

drop function if exists public._cancel_voucher_core(text, text, text, text);
delete from public.app_migrations where version = '083';
commit;
