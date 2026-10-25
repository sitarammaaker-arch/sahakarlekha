-- 141 · Hired-truck trips with freight + payment (2026-10-25, Marketing batch E2).
--
-- WHY: the transporter master (T1) led nowhere — a hired truck's freight was a manual journal.
-- WHAT:
--   • marketing_transporters."ledgerAccountId" — the transporter's own payable ledger (a creditor).
--     Written as a step-2 update (RULE 1), so the master saves before this runs.
--   • marketing_hired_trips — one hired trip: date, transporter, optional D3 dispatch, from / to,
--     quantity × rate = freight, the expense ledger, and its voucher (Dr freight expense / Cr the
--     transporter ledger). The row owns that voucher. Payments are plain vouchers (refType
--     hired.trip.payment, refId = trip) — paid / outstanding are derived from them.
-- RLS: society-scoped, role-split writes (as 128). Additive. Undo: 141_hired_trips_down.sql.

begin;

alter table public.marketing_transporters add column if not exists "ledgerAccountId" text;

create table if not exists public.marketing_hired_trips (
  id                 text primary key,
  society_id         text not null,
  jurisdiction       text,
  "tripNo"           text not null,
  date               text not null,
  "transporterId"    text not null,
  "dispatchId"       text,
  "vehicleNo"        text,
  "fromPlace"        text,
  "toPlace"          text,
  qty                numeric,
  rate               numeric,
  freight            numeric not null default 0,
  "expenseAccountId" text not null,
  "payableAccountId" text not null,
  "voucherId"        text,
  note               text,
  "isDeleted"        boolean not null default false,
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now()
);
create index if not exists idx_marketing_hired_trips_society on public.marketing_hired_trips (society_id);

do $$
declare t text := 'marketing_hired_trips';
begin
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('drop policy if exists %I on public.%I', t || '_update', t);
  execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  execute format('create policy %I on public.%I for select to authenticated using (society_id::text in (select public.current_user_society_ids()))', t || '_select', t);
  execute format('create policy %I on public.%I for insert to authenticated with check (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write())', t || '_insert', t);
  execute format('create policy %I on public.%I for update to authenticated using (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write()) with check (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write())', t || '_update', t);
  execute format('create policy %I on public.%I for delete to authenticated using (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_delete())', t || '_delete', t);
end $$;

insert into public.app_migrations (version, name) values ('141', 'hired_trips')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
