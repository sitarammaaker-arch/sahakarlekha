-- 090 undo · restores the pre-090 function bodies exactly (posting only into the 'open' year; the
-- trigger only creates a new society's first year). FY rows created by a rollover are KEPT; a year left
-- 'closing' then takes no postings until set back to 'open' by hand.

begin;

CREATE OR REPLACE FUNCTION public.post_voucher(p_voucher jsonb, p_lines jsonb, p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid        text := public.get_current_society_id();
  v_role       text := auth.jwt() ->> 'user_role';
  v_id         text := p_voucher ->> 'id';
  v_date       date;
  v_fy         uuid;
  v_juris      text;
  v_locked     boolean;
  v_lock_date  text;
  v_existing   record;
  v_dr         bigint := 0;
  v_cr         bigint := 0;
  v_total      bigint;
  v_n          int := 0;
  l            jsonb;
begin
  -- Who: the society comes from the JWT only; a role claim is required (fail-closed).
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if v_id is null or v_id = '' then raise exception 'post_voucher:missing_voucher_id'; end if;

  -- Idempotent retry: the same voucher id already posted by this society → return it unchanged.
  select id, society_id::text as sid, "voucherNo" into v_existing from public.vouchers where id = v_id;
  if found then
    if v_existing.sid <> v_sid then raise exception 'post_voucher:voucher_id_taken'; end if;
    return jsonb_build_object('status', 'exists', 'id', v_existing.id, 'voucherNo', v_existing."voucherNo");
  end if;

  if coalesce(p_voucher ->> 'approvalStatus', '') = 'pending' then raise exception 'post_voucher:pending_not_supported'; end if;
  if coalesce((p_voucher ->> 'isDeleted')::boolean, false) then raise exception 'post_voucher:deleted_voucher'; end if;
  if coalesce(p_voucher ->> 'voucherNo', '') = '' then raise exception 'post_voucher:missing_voucher_no'; end if;
  begin
    v_date := substr(p_voucher ->> 'date', 1, 10)::date;
  exception when others then raise exception 'post_voucher:bad_date';
  end;

  -- Society locks.
  select coalesce(s."fyLocked", false), s."periodLockDate", s.jurisdiction
    into v_locked, v_lock_date, v_juris
  from public.society_settings s where s.society_id::text = v_sid;
  if v_locked then raise exception 'post_voucher:fy_locked'; end if;
  if v_lock_date ~ '^\d{4}-\d{2}-\d{2}' and v_date <= substr(v_lock_date, 1, 10)::date then
    raise exception 'post_voucher:period_locked';
  end if;

  -- The open financial year containing the date.
  select f.id into v_fy from public.financial_years f
  where f.society_id = v_sid and f.status = 'open' and v_date between f.start_date and f.end_date;
  if v_fy is null then raise exception 'post_voucher:no_open_fy_for_date'; end if;

  -- Legs: ≥ 2, non-negative paise, balanced, and matching the voucher's own total.
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
  if jsonb_typeof(p_voucher -> 'lines') = 'array' and jsonb_array_length(p_voucher -> 'lines') > 0 then
    select coalesce(sum(round(((x ->> 'amount')::numeric) * 100)), 0)::bigint into v_total
    from jsonb_array_elements(p_voucher -> 'lines') x where x ->> 'type' = 'Dr';
  else
    v_total := round(((p_voucher ->> 'amount')::numeric) * 100)::bigint;
  end if;
  if v_total <> v_dr then raise exception 'post_voucher:legs_do_not_match_voucher'; end if;

  -- The journal event: voucher.posted, sequence 1, this voucher, same legs.
  if p_event ->> 'event_type' <> 'voucher.posted' or (p_event ->> 'sequence')::int <> 1
     or p_event ->> 'aggregate_id' <> v_id or coalesce(p_event ->> 'event_id', '') = '' then
    raise exception 'post_voucher:bad_event';
  end if;
  if (select coalesce(jsonb_agg(jsonb_build_object('accountId', e ->> 'accountId', 'drCr', e ->> 'drCr', 'amountMinor', (e ->> 'amountMinor')::bigint) order by ord), '[]'::jsonb)
        from jsonb_array_elements(p_event -> 'payload' -> 'lines') with ordinality as t(e, ord))
     <> (select coalesce(jsonb_agg(jsonb_build_object('accountId', x ->> 'accountId', 'drCr', x ->> 'drCr', 'amountMinor', (x ->> 'amountMinor')::bigint) order by ord), '[]'::jsonb)
        from jsonb_array_elements(p_lines) with ordinality as t(x, ord)) then
    raise exception 'post_voucher:event_lines_differ';
  end if;

  -- THE WRITE: all four, one transaction.
  insert into public.vouchers
  select (jsonb_populate_record(null::public.vouchers,
            p_voucher || jsonb_build_object('society_id', v_sid, 'jurisdiction', v_juris, 'isDeleted', false))).*;

  insert into public.voucher_lines (id, society_id, voucher_id, fy_id, line_no, account_id, dr_minor, cr_minor,
                                    narration, work_order_id, cost_centre_id, branch_id, entry_date, status, source)
  select v_id || '-' || (x ->> 'id'), v_sid, v_id, v_fy, ord::int, x ->> 'accountId',
         case when x ->> 'drCr' = 'Dr' then (x ->> 'amountMinor')::bigint else 0 end,
         case when x ->> 'drCr' = 'Cr' then (x ->> 'amountMinor')::bigint else 0 end,
         x ->> 'narration', p_voucher ->> 'workOrderId', p_voucher ->> 'costCentreId', p_voucher ->> 'branchId',
         v_date, 'posted', 'post_voucher'
  from jsonb_array_elements(p_lines) with ordinality as t(x, ord);

  insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, narration, society_id, "workOrderId", "costCentreId", jurisdiction)
  select v_id || '-' || (x ->> 'id'), v_id, x ->> 'accountId',
         case when x ->> 'drCr' = 'Dr' then (x ->> 'amountMinor')::numeric / 100 else 0 end,
         case when x ->> 'drCr' = 'Cr' then (x ->> 'amountMinor')::numeric / 100 else 0 end,
         x ->> 'narration', v_sid, p_voucher ->> 'workOrderId', p_voucher ->> 'costCentreId', v_juris
  from jsonb_array_elements(p_lines) as x;

  insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                    aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
  values (p_event ->> 'event_id', 'voucher.posted', coalesce((p_event ->> 'schema_version')::int, 1), v_sid, v_juris, 'voucher',
          v_id, 1, coalesce((p_event ->> 'occurred_at')::timestamptz, now()), coalesce(p_event ->> 'producer_kind', 'human'),
          p_event ->> 'producer_id', p_event ->> 'on_behalf_of', null, p_event -> 'payload');

  return jsonb_build_object('status', 'posted', 'id', v_id, 'voucherNo', p_voucher ->> 'voucherNo', 'fyId', v_fy);
end;
$function$;

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
  if not exists (select 1 from public.financial_years f where f.society_id = v_sid and f.status = 'open'
                 and v_old_date between f.start_date and f.end_date) then
    raise exception 'post_voucher:voucher_in_closed_fy';
  end if;
  select f.id into v_fy from public.financial_years f
  where f.society_id = v_sid and f.status = 'open' and v_new_date between f.start_date and f.end_date;
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
$function$;

CREATE OR REPLACE FUNCTION public.approve_voucher(p_id text, p_lines jsonb, p_approved_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid        text := public.get_current_society_id();
  v_role       text := auth.jwt() ->> 'user_role';
  v_me         text;
  v_cur        public.vouchers;
  v_date       date;
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
  v_line_base  int;
  v_at         timestamptz := now();
  v_ev_id      text;
  v_ev2_id     text;
  v_events     jsonb := '[]'::jsonb;
  l            jsonb;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if p_id is null or p_id = '' then raise exception 'post_voucher:missing_voucher_id'; end if;

  select * into v_cur from public.vouchers where id = p_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_cur."approvalStatus", '') = 'approved' then
    return jsonb_build_object('status', 'already_approved', 'id', p_id, 'events', '[]'::jsonb);
  end if;
  if coalesce(v_cur."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
  if coalesce(v_cur.origin, '') = 'engine' then raise exception 'post_voucher:engine_voucher'; end if;
  if coalesce(v_cur."approvalStatus", '') <> 'pending' then raise exception 'post_voucher:not_pending'; end if;

  -- Maker ≠ checker (identity SoD). System makers are exempt.
  select u.name into v_me from public.society_users u
  where u.society_id::text = v_sid and lower(u.email) = lower(auth.jwt() ->> 'email') limit 1;
  if lower(trim(coalesce(v_cur."createdBy", ''))) not in ('', 'system', 'system (repair)')
     and (lower(trim(v_cur."createdBy")) = lower(trim(coalesce(p_approved_by, '')))
          or lower(trim(v_cur."createdBy")) = lower(trim(coalesce(v_me, '')))) then
    raise exception 'post_voucher:self_approval';
  end if;

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
  select f.id into v_fy from public.financial_years f
  where f.society_id = v_sid and f.status = 'open' and v_date between f.start_date and f.end_date;
  if v_fy is null then raise exception 'post_voucher:no_open_fy_for_date'; end if;

  -- Legs vs the STORED voucher.
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
  if jsonb_typeof(v_cur.lines) = 'array' and jsonb_array_length(v_cur.lines) > 0 then
    select coalesce(sum(round(((x ->> 'amount')::numeric) * 100)), 0)::bigint into v_total
    from jsonb_array_elements(v_cur.lines) x where x ->> 'type' = 'Dr';
  else
    v_total := round(v_cur.amount * 100)::bigint;
  end if;
  if v_total <> v_dr then raise exception 'post_voucher:legs_do_not_match_voucher'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('accountId', x ->> 'accountId', 'drCr', x ->> 'drCr', 'amountMinor', (x ->> 'amountMinor')::bigint) order by ord), '[]'::jsonb)
    into v_legs from jsonb_array_elements(p_lines) with ordinality as t(x, ord);

  select * into v_posting from public.ledger_events e
  where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = p_id
    and e.event_type in ('voucher.posted', 'voucher.reposted')
  order by (e.event_type = 'voucher.reposted') desc, e.sequence desc limit 1;
  select coalesce(max(e.sequence), 0) into v_seq from public.ledger_events e
  where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = p_id;

  -- THE WRITES.
  update public.vouchers set "approvalStatus" = 'approved', "approvedBy" = coalesce(p_approved_by, v_me),
         "approvedAt" = to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  where id = p_id;

  update public.voucher_lines set status = 'reversed' where voucher_id = p_id and status = 'posted';
  select coalesce(max(line_no), 0) into v_line_base from public.voucher_lines where voucher_id = p_id;
  insert into public.voucher_lines (id, society_id, voucher_id, fy_id, line_no, account_id, dr_minor, cr_minor,
                                    narration, work_order_id, cost_centre_id, branch_id, entry_date, status, source)
  select p_id || '~' || (v_line_base + ord), v_sid, p_id, v_fy, (v_line_base + ord)::int, x ->> 'accountId',
         case when x ->> 'drCr' = 'Dr' then (x ->> 'amountMinor')::bigint else 0 end,
         case when x ->> 'drCr' = 'Cr' then (x ->> 'amountMinor')::bigint else 0 end,
         x ->> 'narration', v_cur."workOrderId", v_cur."costCentreId", v_cur."branchId", v_date, 'posted', 'approve_voucher'
  from jsonb_array_elements(p_lines) with ordinality as t(x, ord);

  delete from public.voucher_entries where "voucherId" = p_id;
  insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, narration, society_id, "workOrderId", "costCentreId", jurisdiction)
  select p_id || '-' || (x ->> 'id'), p_id, x ->> 'accountId',
         case when x ->> 'drCr' = 'Dr' then (x ->> 'amountMinor')::numeric / 100 else 0 end,
         case when x ->> 'drCr' = 'Cr' then (x ->> 'amountMinor')::numeric / 100 else 0 end,
         x ->> 'narration', v_sid, v_cur."workOrderId", v_cur."costCentreId", v_juris
  from jsonb_array_elements(p_lines) as x;

  -- Journal meta: the voucherEventMeta shape (src/lib/ledger/voucherEvent.ts).
  v_meta := jsonb_build_object('voucherNo', v_cur."voucherNo", 'type', v_cur."type", 'amount', v_cur.amount, 'date', v_cur."date",
    'narration', coalesce(v_cur.narration, ''), 'createdAt', coalesce(to_char(v_cur."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), ''),
    'memberId', coalesce(v_cur."memberId", ''), 'branchId', coalesce(v_cur."branchId", ''), 'createdBy', coalesce(v_cur."createdBy", ''));
  if v_posting.event_id is null then
    v_ev_id := gen_random_uuid()::text;
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values (v_ev_id, 'voucher.posted', 1, v_sid, v_juris, 'voucher', p_id, v_seq + 1, v_at, 'human', coalesce(p_approved_by, v_me), null, null,
            jsonb_build_object('lines', v_legs) || v_meta);
  elsif v_posting.payload -> 'lines' is distinct from v_legs then
    v_ev_id := gen_random_uuid()::text;
    v_ev2_id := gen_random_uuid()::text;
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values (v_ev_id, 'voucher.reversed', 1, v_sid, v_juris, 'voucher', p_id, v_seq + 1, v_at, 'human', coalesce(p_approved_by, v_me), null, v_posting.event_id,
            (v_posting.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_posting.payload -> 'lines'), 'reason', 'approve')),
           (v_ev2_id, 'voucher.reposted', 1, v_sid, v_juris, 'voucher', p_id, v_seq + 2, v_at, 'human', coalesce(p_approved_by, v_me), null, null,
            jsonb_build_object('lines', v_legs) || v_meta);
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.sequence), '[]'::jsonb) into v_events
  from public.ledger_events e where e.event_id in (v_ev_id, v_ev2_id);

  return jsonb_build_object('status', 'approved', 'id', p_id, 'fyId', v_fy, 'events', v_events);
