-- 137 · Arhtiya master, weighment + bags on lots, per-unit deduction rules, bardana register
--       (2026-10-25, Marketing batch D2a). Founder: arhtiya dami and bardana are REGISTERS only —
--       no ledger posting in this batch.
--
-- WHAT:
--   • procurement_arhtiyas            — commission-agent master (licence, mobile, dami rate + basis).
--   • procurement_bardana_movements   — gunny-bag count register: in/out per party (agency / farmer /
--                                        arhtiya / other), optional lot, bags.
--   • procurement_lots."grossWeight" / "tareWeight" / bags — the weighment slip (qtl). Written in a
--     step-2 update after the frozen commit RPC (which already writes "arhtiyaId").
--   • procurement_deduction_rules."basisUnit" — 'percent' (default) | 'perQtl' | 'perBag'.
-- RLS: society-scoped, writes/deletes role-split (same as migration 128). Additive.
-- Undo: 137_procurement_arhtiya_bardana_down.sql.

begin;

create table if not exists public.procurement_arhtiyas (
  id            text primary key,
  society_id    text not null,
  jurisdiction  text,
  name          text not null,
  "nameHi"      text,
  "licenceNo"   text,
  mobile        text,
  "damiRate"    numeric,
  "damiBasis"   text check ("damiBasis" is null or "damiBasis" in ('percent', 'perQtl')),
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index if not exists idx_procurement_arhtiyas_society on public.procurement_arhtiyas (society_id);

create table if not exists public.procurement_bardana_movements (
  id              text primary key,
  society_id      text not null,
  jurisdiction    text,
  date            text not null,
  "bardanaTypeId" text,
  direction       text not null check (direction in ('in', 'out')),
  "partyType"     text not null check ("partyType" in ('agency', 'farmer', 'arhtiya', 'other')),
  "partyId"       text,
  "partyName"     text,
  "lotId"         text,
  bags            integer not null check (bags > 0),
  note            text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create index if not exists idx_procurement_bardana_movements_society on public.procurement_bardana_movements (society_id);

do $$
declare t text;
begin
  foreach t in array array['procurement_arhtiyas', 'procurement_bardana_movements'] loop
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

alter table public.procurement_lots add column if not exists "grossWeight" numeric;
alter table public.procurement_lots add column if not exists "tareWeight" numeric;
alter table public.procurement_lots add column if not exists bags integer;
alter table public.procurement_deduction_rules add column if not exists "basisUnit" text;

insert into public.app_migrations (version, name) values ('137', 'procurement_arhtiya_bardana')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
