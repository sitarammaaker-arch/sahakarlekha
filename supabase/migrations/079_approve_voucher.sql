-- 079 · approve_voucher — atomic, server-checked approval that POSTS the voucher (Phase-3 S3-e-2,
-- approved 2026-09-29).
--
-- WHY: a pending (maker-checker) voucher gets no journal event when it is created, and approving it
-- only flipped approvalStatus — nothing ever appended voucher.posted. Found in prod (2026-09-29):
-- 342 approved vouchers since the T-09 cutover with NO journal event at all, so the journal never
-- counted them. approve_voucher flips the status AND writes the voucher's lines, entries and its
-- voucher.posted event in ONE transaction.
--
-- CONTRACT (mirrors post_voucher / edit_voucher):
--   • society = get_current_society_id(); role claim REQUIRED (fail-closed); jwt_can_write() (the
--     approve-capable roles, mig 045)
--   • row locked FOR UPDATE; only a PENDING voucher is approved — an already-approved one returns
--     status 'already_approved' (idempotent); rejected / cancelled / engine vouchers are refused
--   • maker ≠ checker: the approver (p_approved_by, and the JWT user's society_users.name) may not be
--     the voucher's createdBy — system makers ('', 'System', 'System (repair)') are exempt, as in src/lib/sod.ts
--   • not FY-locked; date after the period lock and inside an OPEN financial year
--   • legs: the client sends getVoucherLines legs (RULE 2); ≥ 2, non-negative paise, ΣDr = ΣCr > 0 =
--     the STORED voucher's total (read from the row, not the payload)
--   • voucher_lines: any posted lines → reversed, the legs inserted; voucher_entries REPLACED
--   • journal (built here): no posting yet → voucher.posted; a posting with other legs → reversed +
--     reposted; same legs → nothing. Sequence = max + 1 under the row lock.
--
-- ADDITIVE ONLY: one new function. Nothing calls it until the app is wired (same PR) and a society's
-- posting_service flag is on. Requires 076, 077 (post_voucher's error-code convention), 078.
-- Reversible: 079_approve_voucher_down.sql.

begin;

create or replace function public.approve_voucher(p_id text, p_lines jsonb, p_approved_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.approve_voucher(text, jsonb, text) from public, anon;
grant execute on function public.approve_voucher(text, jsonb, text) to authenticated;

comment on function public.approve_voucher(text, jsonb, text) is
  'S3-e-2: atomic, server-checked approval of a pending voucher (status + voucher_lines + voucher_entries + voucher.posted).';

insert into public.app_migrations (version, name) values ('079', 'approve_voucher')
  on conflict (version) do nothing;

commit;
