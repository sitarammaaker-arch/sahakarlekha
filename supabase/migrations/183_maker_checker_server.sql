-- 183 · SEC-06 (product audit 2026-11-17) — maker-checker enforced by the server
--
-- Before: self-approval was caught by comparing free-text NAMES; createdBy came from the browser's JSON (and '' or
-- 'system' skipped the check); approvedBy was whatever the browser sent; any writing role could approve; and
-- post_voucher never read the society's approval rules, so a held voucher could simply be posted straight.
-- After:
--   • save_pending_voucher stamps the maker from the TOKEN: createdBy = the login's name, and the new
--     vouchers."makerEmails" lists every login that created or edited the held voucher.
--   • approve_voucher: only approver roles (rbac 'approve': admin, societyAdmin, manager, procurementOfficer,
--     boardMember, chairman, secretary); a login in makerEmails is refused (self_approval); approvedBy and the
--     journal producer come from the token, never p_approved_by (kept in the signature, ignored).
--   • reject_voucher: only roles with rbac 'reject'; who rejected comes from the token.
--   • post_voucher: a MANUAL voucher that the society's approval rules hold (approvalRequired, amount ≥
--     approvalThresholdAmount, or its type in approvalVoucherTypes) is refused (needs_approval).
-- Bodies = the production definitions read 2026-11-19 plus only the lines marked "183 / SEC-06".
-- Pending vouchers held before 183 have no makerEmails; they keep the old name check (4 exist, none blank).
-- Undo: the _down file.

begin;

alter table public.vouchers add column if not exists "makerEmails" text[];

