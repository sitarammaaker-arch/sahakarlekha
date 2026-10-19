-- ============================================================
-- SahakarLekha — Transport operations, slice 1: vehicles, trips, vehicle expenses.
-- Run ONCE in Supabase SQL Editor.
--
-- Why: a transport cooperative (SocietyType 'transport', and the transport activity of a
-- multipurpose / CM-PACS society) runs its OWN vehicles. The existing /transport page is only a
-- hired-transporter master for marketing societies. These three tables hold:
--   transport_vehicles          — vehicle master (reg. no., type, capacity, document expiry dates,
--                                 optional link to the Asset Register row)
--   transport_trips             — a freight trip; posts ONE journal voucher
--                                 (Dr customer / Cr 4501 Freight [+ 4503 loading, 4504 detention])
--   transport_vehicle_expenses  — a vehicle running cost; posts ONE payment voucher
--                                 (Dr 57xx / Cr cash-bank)
--
-- The VOUCHER stays the authority for money. The document row only says which vehicle a voucher
-- belongs to (voucher.refType 'transport.trip' / 'transport.expense', voucher.refId = row id), so
-- the vehicle-wise profit report reads voucher lines, never these amounts. No voucher column and no
-- posting RPC changes: post_voucher (096) already stores refType / refId.
--
-- Tenant RLS like member_identity (106) / marketing_transporters: own society only; writes need
-- jwt_can_write(), deletes jwt_can_delete(). No permissive policy. `jurisdiction` is stamped by the
-- app on every row (T-01), like every other domain table.
-- ============================================================

begin;

create table if not exists public.transport_vehicles (
  id                text primary key,
  society_id        text not null,
  jurisdiction      text,
  "regNo"           text not null,
  "vehicleType"     text not null default 'truck',
  capacity          text,
  "assetId"         text,
  "insuranceExpiry" text,
  "permitExpiry"    text,
  "fitnessExpiry"   text,
  "pucExpiry"       text,
  status            text not null default 'active' check (status in ('active', 'inactive')),
  remarks           text,
  "isDeleted"       boolean not null default false,
  "createdAt"       timestamptz not null default now()
);
create index if not exists idx_transport_vehicles_society on public.transport_vehicles (society_id);

create table if not exists public.transport_trips (
  id            text primary key,
  society_id    text not null,
  jurisdiction  text,
  "tripNo"      text not null,
  date          text not null,
  "vehicleId"   text not null,
  "customerId"  text not null,
  "fromPlace"   text,
  "toPlace"     text,
  freight       numeric not null default 0,
  loading       numeric,
  detention     numeric,
  amount        numeric not null default 0,
  "paidAmount"  numeric not null default 0,
  status        text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid')),
  "voucherId"   text,
  "collectionVoucherIds" jsonb not null default '[]',
  narration     text,
  "isDeleted"   boolean not null default false,
  "createdAt"   timestamptz not null default now()
);
create index if not exists idx_transport_trips_society on public.transport_trips (society_id);

create table if not exists public.transport_vehicle_expenses (
  id              text primary key,
  society_id      text not null,
  jurisdiction    text,
  "expenseNo"     text not null,
  date            text not null,
  "vehicleId"     text not null,
  "accountId"     text not null,
  amount          numeric not null default 0,
  mode            text not null default 'cash' check (mode in ('cash', 'bank')),
  "bankAccountId" text,
  "voucherId"     text,
  narration       text,
  "isDeleted"     boolean not null default false,
  "createdAt"     timestamptz not null default now()
);
create index if not exists idx_transport_vehicle_expenses_society on public.transport_vehicle_expenses (society_id);

do $$
declare t text;
begin
  foreach t in array array['transport_vehicles', 'transport_trips', 'transport_vehicle_expenses'] loop
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

insert into public.app_migrations (version, name) values ('128', 'transport_operations')
  on conflict (version) do nothing;

commit;

-- ── Verify (run after) ──
-- Expect 3 rows, each: rls = true, policies = 4, permissive = 0
--   select c.relname, c.relrowsecurity as rls,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies,
--          (select count(*) from pg_policies p where p.tablename = c.relname
--             and (coalesce(p.qual, '') = 'true' or coalesce(p.with_check, '') = 'true')) as permissive
--   from pg_class c
--   where c.relname in ('transport_vehicles', 'transport_trips', 'transport_vehicle_expenses')
--   order by c.relname;
