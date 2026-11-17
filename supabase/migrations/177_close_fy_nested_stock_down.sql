-- Undo 177: put back the 091 close_financial_year (stock ledgers = 3400 and its direct children only).
begin;

create or replace function public.close_financial_year(p_fy_label text, p_authority text, p_closing_stock_minor bigint default null)
returns jsonb language plpgsql security definer
set search_path = public as $fn$
declare
  v_sid   text := public.get_current_society_id();
  v_by    text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'admin');
  v_fy    public.financial_years%rowtype;
  v_next  public.financial_years%rowtype;
  v_n     int;
  v_bad   text;
  v_stock bigint; v_delta bigint := 0;
  v_stock_vid text; v_sweep_vid text; v_event text;
  v_legs  jsonb; v_nominal bigint; v_surplus bigint;
begin
  if v_sid is null then raise exception 'close_fy:not_a_society_user — इस समिति के user नहीं हैं।'; end if;
  if not public.is_society_admin(v_sid) then raise exception 'close_fy:admin_only — वर्ष केवल admin close कर सकता है।'; end if;
  if length(btrim(coalesce(p_authority, ''))) < 5 then
    raise exception 'close_fy:authority_required — बोर्ड प्रस्ताव का हवाला (संख्या व तिथि) देना ज़रूरी है।';
  end if;

  select * into v_fy from public.financial_years where society_id = v_sid and fy_label = p_fy_label;
  if v_fy.id is null then raise exception 'close_fy:no_such_year — वर्ष % नहीं मिला।', p_fy_label; end if;
  if v_fy.status <> 'closing' then
    raise exception 'close_fy:not_closing — वर्ष % की स्थिति "%" है; पहले नया वर्ष शुरू करें (केवल "closing" वर्ष close होता है)।', p_fy_label, v_fy.status;
  end if;
  select * into v_next from public.financial_years where society_id = v_sid and status = 'open' and start_date = v_fy.end_date + 1;
  if v_next.id is null then raise exception 'close_fy:next_year_missing — अगला वर्ष खुला नहीं है।'; end if;

  select count(*) into v_n from public.vouchers v
   where v.society_id::text = v_sid and not coalesce(v."isDeleted", false) and v."approvalStatus" = 'pending'
     and substr(v.date, 1, 10)::date between v_fy.start_date and v_fy.end_date;
  if v_n > 0 then raise exception 'close_fy:pending_vouchers — इस वर्ष के % वाउचर अभी स्वीकृति के लिए लम्बित हैं; पहले उन्हें approve/reject करें।', v_n; end if;

  -- Books agree (the B2 readiness rule, this society): per account vouchers = journal = entries.
  with truth as (select account_id acc, net from public._fy_balances(v_sid, 'infinity'::date)),
       stat  as (select a.id acc, round(coalesce(a."openingBalance", 0) * 100 * case when a."openingBalanceType" = 'credit' then -1 else 1 end)::bigint n
                   from public.accounts a where a.society_id::text = v_sid and not coalesce(a."isGroup", false)),
       vtruth as (select t.acc, t.net - coalesce(s.n, 0) net from truth t left join stat s using (acc)),
       -- The journal read exactly as every statement reads it (resolveCurrentVouchers): a cancelled
       -- voucher counts nothing; otherwise its latest voucher.reposted, else its voucher.posted.
       ev as (select e.aggregate_id, e.event_type, e.sequence, e.payload from public.ledger_events e
               where e.society_id::text = v_sid and e.aggregate_type = 'voucher'),
       cur as (select distinct on (aggregate_id) aggregate_id, payload from ev
                where event_type in ('voucher.posted', 'voucher.reposted')
                  and aggregate_id not in (select aggregate_id from ev where event_type = 'voucher.cancelled')
                order by aggregate_id, (event_type = 'voucher.reposted') desc, sequence desc),
       journal as (select l ->> 'accountId' acc, sum((case when l ->> 'drCr' = 'Dr' then 1 else -1 end) * (l ->> 'amountMinor')::bigint) net
                     from cur, jsonb_array_elements(coalesce(cur.payload -> 'lines', '[]'::jsonb)) l group by 1),
       entries as (select ve."accountId" acc, sum(round((ve.dr - ve.cr) * 100))::bigint net
                     from public.voucher_entries ve join public.vouchers v on v.id = ve."voucherId"
                    where ve.society_id::text = v_sid and not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
                    group by 1),
       accs as (select acc from vtruth union select acc from journal union select acc from entries)
  select string_agg(acc, ', ') into v_bad from (
    select a.acc from accs a left join vtruth t using (acc) left join journal j using (acc) left join entries e using (acc)
     where coalesce(t.net, 0) <> coalesce(j.net, 0) or coalesce(t.net, 0) <> coalesce(e.net, 0) limit 5) z;
  if v_bad is not null then
    raise exception 'close_fy:books_disagree — खाते आपस में मेल नहीं खाते (%); support से संपर्क करें, close नहीं हुआ।', v_bad;
  end if;

  if not exists (select 1 from public.accounts where society_id::text = v_sid and id = '1208') then
    raise exception 'close_fy:surplus_account_missing — 1208 "शुद्ध अधिशेष/(घाटा)" खाता नहीं है।';
  end if;

  -- 1. Closing stock (D3).
  if p_closing_stock_minor is not null then
    if p_closing_stock_minor < 0 then raise exception 'close_fy:bad_closing_stock — समापन माल ऋणात्मक नहीं हो सकता।'; end if;
    select coalesce(sum(b.net), 0) into v_stock
      from public._fy_balances(v_sid, v_fy.end_date) b join public.accounts a on a.society_id::text = v_sid and a.id = b.account_id
     where not coalesce(a."isGroup", false) and (a.id = '3400' or a."parentId" = '3400');
    v_delta := p_closing_stock_minor - v_stock;
    if v_delta <> 0 then
      if (select count(*) from public.accounts where society_id::text = v_sid and id in ('3403', '5150')) < 2 then
        raise exception 'close_fy:stock_accounts_missing — 3403 "समापन माल" / 5150 खाते नहीं हैं; Ledger Hygiene से बनाएँ।';
      end if;
      v_stock_vid := public._fy_close_post(v_sid, 'FYC/' || p_fy_label || '/STOCK', v_fy.end_date,
        'समापन माल ' || p_fy_label || ' (वर्ष समापन) — Closing stock', 'fy.close.stock',
        case when v_delta > 0
             then jsonb_build_array(jsonb_build_object('accountId', '3403', 'drCr', 'Dr', 'amountMinor', v_delta), jsonb_build_object('accountId', '5150', 'drCr', 'Cr', 'amountMinor', v_delta))
             else jsonb_build_array(jsonb_build_object('accountId', '5150', 'drCr', 'Dr', 'amountMinor', -v_delta), jsonb_build_object('accountId', '3403', 'drCr', 'Cr', 'amountMinor', -v_delta)) end,
        v_by);
    end if;
  end if;

  -- 2. Year-transfer: zero every income / expense account into 1208, dated the next year's first day.
  with nom as (
    select b.account_id acc, b.net from public._fy_balances(v_sid, v_fy.end_date) b
      join public.accounts a on a.society_id::text = v_sid and a.id = b.account_id
     where a.type in ('income', 'expense') and not coalesce(a."isGroup", false) and b.net <> 0)
  select coalesce(sum(net), 0),
         coalesce(jsonb_agg(jsonb_build_object('accountId', acc, 'drCr', case when net > 0 then 'Cr' else 'Dr' end, 'amountMinor', abs(net)) order by acc), '[]'::jsonb)
    into v_nominal, v_legs from nom;
  v_surplus := -v_nominal;   -- income (Cr, negative) − expense (Dr, positive)
  if v_surplus <> 0 then
    v_legs := v_legs || jsonb_build_array(jsonb_build_object('accountId', '1208', 'drCr', case when v_surplus > 0 then 'Cr' else 'Dr' end, 'amountMinor', abs(v_surplus)));
  end if;
  if jsonb_array_length(v_legs) >= 2 then
    v_sweep_vid := public._fy_close_post(v_sid, 'FYC/' || p_fy_label || '/RESULT', v_next.start_date,
      'वर्ष ' || p_fy_label || ' का परिणाम शुद्ध अधिशेष (1208) में — Year-end transfer', 'fy.close', v_legs, v_by);
    select event_id into v_event from public.ledger_events where aggregate_id = v_sweep_vid and event_type = 'voucher.posted';
  end if;

  -- 3. The year is closed.
  update public.financial_years
     set status = 'closed', closed_at = now(), close_authority = btrim(p_authority), net_result_minor = v_surplus,
         opening_event_id = v_event,
         closed_by = case when auth.jwt() ->> 'sub' ~ '^[0-9a-f-]{36}$' then (auth.jwt() ->> 'sub')::uuid else null end
   where id = v_fy.id;

  -- 4. Audit trail.
  insert into public.audit_log (id, society_id, actor_name, actor_email, actor_role, entity_type, entity_id, action, before, after, reason, source, created_at)
  values (gen_random_uuid(), v_sid, v_by, v_by, auth.jwt() ->> 'user_role', 'financial_year', v_fy.id::text, 'close',
          jsonb_build_object('status', 'closing'),
          jsonb_build_object('status', 'closed', 'netResultMinor', v_surplus, 'stockDeltaMinor', v_delta, 'sweepVoucherId', v_sweep_vid, 'stockVoucherId', v_stock_vid),
          btrim(p_authority), 'close_financial_year', now());

  return jsonb_build_object('status', 'closed', 'fy', p_fy_label, 'netResultMinor', v_surplus, 'stockDeltaMinor', v_delta,
                            'sweepVoucherId', v_sweep_vid, 'stockVoucherId', v_stock_vid);
end;
$fn$;
revoke execute on function public.close_financial_year(text, text, bigint) from public, anon;
grant  execute on function public.close_financial_year(text, text, bigint) to authenticated;

delete from public.app_migrations where version = '177';

commit;
