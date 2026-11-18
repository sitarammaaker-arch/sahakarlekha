-- 179 — restore_commit: vouchers."createdAt" is a timestamp in production; 178 built the derived-rows loop as a
-- UNION whose second branch types that column as text, so every commit failed with
-- "UNION types timestamp without time zone and text cannot be matched" (nothing was written — one transaction).
-- Fix: the temp table _rv carries "createdAt" as text (it is only used as text, in the journal metadata).
-- Only that one line changes; the rest of restore_commit is 178's body verbatim.

begin;

create or replace function public.restore_commit(p_run uuid, p_chunks int, p_mode text, p_manifest_hash text, p_revived jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer
set search_path = public as $fn$
declare
  v_sid text := public.get_current_society_id();
  v_by  text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'admin');
  v_n int; op jsonb; v_t text; v_kind text; v_rows jsonb; k jsonb;
  v_cols text; v_pk text; v_set text; v_cnt int;
  v_rows_written int := 0; v_deleted int := 0; v_cancelled int := 0; v_kept_accounts int := 0;
  v_entries int := 0; v_lines_reposted int := 0; v_ev_posted int := 0; v_ev_reposted int := 0; v_ev_cancelled int := 0;
  r record; v_target jsonb; v_cur public.ledger_events; v_seq bigint; v_meta jsonb; v_fy uuid; v_base int;
  v_old text; v_new text; v_at timestamptz := now();
