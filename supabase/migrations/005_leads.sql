-- ============================================================
-- SahakarLekha — Leads / email subscribers (Phase S1). Run in Supabase SQL Editor.
--
-- Captured when a visitor downloads a lead magnet (e.g. the audit checklist).
-- RLS: anyone may INSERT (public opt-in); NO public SELECT, so emails are never
-- anon-readable — view them in the Supabase Table editor (postgres) or via a
-- future admin RPC. `marketing_consent` records explicit opt-in (DPDP-friendly).
-- ============================================================

create table if not exists leads (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  email              text not null,
  name               text,
  source             text,          -- e.g. 'audit-checklist'
  society_type       text,
  marketing_consent  boolean not null default false,
  page_url           text
);

alter table leads enable row level security;

drop policy if exists leads_insert on leads;
create policy leads_insert on leads
  for insert with check (true);

-- (No SELECT/UPDATE policy on purpose — PII stays unreadable by anon.)

create index if not exists idx_leads_created on leads(created_at desc);
create index if not exists idx_leads_email   on leads(email);

-- View leads (as postgres, in SQL editor):
--   select created_at, email, name, source, marketing_consent from leads order by created_at desc;
