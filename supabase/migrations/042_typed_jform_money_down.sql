-- 042 down · revert typed J-Form money: restore the pre-042 commit function (jforms INSERT
-- without the typed columns), then drop the columns. JSONB was never touched, so no data loss.
create or replace function public.procurement_commit_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec jsonb;
  v_sid text;
  v_no integer;
  v_doc text;
  v_payload jsonb;
  v_docmap jsonb := '{}'::jsonb;   -- jformId -> generated documentNo
  v_result jsonb := '[]'::jsonb;   -- [{ id, lotId, documentNo }] returned to the client
  v_stl text;                      -- generated settlementNo (this transaction)
  v_stlmap jsonb := '{}'::jsonb;   -- settlementId -> generated settlementNo
  v_settle_result jsonb := '[]'::jsonb;  -- [{ id, settlementNo }] returned to the client
begin
  if p_payload ? 'lots' then
    for rec in select value from jsonb_array_elements(p_payload->'lots') loop
      insert into procurement_lots (id, society_id, "centreId", "seasonId", "cropId", "varietyId", "farmerId", "arhtiyaId", quantity, "mspRate", "operationalStatus", "financialStatus", "reconciliationStatus", "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'centreId', rec->>'seasonId', rec->>'cropId', rec->>'varietyId', rec->>'farmerId', rec->>'arhtiyaId', rec->'quantity', rec->'mspRate', rec->>'operationalStatus', rec->>'financialStatus', rec->>'reconciliationStatus', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'qualityTests' then
    for rec in select value from jsonb_array_elements(p_payload->'qualityTests') loop
      insert into procurement_quality_tests (id, society_id, "lotId", result, "inspectedBy", "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->>'result', rec->>'inspectedBy', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'moistureRecords' then
    for rec in select value from jsonb_array_elements(p_payload->'moistureRecords') loop
      insert into procurement_moisture_records (id, society_id, "lotId", moisture, "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->'moisture', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'jforms' then
    for rec in select value from jsonb_array_elements(p_payload->'jforms') loop
      v_sid := rec->>'society_id';
      -- DB-owned numbering: atomic per-society counter (row-locked → concurrency-safe).
      insert into procurement_jform_counters (society_id, last_no) values (v_sid, 1)
        on conflict (society_id) do update set last_no = procurement_jform_counters.last_no + 1
        returning last_no into v_no;
      v_doc := 'J' || lpad(v_no::text, 4, '0');
      insert into procurement_jforms (id, society_id, "lotId", "documentNo", gross, deductions, net, "createdAt", "updatedAt")
      values (rec->>'id', v_sid, rec->>'lotId', v_doc, rec->'gross', rec->'deductions', rec->'net', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
      v_docmap := v_docmap || jsonb_build_object(rec->>'id', v_doc);
      v_result := v_result || jsonb_build_object('id', rec->>'id', 'lotId', rec->>'lotId', 'documentNo', v_doc);
    end loop;
  end if;
  if p_payload ? 'financialIntents' then
    for rec in select value from jsonb_array_elements(p_payload->'financialIntents') loop
      insert into procurement_financial_intents (id, society_id, "lotId", "jformId", "intentType", amount, "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->>'jformId', rec->>'intentType', rec->'amount', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'postingRequests' then
    for rec in select value from jsonb_array_elements(p_payload->'postingRequests') loop
      insert into procurement_posting_requests (id, society_id, "lotId", "jformId", "financialIntentId", "requestType", amount, "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->>'jformId', rec->>'financialIntentId', rec->>'requestType', rec->'amount', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'postingRuleResults' then
    for rec in select value from jsonb_array_elements(p_payload->'postingRuleResults') loop
      insert into procurement_posting_rule_results (id, society_id, "postingRequestId", "lotId", "jformId", "financialIntentId", "requestType", profile, legs, "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'postingRequestId', rec->>'lotId', rec->>'jformId', rec->>'financialIntentId', rec->>'requestType', rec->>'profile', rec->'legs', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'settlements' then
    for rec in select value from jsonb_array_elements(p_payload->'settlements') loop
      v_sid := rec->>'society_id';
      -- DB-owned numbering: assign a gap-free per-society number only at approval (when the row
      -- becomes 'approved' and has no number yet). Row-locked counter → concurrency-safe.
      if (rec->>'status') = 'approved' and (rec->>'settlementNo') is null then
        insert into procurement_settlement_counters (society_id, last_no) values (v_sid, 1)
          on conflict (society_id) do update set last_no = procurement_settlement_counters.last_no + 1
          returning last_no into v_no;
        v_stl := 'STL' || lpad(v_no::text, 6, '0');
      else
        v_stl := rec->>'settlementNo';
      end if;
      insert into procurement_settlements (id, society_id, "settlementNo", "engineVoucherId", status, gross, "deductionLines", "netPayable", "amountPaid", "settlementVoucherId", "approvedAt", "approvedBy", "createdBy", "isDeleted", "createdAt", "updatedAt")
      values (rec->>'id', v_sid, v_stl, rec->>'engineVoucherId', rec->>'status', rec->'gross', rec->'deductionLines', rec->'netPayable', rec->'amountPaid', rec->>'settlementVoucherId', (rec->>'approvedAt')::timestamptz, rec->>'approvedBy', rec->>'createdBy', coalesce((rec->>'isDeleted')::boolean, false), (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz)
      on conflict (id) do update set
        "settlementNo" = excluded."settlementNo", status = excluded.status, gross = excluded.gross,
        "deductionLines" = excluded."deductionLines", "netPayable" = excluded."netPayable",
        "amountPaid" = excluded."amountPaid", "settlementVoucherId" = excluded."settlementVoucherId",
        "approvedAt" = excluded."approvedAt", "approvedBy" = excluded."approvedBy",
        "isDeleted" = excluded."isDeleted", "updatedAt" = excluded."updatedAt";
      v_stlmap := v_stlmap || jsonb_build_object(rec->>'id', v_stl);
      v_settle_result := v_settle_result || jsonb_build_object('id', rec->>'id', 'settlementNo', v_stl);
    end loop;
  end if;
  if p_payload ? 'events' then
    for rec in select value from jsonb_array_elements(p_payload->'events') loop
      v_payload := rec->'payload';
      -- D2(ii): stamp the DB-generated number into the immutable event so it can never diverge.
      if v_payload ? 'jformId' and v_docmap ? (v_payload->>'jformId') then
        v_payload := jsonb_set(v_payload, '{documentNo}', v_docmap->(v_payload->>'jformId'));
      end if;
      if v_payload ? 'settlementId' and v_stlmap ? (v_payload->>'settlementId') then
        v_payload := jsonb_set(v_payload, '{settlementNo}', v_stlmap->(v_payload->>'settlementId'));
      end if;
      insert into procurement_events (id, society_id, name, "correlationId", "occurredAt", "recordedAt", actor, payload)
      values (rec->>'id', rec->>'society_id', rec->>'name', rec->>'correlationId', (rec->>'occurredAt')::timestamptz, (rec->>'recordedAt')::timestamptz, rec->>'actor', v_payload);
    end loop;
  end if;
  return jsonb_build_object('jforms', v_result, 'settlements', v_settle_result);
end;
$$;
grant execute on function public.procurement_commit_transaction(jsonb) to authenticated;

alter table procurement_jforms drop column if exists "grossAmountMinor";
alter table procurement_jforms drop column if exists "grossCurrency";
alter table procurement_jforms drop column if exists "deductionsAmountMinor";
alter table procurement_jforms drop column if exists "deductionsCurrency";
alter table procurement_jforms drop column if exists "netAmountMinor";
alter table procurement_jforms drop column if exists "netCurrency";
