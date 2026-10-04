-- 108 · Audit Certificate details persist per FY.
-- The Audit Certificate page's auditor name / reg. no. / address / dates / class / observations
-- were screen state only (lost on reload). They now live in society_settings."auditCertificates",
-- a jsonb map keyed by FY string: { "2025-26": { auditorName, auditDate, classification, ... } }.
-- Additive + idempotent; existing rows get NULL (= no saved certificate). No RLS change: the column
-- rides on the existing society_settings row and its existing policies.

begin;

alter table public.society_settings add column if not exists "auditCertificates" jsonb;

commit;

-- Ask PostgREST to reload its schema cache so the client can write the column immediately.
notify pgrst, 'reload schema';
