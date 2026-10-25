-- 136 · Agency ledger, commission basis, 5116 route (2026-10-25, Marketing batch D1).
--
-- WHY: real marketing societies (prod, read-only 2026-10-25) keep each procurement agency in its OWN
-- receivable ledger (e.g. "HSWC Sirsa"), not the pooled 3308 MSP Receivable; earn dami per QUINTAL
-- (₹55/qtl), booked to 4205 Society Commission; and pass each purchase through 5116 Govt Procurement
-- Purchase (Dr 5116 / Cr 2105 + Dr agency / Cr 5116 — 5116 nets to nil, the turnover stays visible).
--
-- WHAT:
--   • procurement_agencies."ledgerAccountId"            — the agency's own receivable ledger (null = 3308)
--   • procurement_agencies."commissionBasis"            — 'percent' (default) | 'perQtl'
--   • procurement_agencies."commissionIncomeAccountId"  — income ledger for its commission (null = 4206)
--   • society_settings."procurementVia5116"             — post each lot through 5116 (default off)
-- The app writes all four in step-2 updates, so masters and settings keep saving before this runs.
-- No RLS change (existing table policies). Additive. Undo: 136_procurement_agency_ledger_down.sql.

begin;

alter table public.procurement_agencies add column if not exists "ledgerAccountId" text;
alter table public.procurement_agencies add column if not exists "commissionBasis" text;
alter table public.procurement_agencies add column if not exists "commissionIncomeAccountId" text;
alter table public.society_settings add column if not exists "procurementVia5116" boolean default false;

insert into public.app_migrations (version, name) values ('136', 'procurement_agency_ledger')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