CREATE OR REPLACE FUNCTION public.save_pending_voucher(p_voucher jsonb, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid        text := public.get_current_society_id();
  v_id         text := p_voucher ->> 'id';
  v_cur        public.vouchers;
  v_new        public.vouchers;
  v_date       date;
  v_fy         uuid;
  v_juris      text;
  v_locked     boolean;
  v_lock_date  text;
  v_dr         bigint := 0;
  v_cr         bigint := 0;
  v_total      bigint;
  v_n          int := 0;
  v_no         text;
  v_email      text := lower(nullif(trim(auth.jwt() ->> 'email'), ''));
  v_name       text;
  l            jsonb;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if v_id is null or v_id = '' then raise exception 'post_voucher:missing_voucher_id'; end if;
  -- 183 / SEC-06: the maker is whoever holds the token — never a name from the browser.
  if v_email is null then raise exception 'post_voucher:no_email_claim'; end if;
  select u.name into v_name from public.society_users u where u.society_id::text = v_sid and lower(u.email) = v_email limit 1;

  select * into v_cur from public.vouchers where id = v_id for update;
  if found then
    if v_cur.society_id::text <> v_sid then raise exception 'post_voucher:voucher_id_taken'; end if;
    if coalesce(v_cur."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
    if coalesce(v_cur.origin, '') = 'engine' then raise exception 'post_voucher:engine_voucher'; end if;
    if coalesce(v_cur."approvalStatus", '') <> 'pending' then raise exception 'post_voucher:not_pending'; end if;
  elsif coalesce(p_voucher ->> 'approvalStatus', '') <> 'pending' then
    raise exception 'post_voucher:not_pending';
  end if;

  begin
    v_date := substr(coalesce(p_voucher ->> 'date', v_cur."date"), 1, 10)::date;
  exception when others then raise exception 'post_voucher:bad_date';
  end;
  select coalesce(s."fyLocked", false), s."periodLockDate", s.jurisdiction into v_locked, v_lock_date, v_juris
  from public.society_settings s where s.society_id::text = v_sid;
  if v_locked then raise exception 'post_voucher:fy_locked'; end if;
  if v_lock_date ~ '^\d{4}-\d{2}-\d{2}' and v_date <= substr(v_lock_date, 1, 10)::date then
    raise exception 'post_voucher:period_locked';
  end if;
  select f.id into v_fy from public.financial_years f
  where f.society_id = v_sid and f.status in ('open', 'closing') and v_date between f.start_date and f.end_date;
  if v_fy is null then raise exception 'post_voucher:no_open_fy_for_date'; end if;

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

  if v_cur.id is not null then
    v_new := jsonb_populate_record(v_cur, p_voucher - 'id' - 'society_id' - 'voucherNo' - 'approvalStatus' - 'isDeleted' - 'origin' - 'createdAt' - 'createdBy' - 'makerEmails');
    update public.vouchers t set
      "type" = v_new."type", "date" = v_new."date", "debitAccountId" = v_new."debitAccountId",
      "creditAccountId" = v_new."creditAccountId", amount = v_new.amount, narration = v_new.narration,
      "memberId" = v_new."memberId", lines = v_new.lines, "editHistory" = v_new."editHistory",
      "costCentreId" = v_new."costCentreId",
      -- 183 / SEC-06: whoever edits a held voucher becomes one of its makers (cannot approve it either).
      "makerEmails" = (select array_agg(distinct e order by e) from unnest(coalesce(t."makerEmails", '{}'::text[]) || v_email) e)
    where t.id = v_id;
    return jsonb_build_object('status', 'updated', 'id', v_id, 'voucherNo', v_cur."voucherNo");
  end if;

  if coalesce(p_voucher ->> 'voucherNo', '') = '' then raise exception 'post_voucher:missing_voucher_no'; end if;
  if coalesce((p_voucher ->> 'numbered')::boolean, false) then
    v_no := p_voucher ->> 'voucherNo';
  else
    v_no := public._official_doc_no(v_sid, p_voucher ->> 'voucherNo', 'vouchers', 'voucherNo');
  end if;
  insert into public.vouchers
  select (jsonb_populate_record(null::public.vouchers,
            (p_voucher - 'makerEmails') || jsonb_build_object('society_id', v_sid, 'jurisdiction', v_juris, 'isDeleted', false,
                                            'voucherNo', v_no, 'approvalStatus', 'pending',
                                            'createdBy', coalesce(v_name, v_email), 'makerEmails', jsonb_build_array(v_email)))).*;
  return jsonb_build_object('status', 'saved', 'id', v_id, 'voucherNo', v_no, 'fyId', v_fy);
end;
$function$
;

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
  v_email      text := lower(nullif(trim(auth.jwt() ->> 'email'), ''));
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
  -- 183 / SEC-06: only an approver role approves (rbac 'approve'); the checker is the token's email.
  if v_role not in ('admin', 'societyAdmin', 'manager', 'procurementOfficer', 'boardMember', 'chairman', 'secretary') then raise exception 'post_voucher:not_an_approver'; end if;
  if v_email is null then raise exception 'post_voucher:no_email_claim'; end if;
  if p_id is null or p_id = '' then raise exception 'post_voucher:missing_voucher_id'; end if;

  select * into v_cur from public.vouchers where id = p_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_cur."approvalStatus", '') = 'approved' then
    return jsonb_build_object('status', 'already_approved', 'id', p_id, 'events', '[]'::jsonb);
  end if;
  if coalesce(v_cur."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
  if coalesce(v_cur.origin, '') = 'engine' then raise exception 'post_voucher:engine_voucher'; end if;
  if coalesce(v_cur."approvalStatus", '') <> 'pending' then raise exception 'post_voucher:not_pending'; end if;

  -- Maker ≠ checker (identity SoD). 183 / SEC-06: by EMAIL — every login that created or edited the held
  -- voucher (makerEmails, stamped by save_pending_voucher) is refused. Only a voucher held before 183 (no
  -- makerEmails) falls back to the name check; the browser's p_approved_by is no longer trusted.
  select u.name into v_me from public.society_users u
  where u.society_id::text = v_sid and lower(u.email) = v_email limit 1;
  if coalesce(array_length(v_cur."makerEmails", 1), 0) > 0 then
    if v_email = any(v_cur."makerEmails") then raise exception 'post_voucher:self_approval'; end if;
  elsif lower(trim(coalesce(v_cur."createdBy", ''))) not in ('', 'system', 'system (repair)')
     and lower(trim(v_cur."createdBy")) in (lower(trim(coalesce(v_me, ''))), v_email) then
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
  where f.society_id = v_sid and f.status in ('open', 'closing') and v_date between f.start_date and f.end_date;
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
  update public.vouchers set "approvalStatus" = 'approved', "approvedBy" = coalesce(v_me, v_email),
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
    values (v_ev_id, 'voucher.posted', 1, v_sid, v_juris, 'voucher', p_id, v_seq + 1, v_at, 'human', coalesce(v_me, v_email), null, null,
            jsonb_build_object('lines', v_legs) || v_meta);
  elsif v_posting.payload -> 'lines' is distinct from v_legs then
    v_ev_id := gen_random_uuid()::text;
    v_ev2_id := gen_random_uuid()::text;
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values (v_ev_id, 'voucher.reversed', 1, v_sid, v_juris, 'voucher', p_id, v_seq + 1, v_at, 'human', coalesce(v_me, v_email), null, v_posting.event_id,
            (v_posting.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_posting.payload -> 'lines'), 'reason', 'approve')),
           (v_ev2_id, 'voucher.reposted', 1, v_sid, v_juris, 'voucher', p_id, v_seq + 2, v_at, 'human', coalesce(v_me, v_email), null, null,
            jsonb_build_object('lines', v_legs) || v_meta);
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.sequence), '[]'::jsonb) into v_events
  from public.ledger_events e where e.event_id in (v_ev_id, v_ev2_id);

  return jsonb_build_object('status', 'approved', 'id', p_id, 'fyId', v_fy, 'events', v_events);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_voucher(p_id text, p_reason text, p_rejected_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid  text := public.get_current_society_id();
  v_cur  public.vouchers;
  v_email text := lower(nullif(trim(auth.jwt() ->> 'email'), ''));
  v_me   text;
  v_at   text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  -- 183 / SEC-06: only a role with rbac 'reject' rejects; who rejected comes from the token.
  if (auth.jwt() ->> 'user_role') not in ('admin', 'societyAdmin', 'manager', 'boardMember', 'chairman', 'secretary') then raise exception 'post_voucher:not_an_approver'; end if;
  if v_email is null then raise exception 'post_voucher:no_email_claim'; end if;
  select u.name into v_me from public.society_users u where u.society_id::text = v_sid and lower(u.email) = v_email limit 1;
  if exists (select 1 from public.society_settings s where s.society_id::text = v_sid and coalesce(s."fyLocked", false)) then
    raise exception 'post_voucher:fy_locked';
  end if;
  select * into v_cur from public.vouchers where id = p_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_cur."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
  if coalesce(v_cur.origin, '') = 'engine' then raise exception 'post_voucher:engine_voucher'; end if;
  if coalesce(v_cur."approvalStatus", '') = 'rejected' then
    return jsonb_build_object('status', 'already_rejected', 'id', p_id);
  end if;
  if coalesce(v_cur."approvalStatus", '') <> 'pending' then raise exception 'post_voucher:not_pending'; end if;
  -- A pending voucher was never posted; if the journal says otherwise, rejecting would orphan that posting.
  if exists (select 1 from public.ledger_events e where e.society_id = v_sid and e.aggregate_type = 'voucher'
             and e.aggregate_id = p_id and e.event_type in ('voucher.posted', 'voucher.reposted')) then
    raise exception 'post_voucher:voucher_has_posting';
  end if;

  update public.vouchers set "approvalStatus" = 'rejected', "approvalRemarks" = p_reason,
         "approvedBy" = coalesce(v_me, v_email), "approvedAt" = v_at
  where id = p_id;
  delete from public.voucher_entries where "voucherId" = p_id;
  return jsonb_build_object('status', 'rejected', 'id', p_id, 'approvedAt', v_at);
end;
$function$
;

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
  v_appr_all   boolean;
  v_appr_min   numeric;
  v_appr_types jsonb;
  v_amount     numeric;
  v_existing   record;
  v_dr         bigint := 0;
  v_cr         bigint := 0;
  v_total      bigint;
  v_n          int := 0;
  v_no         text;
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

  -- 183 / SEC-06: the society's approval rules (src/lib/approvalMatrix.ts) — a MANUAL voucher they hold must
  -- go through save_pending_voucher → approve_voucher; posting it straight would skip the checker.
  if coalesce(p_voucher ->> 'origin', '') = 'manual' then
    select coalesce(s."approvalRequired", false), coalesce(s."approvalThresholdAmount", 0), s."approvalVoucherTypes"
      into v_appr_all, v_appr_min, v_appr_types
    from public.society_settings s where s.society_id::text = v_sid;
    begin v_amount := coalesce((p_voucher ->> 'amount')::numeric, 0); exception when others then v_amount := 0; end;
    if coalesce(v_appr_all, false)
       or (coalesce(v_appr_min, 0) > 0 and v_amount >= v_appr_min)
       or (jsonb_typeof(v_appr_types) = 'array' and v_appr_types ? coalesce(p_voucher ->> 'type', '')) then
      raise exception 'post_voucher:needs_approval';
    end if;
  end if;

  -- The open financial year containing the date.
  select f.id into v_fy from public.financial_years f
  where f.society_id = v_sid and f.status in ('open', 'closing') and v_date between f.start_date and f.end_date;
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

  -- 096: the OFFICIAL number, issued here inside the posting transaction (gapless: a refused or failed
  -- post rolls the sequence back with everything else). A pre-numbered voucher keeps its number.
  if coalesce((p_voucher ->> 'numbered')::boolean, false) then
    v_no := p_voucher ->> 'voucherNo';
  else
    v_no := public._official_doc_no(v_sid, p_voucher ->> 'voucherNo', 'vouchers', 'voucherNo');
  end if;

  -- THE WRITE: all four, one transaction.
  insert into public.vouchers
  select (jsonb_populate_record(null::public.vouchers,
            p_voucher || jsonb_build_object('society_id', v_sid, 'jurisdiction', v_juris, 'isDeleted', false, 'voucherNo', v_no))).*;

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
          p_event ->> 'producer_id', p_event ->> 'on_behalf_of', null,
          case when p_event -> 'payload' ? 'voucherNo' then jsonb_set(p_event -> 'payload', '{voucherNo}', to_jsonb(v_no)) else p_event -> 'payload' end);

  return jsonb_build_object('status', 'posted', 'id', v_id, 'voucherNo', v_no, 'fyId', v_fy);
end;
$function$
;


revoke execute on function public.save_pending_voucher(jsonb, jsonb) from public, anon;
revoke execute on function public.approve_voucher(text, jsonb, text) from public, anon;
revoke execute on function public.reject_voucher(text, text, text) from public, anon;
revoke execute on function public.post_voucher(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_pending_voucher(jsonb, jsonb) to authenticated;
grant execute on function public.approve_voucher(text, jsonb, text) to authenticated;
grant execute on function public.reject_voucher(text, text, text) to authenticated;
grant execute on function public.post_voucher(jsonb, jsonb, jsonb) to authenticated;

insert into public.app_migrations (version, name) values ('183', 'maker_checker_server')
  on conflict (version) do nothing;

commit;

-- VERIFY (read-only):
--   select count(*) from information_schema.columns where table_name = 'vouchers' and column_name = 'makerEmails';   -- 1
--   select pg_get_functiondef('public.approve_voucher(text,jsonb,text)'::regprocedure) ~ 'not_an_approver';          -- true
--   select pg_get_functiondef('public.post_voucher(jsonb,jsonb,jsonb)'::regprocedure) ~ 'needs_approval';            -- true
