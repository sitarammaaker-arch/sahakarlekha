-- 083 · update_stock_document — a sale or purchase EDITED in one transaction (Phase-3 S3-f-3, approved
-- 2026-09-29).
--
-- WHY: updateSale / updatePurchase adjust stock, delete the old movements, cancel the old voucher(s), post
-- a new voucher, write new movements and upsert the row — six kinds of write, separate calls; a failure
-- part-way leaves a document whose stock, movements and vouchers disagree (the code itself says "the
-- cascade can't be cleanly undone from the client"). Also, under the posting service the old voucher was
-- cancelled through cancel_voucher, which needs the DELETE role — while editing a sale only needs WRITE —
-- so an accountant's edit could change stock and movements yet fail on the voucher: a half edit.
--
-- THIS MIGRATION:
--   • _cancel_voucher_core(sid, id, reason, by) — cancel_voucher's body (078) with the society passed in
--     and NO role check; private (no client grant). cancel_voucher now = identity + role checks + core
--     (behaviour unchanged). The edit uses the core under its own WRITE check.
--   • update_stock_document(kind, id, doc, voucher, lines, event, movements, reason, by):
--       society from the JWT; role claim REQUIRED; jwt_can_write(); row FOR UPDATE; not deleted;
--       not FY-locked; old date after the period lock and in an OPEN FY (the new date goes through
--       post_voucher's checks); new movements validated as in 080 — then, one transaction:
--       old live non-engine vouchers cancelled (core, journal events returned) → stock restored from the
--       old movements → old movements deleted → new voucher via post_voucher (official voucher number)
--       → new movements with the document's SAME number → stock applied → the row updated in place
--       (same id / number / createdAt / society; new voucherId; extra voucher arrays cleared).
--
-- ADDITIVE + one function re-created with identical behaviour. Requires 078, 080, 081.
-- Reversible: 083_update_stock_document_down.sql (restores 078's cancel_voucher).

begin;

create or replace function public._cancel_voucher_core(p_sid text, p_id text, p_reason text, p_deleted_by text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;
revoke all on function public._cancel_voucher_core(text, text, text, text) from public, anon, authenticated;

-- cancel_voucher: identity + role checks, then the core (behaviour identical to 078).
create or replace function public.cancel_voucher(p_id text, p_reason text default null, p_deleted_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid  text := public.get_current_society_id();
  v_role text := auth.jwt() ->> 'user_role';
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if v_role is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_delete() then raise exception 'post_voucher:role_cannot_delete'; end if;
  return public._cancel_voucher_core(v_sid, p_id, p_reason, p_deleted_by);
end;
$$;
revoke all on function public.cancel_voucher(text, text, text) from public, anon;
grant execute on function public.cancel_voucher(text, text, text) to authenticated;

create or replace function public.update_stock_document(p_kind text, p_id text, p_doc jsonb, p_voucher jsonb, p_lines jsonb,
                                                        p_event jsonb, p_movements jsonb, p_reason text default null, p_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.update_stock_document(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.update_stock_document(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) to authenticated;

comment on function public.update_stock_document(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) is
  'S3-f-3: a sale or purchase edited in one transaction — old vouchers cancelled, stock/movements replaced, new voucher posted, row updated in place.';

insert into public.app_migrations (version, name) values ('083', 'update_stock_document')
  on conflict (version) do nothing;

commit;
