-- 184 · SEC-09 + SEC-08 (product audit 2026-11-17)
--
-- SEC-09 — an expired subscription paused new vouchers only in the browser. The server now applies the same rule
--   (src/lib/plans.ts effectiveStatus): the stored status is 'expired', or period_end is set and 7 days have passed.
--   post_voucher and save_pending_voucher (a NEW held voucher) refuse with 'subscription_expired'. Reading, reports,
--   export, approving / editing / cancelling existing vouchers are unchanged. No row or no period_end → writable
--   (legacy societies with no end date). Production 2026-11-19: 0 expired; first trials pause 8 Dec 2026.
--   post_voucher / save_pending_voucher = 183's bodies + only the lines marked "184 / SEC-09".
--
-- SEC-08 — audit rows were written by the browser; a write straight to a table through the API left no trace.
--   • public.change_log: append-only, written ONLY by the trigger below (no client insert/update/delete).
--   • Every direct client write (current_user = 'authenticated') on the society tables adds one row: who (token
--     email + role), which table / row, which columns changed, before / after. An UPDATE that changes nothing
--     (e.g. an unchanged upsert) adds nothing. Server functions (posting, restore, year close) are not repeated
--     here — they already write the journal (ledger_events).
--   • audit_log and change_log refuse UPDATE / DELETE / TRUNCATE from app logins (trigger + revoked grants).
--
-- Undo: the _down file (it drops change_log and its rows).

begin;

-- ── SEC-09 ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.subscription_writable(p_sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  -- false = new vouchers are paused (mirrors plans.ts effectiveStatus 'expired'; GRACE_DAYS = 7)
  select not exists (
    select 1 from public.subscriptions s
     where s.society_id::text = p_sid
       and (s.status = 'expired' or (s.period_end is not null and now() >= s.period_end + interval '7 days'))
  );
$$;
revoke execute on function public.subscription_writable(text) from public, anon, authenticated;

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

  -- 184 / SEC-09: an expired subscription pauses NEW vouchers on the server too (plans.ts effectiveStatus).
  if not public.subscription_writable(v_sid) then raise exception 'post_voucher:subscription_expired'; end if;
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

  -- 184 / SEC-09: an expired subscription pauses NEW vouchers on the server too (plans.ts effectiveStatus).
  if not public.subscription_writable(v_sid) then raise exception 'post_voucher:subscription_expired'; end if;
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
revoke execute on function public.post_voucher(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_pending_voucher(jsonb, jsonb) to authenticated;
grant execute on function public.post_voucher(jsonb, jsonb, jsonb) to authenticated;

-- ── SEC-08 ────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.change_log (
  id          uuid primary key default gen_random_uuid(),
  society_id  text,
  table_name  text not null,
  row_id      text,
  op          text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  actor_email text,
  actor_role  text,
  changed     text[],
  before      jsonb,
  after       jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists change_log_society_time on public.change_log (society_id, occurred_at desc);
create index if not exists change_log_row on public.change_log (table_name, row_id);
alter table public.change_log enable row level security;
revoke all on table public.change_log from public, anon, authenticated;
grant select on table public.change_log to authenticated;
drop policy if exists change_log_tenant_select on public.change_log;
create policy change_log_tenant_select on public.change_log for select to authenticated
  using (society_id = public.get_current_society_id());

create or replace function public._change_log_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_new     jsonb;
  v_old     jsonb;
  v_row     jsonb;
  v_changed text[];
  v_before  jsonb;
  v_after   jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_after := v_new;
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old); v_before := v_old;
  else
    v_new := to_jsonb(new); v_old := to_jsonb(old);
    select array_agg(k order by k), jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into v_changed, v_before, v_after
      from jsonb_object_keys(v_new) as t(k)
     where k not in ('updated_at', 'updatedAt') and (v_new -> k) is distinct from (v_old -> k);
    if v_changed is null then return null; end if;   -- nothing changed (an unchanged upsert)
  end if;
  v_row := coalesce(v_new, v_old);
  insert into public.change_log (society_id, table_name, row_id, op, actor_email, actor_role, changed, before, after)
  values (v_row ->> 'society_id', tg_table_name, v_row ->> 'id', tg_op,
          lower(nullif(auth.jwt() ->> 'email', '')), nullif(auth.jwt() ->> 'user_role', ''),
          v_changed, v_before, v_after);
  return null;
end
$$;
revoke execute on function public._change_log_row() from public, anon, authenticated;

do $sec08$
declare
  excl text[] := array['audit_log', 'change_log', 'data_fix_log', 'error_log', 'account_reclass_log', 'account_seed_log', 'ledger_events', 'feedback', 'leads', 'notification_outbox', 'orders', 'invoices', 'subscriptions', 'referral_attributions', 'referral_attribution_events', 'partner_commissions', 'document_sequences', 'procurement_jform_counters', 'procurement_settlement_counters', 'society_flags', 'restore_staging', 'member_portal_users'];
  t text;
  n int := 0;
begin
  for t in
    select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relkind in ('r', 'p') and not (c.relname = any(excl))
       and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'society_id' and not a.attisdropped)
     order by c.relname
  loop
    execute format('drop trigger if exists change_log_row on public.%I', t);
    execute format('create trigger change_log_row after insert or update or delete on public.%I for each row '
                   'when (current_user = ''authenticated'') execute function public._change_log_row()', t);
    n := n + 1;
  end loop;
  raise notice '184: change_log trigger on % tables', n;
end
$sec08$;

-- audit_log / change_log are append-only for app logins.
create or replace function public._refuse_log_rewrite() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'audit_log_append_only: % cannot be changed or deleted', tg_table_name using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;
revoke execute on function public._refuse_log_rewrite() from public, anon, authenticated;
drop trigger if exists refuse_rewrite on public.audit_log;
create trigger refuse_rewrite before update or delete on public.audit_log for each row execute function public._refuse_log_rewrite();
drop trigger if exists refuse_truncate on public.audit_log;
create trigger refuse_truncate before truncate on public.audit_log for each statement execute function public._refuse_log_rewrite();
drop trigger if exists refuse_rewrite on public.change_log;
create trigger refuse_rewrite before update or delete on public.change_log for each row execute function public._refuse_log_rewrite();
drop trigger if exists refuse_truncate on public.change_log;
create trigger refuse_truncate before truncate on public.change_log for each statement execute function public._refuse_log_rewrite();
revoke update, delete, truncate on table public.audit_log from anon, authenticated;

insert into public.app_migrations (version, name) values ('184', 'subscription_gate_and_change_log')
  on conflict (version) do nothing;

commit;

-- VERIFY (read-only):
--   select pg_get_functiondef('public.post_voucher(jsonb,jsonb,jsonb)'::regprocedure) ~ 'subscription_expired';   -- true
--   select count(*) from pg_trigger where tgname = 'change_log_row';                                             -- the tables
--   select has_table_privilege('authenticated', 'public.audit_log', 'delete');                                  -- false
