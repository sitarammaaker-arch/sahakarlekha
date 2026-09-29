-- 082 · cancel_stock_document — a sale or purchase deleted in ONE transaction (Phase-3 S3-f-2, approved
-- 2026-09-29).
--
-- WHY: deleteSale / deletePurchase soft-delete the row, cancel the linked vouchers, restore every item's
-- currentStock and delete the stock_movements with separate calls — a failure part-way leaves a deleted
-- document whose voucher is still live, or movements gone while the row survives, etc.
-- cancel_stock_document does all of it in one transaction.
--
-- CONTRACT:
--   • society = get_current_society_id(); role claim REQUIRED; jwt_can_delete() (the app's delete gate)
--   • the row is locked FOR UPDATE within the JWT society; an already-deleted document → status
--     'already_cancelled' (idempotent); not FY-locked; its date after the period lock, in an OPEN FY
--   • every linked voucher (voucherId + gstVoucherIds / taxVoucherIds) that is live and not engine-made
--     goes through public.cancel_voucher — every one of its checks applies (a reversed voucher refuses
--     the whole delete); their voucher.cancelled events are returned to the app
--   • the document's stock_movements (referenceNo = its number, as the app deletes them) are removed and
--     the currentStock cache is restored FROM THOSE MOVEMENTS (sale +qty; purchase −qty floored at 0)
--   • the row is kept (isDeleted = true) for audit, as today
--
-- ADDITIVE ONLY: one new function. Nothing calls it until the app is wired and a society's
-- posting_service flag is on. Requires 078 (cancel_voucher). Reversible: 082_cancel_stock_document_down.sql.

begin;

create or replace function public.cancel_stock_document(p_kind text, p_id text, p_reason text default null, p_by text default null)
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
$$;

revoke all on function public.cancel_stock_document(text, text, text, text) from public, anon;
grant execute on function public.cancel_stock_document(text, text, text, text) to authenticated;

comment on function public.cancel_stock_document(text, text, text, text) is
  'S3-f-2: a sale or purchase deleted in one transaction — row soft-deleted, vouchers cancelled (via cancel_voucher), movements removed, currentStock restored.';

insert into public.app_migrations (version, name) values ('082', 'cancel_stock_document')
  on conflict (version) do nothing;

commit;
