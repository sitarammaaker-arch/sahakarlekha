-- 108 undo · drops society_settings."auditCertificates" (saved certificate details are LOST —
-- export them first if any society has saved one).

begin;

alter table public.society_settings drop column if exists "auditCertificates";

commit;

notify pgrst, 'reload schema';