begin
  -- 1. Checks.
  if v_sid is null then raise exception 'restore:not_a_society_user'; end if;
  if not public.is_society_admin(v_sid) then raise exception 'restore:admin_only — restore केवल admin कर सकता है।'; end if;
  if p_mode not in ('fresh', 'merge', 'replace') then raise exception 'restore:bad_mode'; end if;
  if exists (select 1 from public.society_settings s where s.society_id::text = v_sid and coalesce((to_jsonb(s) ->> 'fyLocked')::boolean, false)) then
    raise exception 'restore:fy_locked — वित्तीय वर्ष audit-lock है; restore नहीं होगा।';
  end if;
  select count(*) into v_n from public.restore_staging where run_id = p_run and society_id = v_sid;
  if v_n <> p_chunks or v_n = 0 then raise exception 'restore:incomplete_upload — % में से % हिस्से पहुँचे; दोबारा चलाएँ।', p_chunks, v_n; end if;

  -- 2. Revived vouchers: free the original number on the old cancelled row.
  for v_old, v_new in select key, value #>> '{}' from jsonb_each(coalesce(p_revived, '{}'::jsonb)) loop
    if not exists (select 1 from public.vouchers where id = v_old and society_id::text = v_sid and coalesce("isDeleted", false)) then
      raise exception 'restore:bad_revived — वाउचर % रद्द नहीं है या इस समिति का नहीं है।', v_old;
    end if;
    update public.vouchers set "voucherNo" = "voucherNo" || ' [radd ' || to_char(v_at, 'DD-MM-YYYY') || ']'
     where id = v_old and society_id::text = v_sid;
  end loop;

  -- 3. The plan.
  for op in
    select x from public.restore_staging s, jsonb_array_elements(s.ops) with ordinality as t(x, ord)
     where s.run_id = p_run and s.society_id = v_sid order by s.seq, t.ord
  loop
    v_t := op ->> 'table'; v_kind := op ->> 'kind';
    if not exists (select 1 from public.restore_tables where table_name = v_t) then
      raise exception 'restore:table_not_allowed — % restore नहीं होती।', v_t;
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_t and column_name = 'society_id') then
      raise exception 'restore:table_not_allowed — % में society_id नहीं है।', v_t;
    end if;

    if v_kind = 'delete' then
      for k in select * from jsonb_array_elements(coalesce(op -> 'keys', '[]'::jsonb)) loop
        k := k - 'society_id';
        if k = '{}'::jsonb then raise exception 'restore:empty_key'; end if;
        if v_t = 'vouchers' then
          update public.vouchers t set "isDeleted" = true
           where t.society_id::text = v_sid and to_jsonb(t) @> k and not coalesce(t."isDeleted", false);
          get diagnostics v_cnt = row_count; v_cancelled := v_cancelled + v_cnt;
        elsif v_t = 'accounts' then
          select count(*) into v_cnt from public.accounts t
           where t.society_id::text = v_sid and to_jsonb(t) @> k
             and (exists (select 1 from public.voucher_lines l where l.society_id = v_sid and l.account_id = t.id)
                  or exists (select 1 from public.account_roles ar where ar.account_id = t.id and ar.society_id::text = v_sid));
          v_kept_accounts := v_kept_accounts + v_cnt;
          delete from public.accounts t
           where t.society_id::text = v_sid and to_jsonb(t) @> k
             and not exists (select 1 from public.voucher_lines l where l.society_id = v_sid and l.account_id = t.id)
             and not exists (select 1 from public.account_roles ar where ar.account_id = t.id and ar.society_id::text = v_sid);
          get diagnostics v_cnt = row_count; v_deleted := v_deleted + v_cnt;
        else
          execute format('delete from public.%I t where t.society_id::text = $1 and to_jsonb(t) @> $2', v_t) using v_sid, k;
          get diagnostics v_cnt = row_count; v_deleted := v_deleted + v_cnt;
        end if;
      end loop;

    elsif v_kind in ('insert', 'upsert') then
      select coalesce(jsonb_agg(x || jsonb_build_object('society_id', v_sid)), '[]'::jsonb) into v_rows
        from jsonb_array_elements(coalesce(op -> 'rows', '[]'::jsonb)) x;
      if jsonb_array_length(v_rows) = 0 then continue; end if;
      select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position) into v_cols
        from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = v_t
         and exists (select 1 from jsonb_array_elements(v_rows) x where x ? c.column_name);
      if v_kind = 'insert' then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)', v_t, v_cols, v_cols, v_t) using v_rows;
        get diagnostics v_cnt = row_count;
      else
        select string_agg(format('%I', a.attname), ', ') into v_pk
          from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
         where i.indrelid = format('public.%I', v_t)::regclass and i.indisprimary;
        if v_pk is null then raise exception 'restore:no_primary_key — % ', v_t; end if;
        select string_agg(format('%I = excluded.%I', c.column_name, c.column_name), ', ' order by c.ordinal_position) into v_set
          from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = v_t
           and exists (select 1 from jsonb_array_elements(v_rows) x where x ? c.column_name)
           and c.column_name not in (select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                                      where i.indrelid = format('public.%I', v_t)::regclass and i.indisprimary);
        execute format('insert into public.%I as t (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do %s',
                       v_t, v_cols, v_cols, v_t, v_pk,
                       case when v_set is null then 'nothing'
                            else format('update set %s where t.society_id::text = %L', v_set, v_sid) end)
          using v_rows;
        get diagnostics v_cnt = row_count;
        if v_set is not null and v_cnt <> jsonb_array_length(v_rows) then
          raise exception 'restore:foreign_row — % की कुछ पंक्तियाँ किसी दूसरी समिति की हैं; restore रोका गया।', v_t;
        end if;
      end if;
      v_rows_written := v_rows_written + v_cnt;
    else
      raise exception 'restore:bad_op %', v_kind;
    end if;
  end loop;

  -- 4. Derived rows, for the whole society, from the restored vouchers.
  create temp table _rv on commit drop as
    select v.id, v."voucherNo", v."type", v.amount, v.narration, v."memberId", v."branchId", v."createdBy", v."createdAt"::text as "createdAt",
           substr(v.date, 1, 10)::date as vdate, to_jsonb(v) ->> 'workOrderId' as work_order_id, to_jsonb(v) ->> 'costCentreId' as cost_centre_id,
           to_jsonb(v) ->> 'jurisdiction' as jurisdiction,
           (not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')) as live,
           public._restore_voucher_legs(v) as legs
      from public.vouchers v where v.society_id::text = v_sid;

  -- 4a. voucher_entries: replaced for the society.
  delete from public.voucher_entries where society_id::text = v_sid;
  insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, narration, society_id, "workOrderId", "costCentreId", jurisdiction)
  select rv.id || '-' || (l ->> 'lineId'), rv.id, l ->> 'accountId',
         case when l ->> 'drCr' = 'Dr' then (l ->> 'amountMinor')::numeric / 100 else 0 end,
         case when l ->> 'drCr' = 'Cr' then (l ->> 'amountMinor')::numeric / 100 else 0 end,
         l ->> 'narration', v_sid, rv.work_order_id, rv.cost_centre_id, rv.jurisdiction
    from _rv rv, jsonb_array_elements(rv.legs) l where rv.live;
  get diagnostics v_entries = row_count;

  -- 4b + 4c. voucher_lines and the journal, voucher by voucher (plus journal aggregates whose row is gone).
  for r in
    select rv.id, rv."voucherNo", rv."type", rv.amount, rv.narration, rv."memberId", rv."branchId", rv."createdBy", rv."createdAt",
           rv.vdate, rv.work_order_id, rv.cost_centre_id, rv.jurisdiction, rv.live, rv.legs
      from _rv rv
    union all
    select g.aggregate_id, null::text, null::text, null::numeric, null::text, null::text, null::text, null::text, null::text,
           null::date, null::text, null::text, null::text, false, '[]'::jsonb
      from (select distinct e.aggregate_id from public.ledger_events e
             where e.society_id = v_sid and e.aggregate_type = 'voucher' and not exists (select 1 from _rv where _rv.id = e.aggregate_id)) g
  loop
    v_target := case when r.live then (select coalesce(jsonb_agg(jsonb_build_object('accountId', l ->> 'accountId', 'drCr', l ->> 'drCr', 'amountMinor', (l ->> 'amountMinor')::bigint)), '[]'::jsonb)
                                         from jsonb_array_elements(r.legs) l)
                     else '[]'::jsonb end;

    -- voucher_lines (posting-service ledger rows): reverse and re-post when the legs differ.
    if public._restore_leg_key(v_target) is distinct from (
         select public._restore_leg_key(coalesce(jsonb_agg(jsonb_build_object('accountId', vl.account_id,
                  'drCr', case when vl.dr_minor > 0 then 'Dr' else 'Cr' end, 'amountMinor', greatest(vl.dr_minor, vl.cr_minor))), '[]'::jsonb))
           from public.voucher_lines vl where vl.voucher_id = r.id and vl.status = 'posted') then
      if r.vdate is not null and exists (select 1 from public.financial_years f where f.society_id = v_sid and r.vdate between f.start_date and f.end_date and f.status in ('closed', 'audited')) then
        raise exception 'restore:closed_year — वाउचर % (%) बंद / ऑडिट हुए वर्ष का है; restore उसे नहीं बदल सकता।', r."voucherNo", r.vdate;
      end if;
      update public.voucher_lines set status = 'reversed' where voucher_id = r.id and status = 'posted';
      if jsonb_array_length(v_target) > 0 then
        select f.id into v_fy from public.financial_years f where f.society_id = v_sid and r.vdate between f.start_date and f.end_date limit 1;
        if v_fy is null then raise exception 'restore:no_financial_year — वाउचर % की तारीख % किसी वित्तीय वर्ष में नहीं है।', r."voucherNo", r.vdate; end if;
        select coalesce(max(line_no), 0) into v_base from public.voucher_lines where voucher_id = r.id;
        insert into public.voucher_lines (id, society_id, voucher_id, fy_id, line_no, account_id, dr_minor, cr_minor,
                                          narration, work_order_id, cost_centre_id, branch_id, entry_date, status, source)
        select r.id || '~' || (v_base + ord), v_sid, r.id, v_fy, (v_base + ord)::int, l ->> 'accountId',
               case when l ->> 'drCr' = 'Dr' then (l ->> 'amountMinor')::bigint else 0 end,
               case when l ->> 'drCr' = 'Cr' then (l ->> 'amountMinor')::bigint else 0 end,
               l ->> 'narration', r.work_order_id, r.cost_centre_id, r."branchId", r.vdate, 'posted', 'restore'
          from jsonb_array_elements(r.legs) with ordinality as t(l, ord);
      end if;
      v_lines_reposted := v_lines_reposted + 1;
    end if;

    -- The journal: append only.
    select * into v_cur from public.ledger_events e
     where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = r.id
       and e.event_type in ('voucher.posted', 'voucher.reposted')
       and not exists (select 1 from public.ledger_events c where c.society_id = v_sid and c.aggregate_type = 'voucher'
                        and c.aggregate_id = r.id and c.event_type = 'voucher.cancelled')
     order by (e.event_type = 'voucher.reposted') desc, e.sequence desc limit 1;
    select coalesce(max(e.sequence), 0) into v_seq from public.ledger_events e
     where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = r.id;
    v_meta := jsonb_build_object('voucherNo', coalesce(r."voucherNo", ''), 'type', coalesce(r."type", ''), 'amount', coalesce(r.amount, 0),
                                 'date', coalesce(r.vdate::text, ''), 'narration', coalesce(r.narration, ''), 'memberId', coalesce(r."memberId", ''),
                                 'branchId', coalesce(r."branchId", ''), 'createdBy', coalesce(r."createdBy", ''), 'createdAt', coalesce(r."createdAt"::text, ''),
                                 'reason', 'restore');

    if jsonb_array_length(v_target) > 0 then
      if v_cur.event_id is null then
        if exists (select 1 from public.ledger_events c where c.society_id = v_sid and c.aggregate_type = 'voucher' and c.aggregate_id = r.id and c.event_type = 'voucher.cancelled') then
          raise exception 'restore:revived_voucher — वाउचर % रद्द हो चुका था; उसे नई पहचान के साथ लौटाना था।', r."voucherNo";
        end if;
        insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id,
                                          sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
        values (gen_random_uuid()::text, 'voucher.posted', 1, v_sid, r.jurisdiction, 'voucher', r.id, v_seq + 1, v_at, 'import', 'restore', v_by, null,
                jsonb_build_object('lines', v_target) || v_meta);
        v_ev_posted := v_ev_posted + 1;
      elsif public._restore_leg_key(v_cur.payload -> 'lines') is distinct from public._restore_leg_key(v_target) then
        if exists (select 1 from public.financial_years f where f.society_id = v_sid and f.status in ('closed', 'audited')
                    and (r.vdate between f.start_date and f.end_date
                         or nullif(substr(v_cur.payload ->> 'date', 1, 10), '')::date between f.start_date and f.end_date)) then
          raise exception 'restore:closed_year — वाउचर % बंद / ऑडिट हुए वर्ष का है; restore उसे नहीं बदल सकता।', r."voucherNo";
        end if;
        insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id,
                                          sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
        values (gen_random_uuid()::text, 'voucher.reversed', 1, v_sid, r.jurisdiction, 'voucher', r.id, v_seq + 1, v_at, 'import', 'restore', v_by, v_cur.event_id,
                (v_cur.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_cur.payload -> 'lines'), 'reason', 'restore')),
               (gen_random_uuid()::text, 'voucher.reposted', 1, v_sid, r.jurisdiction, 'voucher', r.id, v_seq + 2, v_at, 'import', 'restore', v_by, null,
                jsonb_build_object('lines', v_target) || v_meta);
        v_ev_reposted := v_ev_reposted + 1;
      end if;
    elsif v_cur.event_id is not null then
      if exists (select 1 from public.financial_years f where f.society_id = v_sid and f.status in ('closed', 'audited')
                  and nullif(substr(v_cur.payload ->> 'date', 1, 10), '')::date between f.start_date and f.end_date) then
        raise exception 'restore:closed_year — वाउचर % बंद / ऑडिट हुए वर्ष का है; restore उसे रद्द नहीं कर सकता।', coalesce(r."voucherNo", v_cur.payload ->> 'voucherNo');
      end if;
      insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id,
                                        sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
      values (gen_random_uuid()::text, 'voucher.cancelled', 1, v_sid, r.jurisdiction, 'voucher', r.id, v_seq + 1, v_at, 'import', 'restore', v_by, v_cur.event_id,
              (v_cur.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_cur.payload -> 'lines'), 'reason', 'restore'));
      v_ev_cancelled := v_ev_cancelled + 1;
    end if;
  end loop;

  -- 6. Audit and clean-up.
  insert into public.audit_log (id, society_id, actor_name, actor_email, actor_role, entity_type, entity_id, action, before, after, reason, source, created_at)
  values (gen_random_uuid(), v_sid, v_by, v_by, auth.jwt() ->> 'user_role', 'restore', p_run::text, 'restore', null,
          jsonb_build_object('mode', p_mode, 'manifestHash', p_manifest_hash, 'rowsWritten', v_rows_written, 'rowsDeleted', v_deleted,
                             'vouchersCancelled', v_cancelled, 'accountsKept', v_kept_accounts, 'revived', coalesce(p_revived, '{}'::jsonb),
                             'entries', v_entries, 'voucherLinesReposted', v_lines_reposted,
                             'journal', jsonb_build_object('posted', v_ev_posted, 'reposted', v_ev_reposted, 'cancelled', v_ev_cancelled)),
          'server restore', 'restore_commit', v_at);
  delete from public.restore_staging where run_id = p_run;

  return jsonb_build_object('status', 'committed', 'rowsWritten', v_rows_written, 'rowsDeleted', v_deleted,
                            'vouchersCancelled', v_cancelled, 'accountsKept', v_kept_accounts, 'entries', v_entries,
                            'voucherLinesReposted', v_lines_reposted,
                            'journal', jsonb_build_object('posted', v_ev_posted, 'reposted', v_ev_reposted, 'cancelled', v_ev_cancelled));
end;
$fn$;
revoke execute on function public.restore_commit(uuid, int, text, text, jsonb) from public, anon;
grant execute on function public.restore_commit(uuid, int, text, text, jsonb) to authenticated;

insert into public.app_migrations (version, name) values ('179', 'restore_commit_createdat_text')
  on conflict (version) do nothing;

commit;
