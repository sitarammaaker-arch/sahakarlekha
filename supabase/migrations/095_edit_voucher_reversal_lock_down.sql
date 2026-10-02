-- 095 down · restores edit_voucher without the reversal-voucher check.

begin;

CREATE OR REPLACE FUNCTION public.edit_voucher(p_voucher jsonb, p_lines jsonb, p_producer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid        text := public.get_current_society_id();
  v_role       text := auth.jwt() ->> 'user_role';
  v_id         text := p_voucher ->> 'id';
  v_cur        public.vouchers;
  v_new        public.vouchers;
  v_patch      jsonb;
  v_old_date   date;
  v_new_date   date;
  v_fy         uuid;
  v_juris      text;
  v_locked     boolean;
  v_lock_date  text;
  v_dr         bigint := 0;
  v_cr         bigint := 0;
  v_total      bigint;
  v_n          int := 0;
  v_legs       jsonb;
  v_posting    public.ledger_events;
  v_seq        int;
  v_meta       jsonb;
  v_events     jsonb := '[]'::jsonb;
  v_line_base  int;
  v_at         timestamptz := now();
  v_ev_id      text;
  v_ev2_id     text;
  l            jsonb;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if v_id is null or v_id = '' then raise exception 'post_voucher:missing_voucher_id'; end if;

  select * into v_cur from public.vouchers where id = v_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_cur."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
  if v_cur."reversedBy" is not null and v_cur."reversedBy" <> '' then raise exception 'post_voucher:voucher_reversed'; end if;
  if coalesce(v_cur."approvalStatus", '') = 'pending' then raise exception 'post_voucher:pending_not_supported'; end if;
  if coalesce(v_cur.origin, '') = 'engine' then raise exception 'post_voucher:engine_voucher'; end if;

  -- Only the editable fields; everything else (id, number, society, deletion, links) stays as stored.
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_voucher)
  where key in ('type', 'date', 'debitAccountId', 'creditAccountId', 'amount', 'narration', 'memberId', 'lines', 'editHistory');
  v_new := jsonb_populate_record(v_cur, v_patch);

  begin
    v_old_date := substr(v_cur.date, 1, 10)::date;
    v_new_date := substr(v_new.date, 1, 10)::date;
  exception when others then raise exception 'post_voucher:bad_date';
  end;

  select coalesce(s."fyLocked", false), s."periodLockDate", s.jurisdiction into v_locked, v_lock_date, v_juris
  from public.society_settings s where s.society_id::text = v_sid;
  if v_locked then raise exception 'post_voucher:fy_locked'; end if;
  if v_lock_date ~ '^\d{4}-\d{2}-\d{2}'
     and (v_old_date <= substr(v_lock_date, 1, 10)::date or v_new_date <= substr(v_lock_date, 1, 10)::date) then
    raise exception 'post_voucher:period_locked';
  end if;
  if not exists (select 1 from public.financial_years f where f.society_id = v_sid and f.status in ('open', 'closing')
                 and v_old_date between f.start_date and f.end_date) then
    raise exception 'post_voucher:voucher_in_closed_fy';
  end if;
  select f.id into v_fy from public.financial_years f
  where f.society_id = v_sid and f.status in ('open', 'closing') and v_new_date between f.start_date and f.end_date;
  if v_fy is null then raise exception 'post_voucher:no_open_fy_for_date'; end if;

  -- New legs: same checks as post_voucher.
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'post_voucher:lines_not_array'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    if coalesce(l ->> 'accountId', '') = '' or coalesce(l ->> 'id', '') = '' then raise exception 'post_voucher:bad_leg'; end if;
    if (l ->> 'amountMinor')::bigint < 0 then raise exception 'post_voucher:negative_amount'; end if;
    if l ->> 'drCr' = 'Dr' then v_dr := v_dr + (l ->> 'amountMinor')::bigint;
    elsif l ->> 'drCr' = 'Cr' then v_cr := v_cr + (l ->> 'amountMinor')::bigint;
    else raise exception 'post_voucher:bad_side'; end if;
  end loop;
  if v_n < 2 then raise exception 'post_voucher:too_few_legs'; end if;
  if v_dr <> v_cr or v_dr = 0 then raise exception 'post_voucher:unbalanced'; end if;
  if jsonb_typeof(v_new.lines) = 'array' and jsonb_array_length(v_new.lines) > 0 then
    select coalesce(sum(round(((x ->> 'amount')::numeric) * 100)), 0)::bigint into v_total
    from jsonb_array_elements(v_new.lines) x where x ->> 'type' = 'Dr';
  else
    v_total := round(v_new.amount * 100)::bigint;
  end if;
  if v_total <> v_dr then raise exception 'post_voucher:legs_do_not_match_voucher'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('accountId', x ->> 'accountId', 'drCr', x ->> 'drCr', 'amountMinor', (x ->> 'amountMinor')::bigint) order by ord), '[]'::jsonb)
    into v_legs from jsonb_array_elements(p_lines) with ordinality as t(x, ord);

  -- The current posting in the journal: latest reposted, else posted.
  select * into v_posting from public.ledger_events e
  where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = v_id
    and e.event_type in ('voucher.posted', 'voucher.reposted')
  order by (e.event_type = 'voucher.reposted') desc, e.sequence desc limit 1;
  select coalesce(max(e.sequence), 0) into v_seq from public.ledger_events e
  where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = v_id;

  -- THE WRITES.
  update public.vouchers t set
    "type" = v_new."type", "date" = v_new."date", "debitAccountId" = v_new."debitAccountId",
    "creditAccountId" = v_new."creditAccountId", amount = v_new.amount, narration = v_new.narration,
    "memberId" = v_new."memberId", lines = v_new.lines, "editHistory" = v_new."editHistory"
  where t.id = v_id;

  update public.voucher_lines set status = 'reversed' where voucher_id = v_id and status = 'posted';
  select coalesce(max(line_no), 0) into v_line_base from public.voucher_lines where voucher_id = v_id;
  insert into public.voucher_lines (id, society_id, voucher_id, fy_id, line_no, account_id, dr_minor, cr_minor,
                                    narration, work_order_id, cost_centre_id, branch_id, entry_date, status, source)
  select v_id || '~' || (v_line_base + ord), v_sid, v_id, v_fy, (v_line_base + ord)::int, x ->> 'accountId',
         case when x ->> 'drCr' = 'Dr' then (x ->> 'amountMinor')::bigint else 0 end,
         case when x ->> 'drCr' = 'Cr' then (x ->> 'amountMinor')::bigint else 0 end,
         x ->> 'narration', v_cur."workOrderId", v_cur."costCentreId", v_cur."branchId", v_new_date, 'posted', 'edit_voucher'
  from jsonb_array_elements(p_lines) with ordinality as t(x, ord);

  delete from public.voucher_entries where "voucherId" = v_id;
  insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, narration, society_id, "workOrderId", "costCentreId", jurisdiction)
  select v_id || '-' || (x ->> 'id'), v_id, x ->> 'accountId',
         case when x ->> 'drCr' = 'Dr' then (x ->> 'amountMinor')::numeric / 100 else 0 end,
         case when x ->> 'drCr' = 'Cr' then (x ->> 'amountMinor')::numeric / 100 else 0 end,
         x ->> 'narration', v_sid, v_cur."workOrderId", v_cur."costCentreId", v_juris
  from jsonb_array_elements(p_lines) as x;

  -- Journal: only when the legs change (a postings-neutral edit emits nothing, as today).
  v_meta := coalesce(v_posting.payload, '{}'::jsonb) - 'lines' - 'reason'
    || jsonb_build_object('voucherNo', v_cur."voucherNo", 'type', v_new."type", 'amount', v_new.amount, 'date', v_new."date",
                          'narration', coalesce(v_new.narration, ''), 'memberId', coalesce(v_new."memberId", ''),
                          'branchId', coalesce(v_cur."branchId", ''), 'createdBy', coalesce(v_cur."createdBy", ''));
  if v_posting.event_id is null then
    v_ev_id := gen_random_uuid()::text;
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values (v_ev_id, 'voucher.posted', 1, v_sid, v_juris, 'voucher', v_id, v_seq + 1, v_at, 'human', p_producer, null, null,
            jsonb_build_object('lines', v_legs) || v_meta);
  elsif v_posting.payload -> 'lines' is distinct from v_legs then
    v_ev_id := gen_random_uuid()::text;
    v_ev2_id := gen_random_uuid()::text;
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values (v_ev_id, 'voucher.reversed', 1, v_sid, v_juris, 'voucher', v_id, v_seq + 1, v_at, 'human', p_producer, null, v_posting.event_id,
            (v_posting.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_posting.payload -> 'lines'), 'reason', 'edit')),
           (v_ev2_id, 'voucher.reposted', 1, v_sid, v_juris, 'voucher', v_id, v_seq + 2, v_at, 'human', p_producer, null, null,
            jsonb_build_object('lines', v_legs) || v_meta);
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.sequence), '[]'::jsonb) into v_events
  from public.ledger_events e where e.event_id in (v_ev_id, v_ev2_id);

  return jsonb_build_object('status', 'edited', 'id', v_id, 'fyId', v_fy, 'events', v_events);
end;
$function$
;

-- A replaced definer keeps its grants, but restate the anon revoke so this file stands alone.
revoke execute on function public.edit_voucher(jsonb, jsonb, text) from public, anon;
grant execute on function public.edit_voucher(jsonb, jsonb, text) to authenticated;

delete from public.app_migrations where version = '095';

commit;
