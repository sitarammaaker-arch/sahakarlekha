-- 077 · post_voucher — ONE atomic, server-checked voucher posting (Phase-3 S3-a, approved 2026-09-29).
--
-- WHY: today a voucher save is 3–4 separate client calls (vouchers row, voucher_entries, journal
-- event). A dropped connection between them leaves a half-saved voucher — e.g. Assandh's vouchers
-- without journal postings. post_voucher writes the vouchers row, its voucher_lines, its
-- voucher_entries and its voucher.posted journal event in ONE transaction: all or nothing.
--
-- DESIGN (decisions 2026-09-29): a SQL function (A); the posting RULE stays in the app (RULE 2) —
-- the client sends the voucher, its legs (built by getVoucherLines) and the event (built by
-- buildEvent / voucherPostingLines); the SERVER decides the society and enforces the invariants:
--   • society = get_current_society_id() from the JWT — never from the payload
--   • role claim REQUIRED (fail-CLOSED, unlike the RLS helpers) and jwt_can_write()
--   • society not FY-locked; voucher date after the period lock
--   • the date lies in an OPEN financial year of that society (→ voucher_lines.fy_id)
--   • ≥ 2 legs, amounts ≥ 0 paise, ΣDr = ΣCr > 0, and ΣDr equals the voucher's own total
--   • every account belongs to the society (composite FK on voucher_lines)
--   • the event is voucher.posted, sequence 1, for this voucher, and its lines equal the legs
--   • idempotent: the same voucher id again → returns the existing voucher (retry / double-click)
-- Posted (non-pending) vouchers only in this slice; edit / cancel / approval come in S3-d.
--
-- ALSO: public.society_flags (society_id → posting_service) — the per-society switch the app reads
-- (decision 4: a new table, not a society_settings column). Default off; set by SQL for the pilot.
--
-- ADDITIVE ONLY: one new table, one new function; no existing row changes; nothing calls the
-- function until the app is wired (S3-b) and a society's flag is on. Requires 072, 073, 076.
-- Reversible: 077_post_voucher_down.sql.

begin;

create table if not exists public.society_flags (
  society_id       text primary key,
  posting_service  boolean not null default false,
  updated_at       timestamptz not null default now(),
  updated_by       text
);
alter table public.society_flags enable row level security;
drop policy if exists society_flags_tenant_select on public.society_flags;
create policy society_flags_tenant_select on public.society_flags
  for select using (society_id::text = get_current_society_id());
revoke insert, update, delete, truncate on public.society_flags from anon, authenticated;
grant select on public.society_flags to authenticated;

create or replace function public.post_voucher(p_voucher jsonb, p_lines jsonb, p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  where f.society_id = v_sid and f.status = 'open' and v_date between f.start_date and f.end_date;
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
$$;

revoke all on function public.post_voucher(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.post_voucher(jsonb, jsonb, jsonb) to authenticated;

comment on function public.post_voucher(jsonb, jsonb, jsonb) is
  'S3-a: atomic, server-checked posting of one voucher (row + voucher_lines + voucher_entries + voucher.posted event).';

insert into public.app_migrations (version, name) values ('077', 'post_voucher')
  on conflict (version) do nothing;

commit;
