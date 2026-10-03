-- 103 · S4-a — a server path for every accounting write the app still made directly while the posting
-- service is ON (docs/accounting/S4-CLIENT-WRITE-ENFORCEMENT.md §2). Approved 2026-10-03.
--
--   reject_voucher(p_id, p_reason, p_rejected_by)           pending → rejected; its voucher_entries removed
--   set_voucher_cleared(p_id, p_cleared, p_cleared_date)    bank-reconciliation flag only (isCleared, clearedDate)
--   link_voucher_reversal(p_original_id, p_reversal_id)     reversalOf / reversedBy, both rows in one statement
--   sync_account_opening_event(p_account_id, p_target_minor) the account.opening delta, computed from the DB journal
--   merge_accounts(p_keep, p_remove, p_by)                  the whole merge in ONE transaction (was ~N client writes
--                                                            with compensating undo)
--
-- CONTRACT (as post_voucher / edit_voucher / approve_voucher): society = get_current_society_id(); role claim
-- required (fail-closed); jwt_can_write() (jwt_can_delete() for the merge, which deletes an account); not
-- FY-locked; error codes 'post_voucher:<code>' so the app's existing message table names them.
-- SECURITY DEFINER owned by postgres ⇒ unaffected by S4-b's restrictive policies.
-- ADDITIVE: five new functions. The app calls them only when society_flags.posting_service is ON.
-- Reversible: 103_s4_server_paths_down.sql.

begin;

