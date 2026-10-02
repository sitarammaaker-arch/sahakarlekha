-- 096 down . restores _official_doc_no, post_voucher and post_stock_document to their pre-096 bodies.
-- The seeded document_sequences rows stay (harmless: pre-096 nothing sequences 4-part numbers), and
-- next_document_number's anon grant is not restored (it never needed it).

begin;

CREATE OR REPLACE FUNCTION public._official_doc_no(p_sid text, p_provisional text, p_table text, p_column text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_prefix text := substring(coalesce(p_provisional, '') from '^(.*)/[0-9]+$');
  v_seq    text := substring(coalesce(p_provisional, '') from '/([0-9]+)$');
  v_width  int;
  v_n      bigint;
  v_try    text;
  v_taken  boolean;
  v_parts  int;
begin
  if v_prefix is null or v_prefix = '' or v_seq is null then return p_provisional; end if;
  v_width := length(v_seq);
  v_parts := array_length(string_to_array(p_provisional, '/'), 1);

  -- 1. The server sequence, for the BOOK/FY/SEQ shape it was built for.
  if v_parts = 3 then
    for i in 1..20 loop
      v_n := public.next_document_number(p_sid, split_part(p_provisional, '/', 1), split_part(p_provisional, '/', 2));
      exit when v_n is null or v_n <= 0;
      v_try := v_prefix || '/' || lpad(v_n::text, greatest(v_width, length(v_n::text)), '0');
      execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
        into v_taken using p_sid, v_try;
      if not v_taken then return v_try; end if;
    end loop;
  end if;

  -- 2. The provisional number, if nobody has it.
  execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
    into v_taken using p_sid, p_provisional;
  if not v_taken then return p_provisional; end if;

  -- 3. Highest number in use for this prefix, plus one.
  execute format(
    'select coalesce(max((substring(%I from ''/([0-9]+)$''))::bigint), 0) from public.%I
      where society_id::text = $1 and substring(%I from ''^(.*)/[0-9]+$'') = $2', p_column, p_table, p_column)
    into v_n using p_sid, v_prefix;
  for i in 1..50 loop
    v_n := v_n + 1;
    v_try := v_prefix || '/' || lpad(v_n::text, greatest(v_width, length(v_n::text)), '0');
    execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
      into v_taken using p_sid, v_try;
    if not v_taken then return v_try; end if;
  end loop;
  raise exception 'post_voucher:no_free_number';
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
$function$
;

CREATE OR REPLACE FUNCTION public.post_stock_document(p_kind text, p_doc jsonb, p_voucher jsonb, p_lines jsonb, p_event jsonb, p_movements jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sid      text := public.get_current_society_id();
  v_role     text := auth.jwt() ->> 'user_role';
  v_doc_id   text := p_doc ->> 'id';
  v_table    text;
  v_nocol    text;
  v_prov_no  text;
  v_doc_no   text;
  v_vno      text;
  v_juris    text;
  v_existing record;
  v_voucher  jsonb;
  v_event    jsonb;
  v_res      jsonb;
  v_n        int := 0;
  m          jsonb;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if p_kind = 'sale' then v_table := 'sales'; v_nocol := 'saleNo';
  elsif p_kind = 'purchase' then v_table := 'purchases'; v_nocol := 'purchaseNo';
  else raise exception 'post_voucher:bad_kind'; end if;
  if coalesce(v_doc_id, '') = '' then raise exception 'post_voucher:missing_document_id'; end if;

  -- Idempotent retry: this document id already posted by this society → return it.
  execute format('select id, society_id::text as sid, %I as no, "voucherId" as vid from public.%I where id = $1', v_nocol, v_table)
    into v_existing using v_doc_id;
  if v_existing.id is not null then
    if v_existing.sid <> v_sid then raise exception 'post_voucher:document_id_taken'; end if;
    return jsonb_build_object('status', 'exists', 'id', v_doc_id, 'docNo', v_existing.no, 'voucherId', v_existing.vid);
  end if;

  -- Movements: shape + ownership, before anything is written.
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

  select s.jurisdiction into v_juris from public.society_settings s where s.society_id::text = v_sid;

  -- Official numbers FIRST, so the document, its voucher and its movements agree.
  v_prov_no := p_doc ->> v_nocol;
  v_doc_no := public._official_doc_no(v_sid, v_prov_no, v_table, v_nocol);
  v_vno := public._official_doc_no(v_sid, p_voucher ->> 'voucherNo', 'vouchers', 'voucherNo');
  v_voucher := p_voucher || jsonb_build_object('voucherNo', v_vno, 'refType', p_kind, 'refId', v_doc_id,
    'narration', replace(coalesce(p_voucher ->> 'narration', ''), coalesce(v_prov_no, E'\x01'), coalesce(v_doc_no, '')));
  v_event := jsonb_set(jsonb_set(p_event, '{payload,voucherNo}', to_jsonb(v_vno)),
    '{payload,narration}', to_jsonb(v_voucher ->> 'narration'));

  -- The voucher, with every post_voucher check (one transaction with the rest).
  v_res := public.post_voucher(v_voucher, p_lines, v_event);
  if v_res ->> 'status' <> 'posted' then raise exception 'post_voucher:voucher_id_reused'; end if;

  -- The document row: society, jurisdiction, number, link and live state set here.
  execute format('insert into public.%I select (jsonb_populate_record(null::public.%I, $1)).*', v_table, v_table)
    using p_doc || jsonb_build_object('society_id', v_sid, 'jurisdiction', v_juris, v_nocol, v_doc_no,
                                      'voucherId', p_voucher ->> 'id', 'isDeleted', false);

  -- Movements + the currentStock cache.
  insert into public.stock_movements (id, society_id, date, "itemId", type, qty, rate, amount, "referenceNo", narration, "createdAt", "batchNo", "expiryDate", "godownId", jurisdiction)
  select x ->> 'id', v_sid, coalesce(x ->> 'date', p_doc ->> 'date'), x ->> 'itemId', p_kind, (x ->> 'qty')::numeric,
         (x ->> 'rate')::numeric, (x ->> 'amount')::numeric, v_doc_no, x ->> 'narration',
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

  return jsonb_build_object('status', 'posted', 'id', v_doc_id, 'docNo', v_doc_no, 'voucherId', p_voucher ->> 'id',
    'voucherNo', v_vno, 'narration', v_voucher ->> 'narration',
    'events', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.ledger_events e where e.event_id = p_event ->> 'event_id'));
end;
$function$
;

revoke execute on function public.post_voucher(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.post_voucher(jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.post_stock_document(text, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.post_stock_document(text, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public._official_doc_no(text, text, text, text) from public, anon, authenticated;

delete from public.app_migrations where version = '096';

commit;
