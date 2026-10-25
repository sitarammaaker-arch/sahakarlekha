-- 139 · Agency dispatch (lifting) + shortage, agency bills (2026-10-25, Marketing batch D3).
--
-- Founder 2026-10-25: shortage is POSTED (Dr shortage ledger / Cr agency receivable, at the dispatch's
-- average MSP rate); an agency bill's incidentals are POSTED on approval (Dr agency receivable / Cr each
-- line's ledger). The voucher is the money record; these rows own it (cancel only through them).
--
-- WHAT:
--   • procurement_dispatches — truck dispatch to the agency: lots, quantity / value / bags, vehicle,
--     transporter, destination; on acceptance the accepted quantity, shortage and its voucher.
--   • procurement_agency_bills — bill to the agency: dispatches covered, accepted qty, MSP value (shown,
--     already booked), incidental lines (label, unit, rate, amount, ledger), totals, its voucher.
-- RLS: society-scoped, writes / deletes role-split (as migration 128). Additive.
-- Undo: 139_procurement_dispatch_bills_down.sql.

begin;

create table if not exists public.procurement_dispatches (
  id                  text primary key,
  society_id          text not null,
  jurisdiction        text,
  "dispatchNo"        text not null,
  date                text not null,
  "agencyId"          text not null,
  "lotIds"            jsonb not null default '[]',
  "vehicleNo"         text,
  "transporterId"     text,
  destination         text,
  "dispatchedQty"     numeric not null default 0,
  "dispatchedValue"   numeric not null default 0,
  bags                integer,
  "acceptedQty"       numeric,
  "acceptedDate"      text,
  "shortageQty"       numeric,
  "shortageValue"     numeric,
  "shortageAccountId" text,
  "shortageVoucherId" text,
  status              text not null default 'dispatched' check (status in ('dispatched', 'accepted')),
  note                text,
  "isDeleted"         boolean not null default false,
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);
create index if not exists idx_procurement_dispatches_society on public.procurement_dispatches (society_id);

create table if not exists public.procurement_agency_bills (
  id                 text primary key,
  society_id         text not null,
  jurisdiction       text,
  "billNo"           text not null,
  date               text not null,
  "agencyId"         text not null,
  "dispatchIds"      jsonb not null default '[]',
  qty                numeric not null default 0,
  "mspValue"         numeric not null default 0,
  lines              jsonb not null default '[]',
  "incidentalTotal"  numeric not null default 0,
  total              numeric not null default 0,
  "voucherId"        text,
  status             text not null default 'draft' check (status in ('draft', 'approved')),
  note               text,
  "isDeleted"        boolean not null default false,
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now()
);
create index if not exists idx_procurement_agency_bills_society on public.procurement_agency_bills (society_id);

do $$
declare t text;
begin
  foreach t in array array['procurement_dispatches', 'procurement_agency_bills'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (society_id::text in (select public.current_user_society_ids()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write()) with check (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_delete())', t || '_delete', t);
  end loop;
end $$;

insert into public.app_migrations (version, name) values ('139', 'procurement_dispatch_bills')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