-- ─────────────────────────────────────────────────────────────────────────────────────── reject_voucher
create or replace function public.reject_voucher(p_id text, p_reason text, p_rejected_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid  text := public.get_current_society_id();
  v_cur  public.vouchers;
  v_at   text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
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
         "approvedBy" = p_rejected_by, "approvedAt" = v_at
  where id = p_id;
  delete from public.voucher_entries where "voucherId" = p_id;
  return jsonb_build_object('status', 'rejected', 'id', p_id, 'approvedAt', v_at);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────────── set_voucher_cleared
create or replace function public.set_voucher_cleared(p_id text, p_cleared boolean, p_cleared_date text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid  text := public.get_current_society_id();
  v_cur  public.vouchers;
  v_date text;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if exists (select 1 from public.society_settings s where s.society_id::text = v_sid and coalesce(s."fyLocked", false)) then
    raise exception 'post_voucher:fy_locked';
  end if;
  select * into v_cur from public.vouchers where id = p_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_cur."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
  if p_cleared then
    if p_cleared_date is not null and p_cleared_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'post_voucher:bad_date'; end if;
    v_date := coalesce(p_cleared_date, to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD'));
  end if;
  update public.vouchers set "isCleared" = p_cleared, "clearedDate" = case when p_cleared then v_date else null end
  where id = p_id;
  return jsonb_build_object('status', case when p_cleared then 'cleared' else 'uncleared' end, 'id', p_id, 'clearedDate', v_date);
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────── link_voucher_reversal
-- The contra itself is posted by post_voucher (addVoucher). This sets the two links together, so a
-- reversal can never exist half-linked (one side set, the other not).
create or replace function public.link_voucher_reversal(p_original_id text, p_reversal_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid  text := public.get_current_society_id();
  v_orig public.vouchers;
  v_rev  public.vouchers;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if p_original_id is null or p_reversal_id is null or p_original_id = p_reversal_id then
    raise exception 'post_voucher:not_a_reversal_pair';
  end if;
  select * into v_orig from public.vouchers where id = p_original_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  select * into v_rev from public.vouchers where id = p_reversal_id and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:voucher_not_found'; end if;
  if coalesce(v_orig."isDeleted", false) or coalesce(v_rev."isDeleted", false) then raise exception 'post_voucher:voucher_cancelled'; end if;
  if coalesce(v_orig."reversedBy", '') = p_reversal_id and coalesce(v_rev."reversalOf", '') = p_original_id then
    return jsonb_build_object('status', 'already_linked', 'originalId', p_original_id, 'reversalId', p_reversal_id);
  end if;
  if coalesce(v_orig."reversedBy", '') <> '' then raise exception 'post_voucher:voucher_reversed'; end if;
  if coalesce(v_rev."reversalOf", '') <> '' or coalesce(v_orig."reversalOf", '') <> '' then raise exception 'post_voucher:not_a_reversal_pair'; end if;
  if round(coalesce(v_orig.amount, 0) * 100) <> round(coalesce(v_rev.amount, 0) * 100) then
    raise exception 'post_voucher:not_a_reversal_pair';
  end if;
  update public.vouchers set "reversalOf" = p_original_id where id = p_reversal_id;
  update public.vouchers set "reversedBy" = p_reversal_id where id = p_original_id;
  return jsonb_build_object('status', 'linked', 'originalId', p_original_id, 'reversalId', p_reversal_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────── sync_account_opening_event
-- Appends the account.opening delta that brings the JOURNAL's opening for the account to the target —
-- the account's stored opening (Dr +, Cr −, paise) or p_target_minor when given (0 for a deleted account).
-- Computed from the DB journal under a lock, never from a possibly-partial client copy. Idempotent.
-- Event shape = src/lib/ledger/genesis.ts planOpeningDelta (id 'opening-<acct>-<seq>', 2000-01-01).
create or replace function public.sync_account_opening_event(p_account_id text, p_target_minor bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid    text := public.get_current_society_id();
  v_acc    public.accounts;
  v_juris  text;
  v_target bigint;
  v_prev   bigint;
  v_delta  bigint;
  v_seq    int;
  v_me     text;
  v_ev     public.ledger_events;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_write() then raise exception 'post_voucher:role_cannot_write'; end if;
  if exists (select 1 from public.society_settings s where s.society_id::text = v_sid and coalesce(s."fyLocked", false)) then
    raise exception 'post_voucher:fy_locked';
  end if;
  if coalesce(p_account_id, '') = '' then raise exception 'post_voucher:account_not_found'; end if;
  -- Serialise opening appends for this account (two concurrent saves must not both take max+1).
  perform pg_advisory_xact_lock(hashtext('opening:' || v_sid || ':' || p_account_id));

  select * into v_acc from public.accounts a where a.id = p_account_id and a.society_id::text = v_sid;
  if found then
    v_target := coalesce(p_target_minor,
      (case when v_acc."openingBalanceType" = 'debit' then 1 else -1 end) * round(coalesce(v_acc."openingBalance", 0) * 100)::bigint);
  elsif p_target_minor is null then
    raise exception 'post_voucher:account_not_found';
  else
    v_target := p_target_minor;                -- the account row is already deleted (net its journal opening to 0)
  end if;

  select coalesce(sum(case when l ->> 'drCr' = 'Dr' then (l ->> 'amountMinor')::bigint else -(l ->> 'amountMinor')::bigint end), 0)
    into v_prev
  from public.ledger_events e, jsonb_array_elements(coalesce(e.payload -> 'lines', '[]'::jsonb)) l
  where e.society_id = v_sid and e.aggregate_type = 'account' and e.aggregate_id = p_account_id and e.event_type = 'account.opening';
  v_delta := v_target - v_prev;
  if v_delta = 0 then
    return jsonb_build_object('status', 'in_sync', 'accountId', p_account_id, 'events', '[]'::jsonb);
  end if;

  select coalesce(max(e.sequence), 0) + 1 into v_seq from public.ledger_events e
  where e.society_id = v_sid and e.aggregate_type = 'account' and e.aggregate_id = p_account_id;
  select s.jurisdiction into v_juris from public.society_settings s where s.society_id::text = v_sid;
  select u.name into v_me from public.society_users u
  where u.society_id::text = v_sid and lower(u.email) = lower(auth.jwt() ->> 'email') limit 1;

  insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                    aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
  values ('opening-' || p_account_id || '-' || v_seq, 'account.opening', 1, v_sid, v_juris, 'account', p_account_id, v_seq,
          '2000-01-01T00:00:00Z'::timestamptz, 'human', v_me, null, null,
          jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('accountId', p_account_id,
                                'drCr', case when v_delta > 0 then 'Dr' else 'Cr' end, 'amountMinor', abs(v_delta))),
                             'opening', true, 'adjustment', true, 'prevSignedMinor', v_prev, 'newSignedMinor', v_target))
  returning * into v_ev;
  return jsonb_build_object('status', 'appended', 'accountId', p_account_id, 'events', jsonb_build_array(to_jsonb(v_ev)));
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────────────────── merge_accounts
-- Mirrors src/lib/ledger/accountMerge.ts + DataContext.mergeAccounts' guards, in ONE transaction:
--   every voucher referencing p_remove (cancelled included) is re-pointed (debit/credit/lines), its
--   voucher_entries and voucher_lines too; each LIVE, non-pending voucher with a journal posting gets
--   voucher.reversed (flip of that posting's legs) + voucher.reposted (the same legs re-pointed) — the log
--   is never edited in place; parties are re-pointed; the removed account's journal opening is netted to 0;
--   the account is deleted when nothing else references it (else kept, accountDeleted=false); audit row.
create or replace function public.merge_accounts(p_keep text, p_remove text, p_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid     text := public.get_current_society_id();
  v_keep    public.accounts;
  v_rem     public.accounts;
  v_lock    text;
  v_juris   text;
  v_me      text;
  v_at      timestamptz := now();
  v_v       public.vouchers;
  v_post    public.ledger_events;
  v_seq     int;
  v_legs    jsonb;
  v_moved   int := 0;
  v_journ   int := 0;
  v_deleted boolean := false;
  v_ids     text[] := '{}';
  v_prev    bigint;
  v_oseq    int;
  v_evids   text[] := '{}';
  v_e1      text;
  v_e2      text;
begin
  if v_sid is null then raise exception 'post_voucher:not_a_society_user'; end if;
  if auth.jwt() ->> 'user_role' is null then raise exception 'post_voucher:no_role_claim'; end if;
  if not public.jwt_can_delete() then raise exception 'post_voucher:role_cannot_delete'; end if;
  if exists (select 1 from public.society_settings s where s.society_id::text = v_sid and coalesce(s."fyLocked", false)) then
    raise exception 'post_voucher:fy_locked';
  end if;
  if coalesce(p_keep, '') = '' or coalesce(p_remove, '') = '' or p_keep = p_remove then raise exception 'post_voucher:same_account'; end if;

  select * into v_keep from public.accounts where id = p_keep and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:account_not_found'; end if;
  select * into v_rem from public.accounts where id = p_remove and society_id::text = v_sid for update;
  if not found then raise exception 'post_voucher:account_not_found'; end if;
  if coalesce(v_rem."isSystem", false) then raise exception 'post_voucher:system_account'; end if;
  if coalesce(v_keep."isGroup", false) or coalesce(v_rem."isGroup", false) then raise exception 'post_voucher:group_account'; end if;
  if v_keep.type is distinct from v_rem.type then raise exception 'post_voucher:account_type_mismatch'; end if;
  if abs(coalesce(v_rem."openingBalance", 0)) >= 0.005 then raise exception 'post_voucher:account_has_opening'; end if;
  if exists (select 1 from public.stock_items s where s.society_id::text = v_sid and (s."salesAccountId" = p_remove or s."purchaseAccountId" = p_remove)) then
    raise exception 'post_voucher:stock_item_uses_account';
  end if;
  if (exists (select 1 from public.suppliers x where x.society_id::text = v_sid and x."accountId" = p_remove)
      or exists (select 1 from public.customers x where x.society_id::text = v_sid and x."accountId" = p_remove))
     and (exists (select 1 from public.suppliers x where x.society_id::text = v_sid and x."accountId" = p_keep)
      or exists (select 1 from public.customers x where x.society_id::text = v_sid and x."accountId" = p_keep)) then
    raise exception 'post_voucher:two_parties';
  end if;

  -- Every voucher that references p_remove, locked.
  select coalesce(array_agg(v.id order by v.id), '{}') into v_ids
  from public.vouchers v
  where v.society_id::text = v_sid
    and (v."debitAccountId" = p_remove or v."creditAccountId" = p_remove
         or (jsonb_typeof(v.lines) = 'array' and exists (select 1 from jsonb_array_elements(v.lines) x where x ->> 'accountId' = p_remove)));
  perform 1 from public.vouchers v where v.id = any (v_ids) for update;

  if exists (select 1 from public.vouchers v where v.id = any (v_ids) and coalesce(v.origin, '') = 'engine') then
    raise exception 'post_voucher:engine_voucher';
  end if;
  select s."periodLockDate", s.jurisdiction into v_lock, v_juris from public.society_settings s where s.society_id::text = v_sid;
  if v_lock ~ '^\d{4}-\d{2}-\d{2}' and exists (
       select 1 from public.vouchers v where v.id = any (v_ids) and not coalesce(v."isDeleted", false)
         and substr(v.date, 1, 10) ~ '^\d{4}-\d{2}-\d{2}$' and substr(v.date, 1, 10)::date <= substr(v_lock, 1, 10)::date) then
    raise exception 'post_voucher:period_locked';
  end if;
  select u.name into v_me from public.society_users u
  where u.society_id::text = v_sid and lower(u.email) = lower(auth.jwt() ->> 'email') limit 1;

  for v_v in select * from public.vouchers v where v.id = any (v_ids) order by v.id loop
    -- The journal pair first (it reads the CURRENT posting before anything moves).
    if not coalesce(v_v."isDeleted", false) and coalesce(v_v."approvalStatus", '') <> 'pending' then
      v_post := null;
      select * into v_post from public.ledger_events e
      where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = v_v.id
        and e.event_type in ('voucher.posted', 'voucher.reposted')
        and not exists (select 1 from public.ledger_events c where c.society_id = v_sid and c.aggregate_type = 'voucher'
                        and c.aggregate_id = v_v.id and c.event_type = 'voucher.cancelled')
      order by e.sequence desc limit 1;
      if v_post.event_id is not null then
        select coalesce(max(e.sequence), 0) into v_seq from public.ledger_events e
        where e.society_id = v_sid and e.aggregate_type = 'voucher' and e.aggregate_id = v_v.id;
        select coalesce(jsonb_agg(case when l ->> 'accountId' = p_remove then jsonb_set(l, '{accountId}', to_jsonb(p_keep)) else l end order by ord), '[]'::jsonb)
          into v_legs from jsonb_array_elements(v_post.payload -> 'lines') with ordinality as t(l, ord);
        v_e1 := gen_random_uuid()::text;
        v_e2 := gen_random_uuid()::text;
        v_evids := v_evids || v_e1 || v_e2;
        insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                          aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
        values (v_e1, 'voucher.reversed', 1, v_sid, v_juris, 'voucher', v_v.id, v_seq + 1, v_at, 'human',
                coalesce(p_by, v_me), null, v_post.event_id,
                (v_post.payload - 'lines') || jsonb_build_object('lines', public._voucher_flip_legs(v_post.payload -> 'lines'),
                  'mergedAccountId', p_remove, 'intoAccountId', p_keep, 'reason', 'account-merge')),
               (v_e2, 'voucher.reposted', 1, v_sid, v_juris, 'voucher', v_v.id, v_seq + 2, v_at, 'human',
                coalesce(p_by, v_me), null, null,
                (v_post.payload - 'lines') || jsonb_build_object('lines', v_legs,
                  'mergedAccountId', p_remove, 'intoAccountId', p_keep, 'reason', 'account-merge'));
        v_journ := v_journ + 1;
      end if;
    end if;

    update public.vouchers set
      "debitAccountId"  = case when "debitAccountId"  = p_remove then p_keep else "debitAccountId" end,
      "creditAccountId" = case when "creditAccountId" = p_remove then p_keep else "creditAccountId" end,
      lines = case when jsonb_typeof(lines) = 'array'
                   then (select coalesce(jsonb_agg(case when x ->> 'accountId' = p_remove then jsonb_set(x, '{accountId}', to_jsonb(p_keep)) else x end order by ord), '[]'::jsonb)
                         from jsonb_array_elements(lines) with ordinality as t(x, ord))
                   else lines end
    where id = v_v.id;
    v_moved := v_moved + 1;
  end loop;

  update public.voucher_entries set "accountId" = p_keep where society_id = v_sid and "accountId" = p_remove;
  update public.voucher_lines   set account_id  = p_keep where society_id = v_sid and account_id  = p_remove;
  update public.suppliers set "accountId" = p_keep where society_id::text = v_sid and "accountId" = p_remove;
  update public.customers set "accountId" = p_keep where society_id::text = v_sid and "accountId" = p_remove;

  -- Net the removed account's journal opening to 0 (its stored opening is 0 — checked above).
  select coalesce(sum(case when l ->> 'drCr' = 'Dr' then (l ->> 'amountMinor')::bigint else -(l ->> 'amountMinor')::bigint end), 0)
    into v_prev
  from public.ledger_events e, jsonb_array_elements(coalesce(e.payload -> 'lines', '[]'::jsonb)) l
  where e.society_id = v_sid and e.aggregate_type = 'account' and e.aggregate_id = p_remove and e.event_type = 'account.opening';
  if v_prev <> 0 then
    select coalesce(max(e.sequence), 0) + 1 into v_oseq from public.ledger_events e
    where e.society_id = v_sid and e.aggregate_type = 'account' and e.aggregate_id = p_remove;
    v_evids := v_evids || ('opening-' || p_remove || '-' || v_oseq);
    insert into public.ledger_events (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type,
                                      aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
    values ('opening-' || p_remove || '-' || v_oseq, 'account.opening', 1, v_sid, v_juris, 'account', p_remove, v_oseq,
            '2000-01-01T00:00:00Z'::timestamptz, 'human', coalesce(p_by, v_me), null, null,
            jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('accountId', p_remove,
                                  'drCr', case when v_prev < 0 then 'Dr' else 'Cr' end, 'amountMinor', abs(v_prev))),
                               'opening', true, 'adjustment', true, 'prevSignedMinor', v_prev, 'newSignedMinor', 0));
  end if;

  -- Delete the emptied account unless something else still references it (account_roles, …).
  begin
    delete from public.accounts where id = p_remove and society_id::text = v_sid;
    v_deleted := found;
  exception when foreign_key_violation then
    v_deleted := false;
  end;

  insert into public.audit_log (society_id, actor_name, actor_email, actor_role, entity_type, entity_id, action, before, after, reason, source, jurisdiction)
  values (v_sid, coalesce(p_by, v_me), auth.jwt() ->> 'email', auth.jwt() ->> 'user_role', 'account', p_remove, 'merge',
          jsonb_build_object('accountId', p_remove, 'name', v_rem.name),
          jsonb_build_object('intoAccountId', p_keep, 'intoName', v_keep.name, 'moved', v_moved, 'journaled', v_journ, 'accountDeleted', v_deleted),
          'Account merged', 'merge_accounts', v_juris);

  return jsonb_build_object('status', 'merged', 'moved', v_moved, 'journaled', v_journ, 'accountDeleted', v_deleted,
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.aggregate_id, e.sequence), '[]'::jsonb)
               from public.ledger_events e where e.society_id = v_sid and e.event_id = any (v_evids)));
end;
$$;

revoke execute on function public.reject_voucher(text, text, text) from public, anon;
revoke execute on function public.set_voucher_cleared(text, boolean, text) from public, anon;
revoke execute on function public.link_voucher_reversal(text, text) from public, anon;
revoke execute on function public.sync_account_opening_event(text, bigint) from public, anon;
revoke execute on function public.merge_accounts(text, text, text) from public, anon;
grant execute on function public.reject_voucher(text, text, text) to authenticated;
grant execute on function public.set_voucher_cleared(text, boolean, text) to authenticated;
grant execute on function public.link_voucher_reversal(text, text) to authenticated;
grant execute on function public.sync_account_opening_event(text, bigint) to authenticated;
grant execute on function public.merge_accounts(text, text, text) to authenticated;

insert into public.app_migrations (version, name) values ('103', 's4_server_paths')
  on conflict (version) do nothing;

commit;
