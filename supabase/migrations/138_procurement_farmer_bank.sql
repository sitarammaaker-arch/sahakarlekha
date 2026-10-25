-- 138 · Farmer bank details, village and state-portal id (2026-10-25, Marketing batch D2b).
--
-- WHY: farmer payments go by bank transfer (often a batch RTGS/NEFT), and agencies that pay farmers
-- directly key them by the state procurement-portal registration. The farmer master had only name /
-- father / mobile, and no edit.
-- WHAT: procurement_farmers."village", "bankName", "bankAccountNo", "ifsc", "portalId" (all text).
-- The app writes them in a step-2 update (RULE 1), so farmer entry works before this runs.
-- No RLS change (existing policy). Additive. Undo: 138_procurement_farmer_bank_down.sql.

begin;

alter table public.procurement_farmers add column if not exists village text;
alter table public.procurement_farmers add column if not exists "bankName" text;
alter table public.procurement_farmers add column if not exists "bankAccountNo" text;
alter table public.procurement_farmers add column if not exists ifsc text;
alter table public.procurement_farmers add column if not exists "portalId" text;

insert into public.app_migrations (version, name) values ('138', 'procurement_farmer_bank')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
