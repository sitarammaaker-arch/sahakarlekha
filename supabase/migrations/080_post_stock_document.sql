-- 080 · post_stock_document — a sale or purchase posted in ONE transaction (Phase-3 S3-f-1, approved
-- 2026-09-29).
--
-- WHY: addSale / addPurchase write 4–5 things with separate calls — the voucher, every item's
-- stock_items.currentStock, every stock_movements row, the sales/purchases row, then its GST columns.
-- A failure part-way leaves a voucher without its document, or movements without either (a failed
-- document save rolled back only the row on screen). And the document number could be re-issued AFTER
-- the movements were written with the provisional one — while delete finds movements BY that number.
-- post_stock_document writes all of it in one transaction, and issues the official numbers FIRST so
-- the document, its voucher narration and its movements all carry the same number.
--
-- CONTRACT:
--   • p_kind 'sale' | 'purchase'; the document row, the voucher (+ legs + voucher.posted event, exactly
--     as addVoucher builds them — RULE 2 stays in the app) and the stock movements come from the client
--   • the VOUCHER goes through public.post_voucher — every one of its checks applies (society from the
--     JWT, role claim required, jwt_can_write, FY/period lock, open FY, balanced legs = voucher total,
--     event = legs); society / jurisdiction / numbers / links are set HERE, never taken from the payload
--   • official numbers: document (SL/… or PUR/…) and voucher from next_document_number, skipping any
--     number already taken; a malformed provisional number is kept as is
--   • idempotent: the same document id again → status 'exists' with its stored numbers
--   • movements: qty > 0, type = the kind, item must belong to the society; referenceNo = the document's
--     official number; stock_items.currentStock kept in step (sale −qty floored at 0, purchase +qty and
--     purchaseRate = rate) — it is a cache, the movements are the truth (RULE 2)
-- Returns the official numbers and the journal event, so the app can restamp local state.
--
-- ADDITIVE ONLY: one new function (+ one private helper). Nothing calls it until the app is wired and a
-- society's posting_service flag is on. Requires 077 (post_voucher). Reversible: 080_post_stock_document_down.sql.

begin;

-- Private: the official BOOK/FY/SEQ for a provisional number — next_document_number, skipping numbers
-- already used in the given table/column for this society. Malformed input comes back unchanged.
-- search_path = public (not ''): next_document_number (T-03, mig 016) names document_sequences
-- unqualified, so it must resolve in the caller's path. This helper is private (no client grant).
create or replace function public._official_doc_no(p_sid text, p_provisional text, p_table text, p_column text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_book  text := split_part(coalesce(p_provisional, ''), '/', 1);
  v_fy    text := split_part(coalesce(p_provisional, ''), '/', 2);
  v_seq   text := split_part(coalesce(p_provisional, ''), '/', 3);
  v_width int;
  v_n     bigint;
  v_try   text;
  v_taken boolean;
begin
  if v_book = '' or v_fy = '' or v_seq !~ '^[0-9]+$' or split_part(p_provisional, '/', 4) <> '' then
    return p_provisional;
  end if;
  v_width := length(v_seq);
  for i in 1..50 loop
    v_n := public.next_document_number(p_sid, v_book, v_fy);
    if v_n is null or v_n <= 0 then return p_provisional; end if;
    v_try := v_book || '/' || v_fy || '/' || lpad(v_n::text, greatest(v_width, length(v_n::text)), '0');
    execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
      into v_taken using p_sid, v_try;
    if not v_taken then return v_try; end if;
  end loop;
  raise exception 'post_voucher:no_free_number';
end;
$$;
revoke all on function public._official_doc_no(text, text, text, text) from public, anon, authenticated;

create or replace function public.post_stock_document(p_kind text, p_doc jsonb, p_voucher jsonb, p_lines jsonb,
                                                      p_event jsonb, p_movements jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.post_stock_document(text, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.post_stock_document(text, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

comment on function public.post_stock_document(text, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'S3-f-1: a sale or purchase in one transaction — official numbers, voucher (via post_voucher), document row, stock movements, currentStock.';

insert into public.app_migrations (version, name) values ('080', 'post_stock_document')
  on conflict (version) do nothing;

commit;
