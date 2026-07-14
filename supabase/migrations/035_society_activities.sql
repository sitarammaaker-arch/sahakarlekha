-- 035 · T-10 (ADR-0003, gap BA-1) — the Activities layer: society_activities table (additive, dormant).
--
-- A society declares MANY business activities (a Multipurpose PACS runs credit + dairy + a fair-price
-- shop at once). Each row is one declared activity; the catalog of what can be declared, and the
-- activity→capability map, live in code (src/lib/navigation/activities.ts, activityCapabilities.ts).
-- The resolver (T-11) unions these into capabilities WITHIN entitlement.
--
-- ADDITIVE + DORMANT: nothing reads or writes this table until T-11/T-12, so running it changes NOTHING.
-- `jurisdiction` mirrors T-01; `config` is edge config (rate-chart refs etc.), the one legitimate JSONB.
-- Formalises the DDL that already lived in supabase-tables.sql into a numbered, deployable migration
-- (byte-for-byte identical, idempotent). Reversible via _down (safe to drop — no consumer yet).
--
-- NOTE: this ships with the placeholder `allow_all` RLS policy (as the master file has it) because the
-- table is dormant; proper (society_id, jurisdiction) tenant-isolation lands with T-11 when it goes live.

create table if not exists society_activities (
  id           text primary key,
  society_id   text not null default 'SOC001',
  jurisdiction text,
  activity     text not null,                     -- Activity code (see activities.ts)
  status       text not null default 'active',    -- active | paused | retired
  enabled_at   timestamptz not null default now(),
  disabled_at  timestamptz,
  config       jsonb default '{}',
  "isDeleted"  boolean default false,
  unique (society_id, activity)
);
alter table society_activities enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='society_activities' and policyname='allow_all') then
    create policy "allow_all" on society_activities for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_society_activities_society on society_activities(society_id);