end;
$function$;

CREATE OR REPLACE FUNCTION public._cancel_voucher_core(p_sid text, p_id text, p_reason text, p_deleted_by text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
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
  if p_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if p_id is null or p_id = '' then raise exception 'post_voucher:missing_voucher_id'; end if;

  select * into v_cur from public.vouchers where id = p_id and society_id::text = p_sid for update;
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
  from public.society_settings s where s.society_id::text = p_sid;
  if v_locked then raise exception 'post_voucher:fy_locked'; end if;
  if v_lock_date ~ '^\d{4}-\d{2}-\d{2}' and v_date <= substr(v_lock_date, 1, 10)::date then
    raise exception 'post_voucher:period_locked';
  end if;
  if not exists (select 1 from public.financial_years f where f.society_id = p_sid and f.status = 'open'
                 and v_date between f.start_date and f.end_date) then
    raise exception 'post_voucher:voucher_in_closed_fy';
  end if;

  select * into v_posting from public.ledger_events e
  where e.society_id = p_sid and e.aggregate_type = 'voucher' and e.aggregate_id = p_id
    and e.event_type in ('voucher.posted', 'voucher.reposted')
  order by (e.event_type = 'voucher.reposted') desc, e.sequence desc limit 1;
  select coalesce(max(e.sequence), 0) into v_seq from public.ledger_events e
  where e.society_id = p_sid and e.aggregate_type = 'voucher' and e.aggregate_id = p_id;

  update public.vouchers set "isDeleted" = true, "deletedAt" = to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
         "deletedBy" = p_deleted_by, "deletedReason" = p_reason
  where id = p_id;
  update public.voucher_lines set status = 'reversed' where voucher_id = p_id and status = 'posted';
  delete from public.voucher_entries where "voucherId" = p_id;

  if v_posting.event_id is not null and not exists (
       select 1 from public.ledger_events e where e.society_id = p_sid and e.aggregate_type = 'voucher'
       and e.aggregate_id = p_id and e.event_type = 'voucher.cancelled') then
    v_ev_id := gen_random_uuid()::text;
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values (v_ev_id, 'voucher.cancelled', 1, p_sid, v_juris, 'voucher', p_id, v_seq + 1, v_at, 'human', p_deleted_by, null, v_posting.event_id,
            (v_posting.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_posting.payload -> 'lines'), 'reason', coalesce(p_reason, '')));
    select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_events from public.ledger_events e where e.event_id = v_ev_id;
  end if;

  return jsonb_build_object('status', 'cancelled', 'id', p_id, 'events', v_events);
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_stock_document(p_kind text, p_id text, p_reason text DEFAULT NULL::text, p_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid        text := public.get_current_society_id();
  v_role       text := auth.jwt() ->> 'user_role';
  v_table      text;
  v_nocol      text;
  v_extracol   text;
  v_doc        record;
  v_date       date;
  v_locked     boolean;
  v_lock_date  text;
  v_vid        text;
  v_res        jsonb;
  v_events     jsonb := '[]'::jsonb;
  v_moved      jsonb;
  v_n          int;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_delete() then raise exception 'post_voucher:role_cannot_delete'; end if;
  if p_kind = 'sale' then v_table := 'sales'; v_nocol := 'saleNo'; v_extracol := 'gstVoucherIds';
  elsif p_kind = 'purchase' then v_table := 'purchases'; v_nocol := 'purchaseNo'; v_extracol := 'taxVoucherIds';
  else raise exception 'post_voucher:bad_kind'; end if;
  if coalesce(p_id, '') = '' then raise exception 'post_voucher:missing_document_id'; end if;

  execute format('select id, %I as no, "voucherId" as vid, %I as extra, date, coalesce("isDeleted", false) as del
                    from public.%I where id = $1 and society_id::text = $2 for update', v_nocol, v_extracol, v_table)
    into v_doc using p_id, v_sid;
  if v_doc.id is null then raise exception 'post_voucher:document_not_found'; end if;
  if v_doc.del then return jsonb_build_object('status', 'already_cancelled', 'id', p_id, 'events', '[]'::jsonb); end if;

  begin
    v_date := substr(v_doc.date, 1, 10)::date;
  exception when others then raise exception 'post_voucher:bad_date';
  end;
  select coalesce(s."fyLocked", false), s."periodLockDate" into v_locked, v_lock_date
  from public.society_settings s where s.society_id::text = v_sid;
  if v_locked then raise exception 'post_voucher:fy_locked'; end if;
  if v_lock_date ~ '^\d{4}-\d{2}-\d{2}' and v_date <= substr(v_lock_date, 1, 10)::date then
    raise exception 'post_voucher:period_locked';
  end if;
  if not exists (select 1 from public.financial_years f where f.society_id = v_sid and f.status = 'open'
                 and v_date between f.start_date and f.end_date) then
    raise exception 'post_voucher:voucher_in_closed_fy';
  end if;

  -- Linked vouchers: live, this society's, not engine-made → cancel_voucher (with its journal event).
  for v_vid in
    select x.id from (
      select v_doc.vid as id
      union
      select e from jsonb_array_elements_text(case when jsonb_typeof(v_doc.extra) = 'array' then v_doc.extra else '[]'::jsonb end) e
    ) x
    join public.vouchers v on v.id = x.id
    where x.id is not null and v.society_id::text = v_sid and not coalesce(v."isDeleted", false) and coalesce(v.origin, '') <> 'engine'
  loop
    v_res := public.cancel_voucher(v_vid, p_reason, p_by);
    v_events := v_events || coalesce(v_res -> 'events', '[]'::jsonb);
  end loop;

  -- Movements (as the app deletes them: by the document number) and the currentStock cache.
  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb), count(*) into v_moved, v_n
  from public.stock_movements m where m.society_id::text = v_sid and m."referenceNo" = v_doc.no;
  if p_kind = 'sale' then
    update public.stock_items s set "currentStock" = coalesce(s."currentStock", 0) + q.qty
    from (select m."itemId" item, sum(m.qty) qty from public.stock_movements m
          where m.society_id::text = v_sid and m."referenceNo" = v_doc.no and m.type = 'sale' group by 1) q
    where s.id = q.item and s.society_id::text = v_sid;
  else
    update public.stock_items s set "currentStock" = greatest(0, coalesce(s."currentStock", 0) - q.qty)
    from (select m."itemId" item, sum(m.qty) qty from public.stock_movements m
          where m.society_id::text = v_sid and m."referenceNo" = v_doc.no and m.type = 'purchase' group by 1) q
    where s.id = q.item and s.society_id::text = v_sid;
  end if;
  delete from public.stock_movements m where m.society_id::text = v_sid and m."referenceNo" = v_doc.no;

  execute format('update public.%I set "isDeleted" = true where id = $1 and society_id::text = $2', v_table) using p_id, v_sid;

  return jsonb_build_object('status', 'cancelled', 'id', p_id, 'docNo', v_doc.no, 'events', v_events,
                            'movementsDeleted', v_n, 'movements', v_moved);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_stock_document(p_kind text, p_id text, p_doc jsonb, p_voucher jsonb, p_lines jsonb, p_event jsonb, p_movements jsonb, p_reason text DEFAULT NULL::text, p_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid        text := public.get_current_society_id();
  v_role       text := auth.jwt() ->> 'user_role';
  v_table      text;
  v_nocol      text;
  v_extracol   text;
  v_doc        record;
  v_old        jsonb;
  v_date       date;
  v_locked     boolean;
  v_lock_date  text;
  v_juris      text;
  v_vid        text;
  v_res        jsonb;
  v_events     jsonb := '[]'::jsonb;
  v_vno        text;
  v_voucher    jsonb;
  v_event      jsonb;
  v_merged     jsonb;
  v_set        text;
  v_n          int := 0;
  m            jsonb;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if p_kind = 'sale' then v_table := 'sales'; v_nocol := 'saleNo'; v_extracol := 'gstVoucherIds';
  elsif p_kind = 'purchase' then v_table := 'purchases'; v_nocol := 'purchaseNo'; v_extracol := 'taxVoucherIds';
  else raise exception 'post_voucher:bad_kind'; end if;
  if coalesce(p_id, '') = '' then raise exception 'post_voucher:missing_document_id'; end if;

  execute format('select id, %I as no, "voucherId" as vid, %I as extra, date, coalesce("isDeleted", false) as del
                    from public.%I where id = $1 and society_id::text = $2 for update', v_nocol, v_extracol, v_table)
    into v_doc using p_id, v_sid;
  if v_doc.id is null then raise exception 'post_voucher:document_not_found'; end if;
  if v_doc.del then raise exception 'post_voucher:document_cancelled'; end if;
  execute format('select to_jsonb(t) from public.%I t where id = $1', v_table) into v_old using p_id;

  begin
    v_date := substr(v_doc.date, 1, 10)::date;
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

  if jsonb_typeof(p_movements) <> 'array' then raise exception 'post_voucher:movements_not_array'; end if;
  for m in select * from jsonb_array_elements(p_movements) loop
    v_n := v_n + 1;
    if coalesce(m ->> 'id', '') = '' or coalesce(m ->> 'itemId', '') = '' then raise exception 'post_voucher:bad_movement'; end if;
    if coalesce(m ->> 'type', '') <> p_kind then raise exception 'post_voucher:movement_type_mismatch'; end if;
    if coalesce((m ->> 'qty')::numeric, 0) <= 0 then raise exception 'post_voucher:bad_movement_qty'; end if;
    if not exists (select 1 from public.stock_items s where s.id = m ->> 'itemId' and s.society_id::text = v_sid) then
      raise exception 'post_voucher:unknown_item';
    end if;
  end loop;
  if v_n = 0 then raise exception 'post_voucher:no_items'; end if;

  -- 1. The old vouchers, with their journal (write role suffices for an edit).
  for v_vid in
    select x.id from (
      select v_doc.vid as id
      union
      select e from jsonb_array_elements_text(case when jsonb_typeof(v_doc.extra) = 'array' then v_doc.extra else '[]'::jsonb end) e
    ) x
    join public.vouchers v on v.id = x.id
    where x.id is not null and v.society_id::text = v_sid and not coalesce(v."isDeleted", false) and coalesce(v.origin, '') <> 'engine'
  loop
    v_res := public._cancel_voucher_core(v_sid, v_vid, coalesce(p_reason, initcap(p_kind) || ' ' || v_doc.no || ' edited'), p_by);
    v_events := v_events || coalesce(v_res -> 'events', '[]'::jsonb);
  end loop;

  -- 2. The old movements out, the stock they moved back.
  if p_kind = 'sale' then
    update public.stock_items s set "currentStock" = coalesce(s."currentStock", 0) + q.qty
    from (select mm."itemId" item, sum(mm.qty) qty from public.stock_movements mm
          where mm.society_id::text = v_sid and mm."referenceNo" = v_doc.no and mm.type = 'sale' group by 1) q
    where s.id = q.item and s.society_id::text = v_sid;
  else
    update public.stock_items s set "currentStock" = greatest(0, coalesce(s."currentStock", 0) - q.qty)
    from (select mm."itemId" item, sum(mm.qty) qty from public.stock_movements mm
          where mm.society_id::text = v_sid and mm."referenceNo" = v_doc.no and mm.type = 'purchase' group by 1) q
    where s.id = q.item and s.society_id::text = v_sid;
  end if;
  delete from public.stock_movements mm where mm.society_id::text = v_sid and mm."referenceNo" = v_doc.no;

  -- 3. The new voucher (every post_voucher check; official voucher number).
  v_vno := public._official_doc_no(v_sid, p_voucher ->> 'voucherNo', 'vouchers', 'voucherNo');
  v_voucher := p_voucher || jsonb_build_object('voucherNo', v_vno, 'refType', p_kind, 'refId', p_id);
  v_event := jsonb_set(p_event, '{payload,voucherNo}', to_jsonb(v_vno));
  v_res := public.post_voucher(v_voucher, p_lines, v_event);
  if v_res ->> 'status' <> 'posted' then raise exception 'post_voucher:voucher_id_reused'; end if;
  v_events := v_events || coalesce((select jsonb_agg(to_jsonb(e)) from public.ledger_events e where e.event_id = p_event ->> 'event_id'), '[]'::jsonb);

  -- 4. The new movements, under the document's SAME number, and the stock they move.
  insert into public.stock_movements (id, society_id, date, "itemId", type, qty, rate, amount, "referenceNo", narration, "createdAt", "batchNo", "expiryDate", "godownId", jurisdiction)
  select x ->> 'id', v_sid, coalesce(x ->> 'date', p_doc ->> 'date'), x ->> 'itemId', p_kind, (x ->> 'qty')::numeric,
         (x ->> 'rate')::numeric, (x ->> 'amount')::numeric, v_doc.no, x ->> 'narration',
         coalesce((x ->> 'createdAt')::timestamp, now()), x ->> 'batchNo', x ->> 'expiryDate', nullif(x ->> 'godownId', ''), v_juris
  from jsonb_array_elements(p_movements) as x;
  if p_kind = 'sale' then
    update public.stock_items s set "currentStock" = greatest(0, coalesce(s."currentStock", 0) - q.qty)
    from (select x ->> 'itemId' item, sum((x ->> 'qty')::numeric) qty from jsonb_array_elements(p_movements) x group by 1) q
    where s.id = q.item and s.society_id::text = v_sid;
  else
    update public.stock_items s set "currentStock" = coalesce(s."currentStock", 0) + q.qty, "purchaseRate" = q.rate
    from (select x ->> 'itemId' item, sum((x ->> 'qty')::numeric) qty,
                 (array_agg((x ->> 'rate')::numeric order by ord desc))[1] rate
          from jsonb_array_elements(p_movements) with ordinality as t(x, ord) group by 1) q
    where s.id = q.item and s.society_id::text = v_sid;
  end if;

  -- 5. The row, in place: the edit's fields over the stored row; identity fields kept.
  v_merged := v_old || (p_doc - 'id' - 'society_id' - v_nocol - 'createdAt' - 'isDeleted' - 'jurisdiction')
              || jsonb_build_object('voucherId', p_voucher ->> 'id', v_extracol, null);
  select string_agg(format('%I = r.%I', c.column_name, c.column_name), ', ') into v_set
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v_table
    and c.column_name not in ('id', 'society_id', v_nocol, 'createdAt', 'isDeleted', 'jurisdiction');
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 and t.society_id::text = $3',
                 v_table, v_set, v_table) using v_merged, p_id, v_sid;

  return jsonb_build_object('status', 'updated', 'id', p_id, 'docNo', v_doc.no, 'voucherId', p_voucher ->> 'id', 'voucherNo', v_vno,
                            'events', v_events);
end;
$function$;

CREATE OR REPLACE FUNCTION public.tg_financial_year_for_new_society()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare lbl text := new."financialYear"; y int;
begin
  if lbl is null or lbl !~ '^\d{4}-\d{2}$' then return new; end if;
  y := substr(lbl, 1, 4)::int;
  if substr(lbl, 6, 2)::int <> (y + 1) % 100 then return new; end if;
  if exists (select 1 from public.financial_years f where f.society_id = new.society_id::text) then return new; end if;
  insert into public.financial_years (society_id, fy_label, start_date, end_date, status)
  values (new.society_id::text, lbl, make_date(y, 4, 1), make_date(y + 1, 3, 31), 'open')
  on conflict (society_id, fy_label) do nothing;
  return new;
end;
$function$;

delete from public.app_migrations where version = '090';

commit;
