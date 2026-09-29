-- 078 · edit_voucher + cancel_voucher — atomic, server-checked voucher edit and cancel (Phase-3 S3-d-1,
-- approved 2026-09-29).
--
-- WHY: an edit today is an upsert + voucher_entries upsert + two journal appends; a cancel is a soft-
-- delete + an entries delete + a journal append — separate client calls. Found in prod (2026-09-29):
--   • 9 live vouchers whose voucher_entries disagree with their legs — an edit gives the lines new ids
--     and the client only UPSERTS entries, so the old rows are never removed;
--   • 16 cancelled vouchers that still have voucher_entries (the delete never landed);
--   • a cancel with the journal not loaded in the app appends no voucher.cancelled at all.
-- Each function does all of its writes in ONE transaction, and builds the journal events ITSELF from
-- what the database holds (the current posting event), so the journal always nets correctly.
--
-- CONTRACT (mirrors post_voucher, 077):
--   • society = get_current_society_id() from the JWT; a role claim is REQUIRED (fail-closed);
--     edit needs jwt_can_write(), cancel needs jwt_can_delete() (the app's update/delete gates)
--   • row locked FOR UPDATE — two concurrent edits/cancels of one voucher serialise
--   • not FY-locked; the voucher's date (and, on edit, the new date) after the period lock and inside an
--     OPEN financial year — a closed year's books are never changed
--   • a cancelled, reversed, pending or engine voucher is not edited; a reversed / engine one is not cancelled
--   • edit: ≥ 2 legs, non-negative paise, ΣDr = ΣCr > 0 = the voucher's own total (same checks as post)
--   • journal: edit with changed legs → voucher.reversed (reversal_of = current posting, legs flipped
--     FROM THAT EVENT) + voucher.reposted (new legs); no posting in the journal yet → one late
--     voucher.posted. Postings-neutral edit → no event (as the app does today).
--     cancel → voucher.cancelled reversing the current posting; none → no event (it contributes nothing).
--     Sequence = the aggregate's max + 1, computed here under the row lock.
--   • voucher_lines: the posted lines become 'reversed', new lines are inserted (edit only);
--     voucher_entries are REPLACED (edit) / DELETED (cancel).
--   • cancel is idempotent: an already-cancelled voucher returns status 'already_cancelled'.
-- Business guards that need other records (linked purchase / sale / salary / member / depreciation)
-- stay in the app, as today. RESTORE is NOT here: the journal has no "un-cancel" (every reader treats a
-- voucher.cancelled as final) — a separate decision.
--
-- ADDITIVE ONLY: two new functions; no table, column or existing row changes. Nothing calls them until
-- the app is wired (S3-d-2) and a society's posting_service flag is on. Requires 076, 077.
-- Reversible: 078_edit_cancel_voucher_down.sql.

begin;

-- Shared: the flipped legs of an event payload (reversal of a posting).
create or replace function public._voucher_flip_legs(p_lines jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'accountId', l ->> 'accountId',
           'drCr', case when l ->> 'drCr' = 'Dr' then 'Cr' else 'Dr' end,
           'amountMinor', (l ->> 'amountMinor')::bigint) order by ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as t(l, ord);
$$;
revoke all on function public._voucher_flip_legs(jsonb) from public, anon, authenticated;

create or replace function public.edit_voucher(p_voucher jsonb, p_lines jsonb, p_producer text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

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

revoke all on function public.edit_voucher(jsonb, jsonb, text) from public, anon;
grant execute on function public.edit_voucher(jsonb, jsonb, text) to authenticated;
revoke all on function public.cancel_voucher(text, text, text) from public, anon;
grant execute on function public.cancel_voucher(text, text, text) to authenticated;

comment on function public.edit_voucher(jsonb, jsonb, text) is
  'S3-d: atomic, server-checked voucher edit (row + voucher_lines + voucher_entries + reversed/reposted events).';
comment on function public.cancel_voucher(text, text, text) is
  'S3-d: atomic, server-checked voucher cancel (soft-delete + lines reversed + entries removed + voucher.cancelled).';

insert into public.app_migrations (version, name) values ('078', 'edit_cancel_voucher')
  on conflict (version) do nothing;

commit;
