-- 196 · DB-09 phase 2 — blank the legacy PII columns on the party tables (the 122 step for members).
--
-- RUN ONLY AFTER: 195 has been run AND the app from the same PR is live (it reads party_identity and never writes
-- PII to the party rows again). Before that, blanking would hide the values from the screens.
-- Any party still without a party_identity row is copied first (an existing row is authoritative). Then the
-- party columns are emptied, so roles outside jwt_can_read_party_pii() can no longer read them.
-- Undo: 196_party_pii_blank_down.sql (writes the values back from party_identity).
begin;

-- 1. last copy — ONLY for a party that has no party_identity row yet. A row that exists is authoritative: a value the
--    app cleared there (PAN removed after 195) must not come back from the stale legacy column.
insert into public.party_identity (society_id, entity_type, entity_id, fields)
select c.society_id::text, 'customer', c.id::text, jsonb_strip_nulls(jsonb_build_object('pan', nullif(c.pan, ''), 'bankName', nullif(c."bankName", ''), 'accountNo', nullif(c."accountNo", ''), 'ifsc', nullif(c.ifsc, '')))
  from public.customers c where coalesce(c.pan, '') <> '' or coalesce(c."bankName", '') <> '' or coalesce(c."accountNo", '') <> '' or coalesce(c.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do nothing;
insert into public.party_identity (society_id, entity_type, entity_id, fields)
select s.society_id::text, 'supplier', s.id::text, jsonb_strip_nulls(jsonb_build_object('pan', nullif(s.pan, ''), 'bankName', nullif(s."bankName", ''), 'accountNo', nullif(s."accountNo", ''), 'ifsc', nullif(s.ifsc, '')))
  from public.suppliers s where coalesce(s.pan, '') <> '' or coalesce(s."bankName", '') <> '' or coalesce(s."accountNo", '') <> '' or coalesce(s.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do nothing;
insert into public.party_identity (society_id, entity_type, entity_id, fields)
select f.society_id::text, 'farmer', f.id::text, jsonb_strip_nulls(jsonb_build_object('bankName', nullif(f."bankName", ''), 'bankAccountNo', nullif(f."bankAccountNo", ''), 'ifsc', nullif(f.ifsc, '')))
  from public.procurement_farmers f where coalesce(f."bankName", '') <> '' or coalesce(f."bankAccountNo", '') <> '' or coalesce(f.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do nothing;
insert into public.party_identity (society_id, entity_type, entity_id, fields)
select e.society_id::text, 'employee', e.id::text, jsonb_strip_nulls(jsonb_build_object('pan', nullif(e.pan, ''), 'bankAccount', nullif(e."bankAccount", '')))
  from public.employees e where coalesce(e.pan, '') <> '' or coalesce(e."bankAccount", '') <> ''
on conflict (society_id, entity_type, entity_id) do nothing;
insert into public.party_identity (society_id, entity_type, entity_id, fields)
select w.society_id::text, 'worker', w.id::text, jsonb_strip_nulls(jsonb_build_object('pan', nullif(w.pan, ''), 'aadhaar', nullif(w.aadhaar, ''), 'bankAccountNo', nullif(w."bankAccountNo", ''), 'ifsc', nullif(w.ifsc, '')))
  from public.workers w where coalesce(w.pan, '') <> '' or coalesce(w.aadhaar, '') <> '' or coalesce(w."bankAccountNo", '') <> '' or coalesce(w.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do nothing;

-- 2. blank the party columns
update public.customers set pan = null, "bankName" = null, "accountNo" = null, ifsc = null
 where coalesce(pan, '') <> '' or coalesce("bankName", '') <> '' or coalesce("accountNo", '') <> '' or coalesce(ifsc, '') <> '';
update public.suppliers set pan = null, "bankName" = null, "accountNo" = null, ifsc = null
 where coalesce(pan, '') <> '' or coalesce("bankName", '') <> '' or coalesce("accountNo", '') <> '' or coalesce(ifsc, '') <> '';
update public.procurement_farmers set "bankName" = null, "bankAccountNo" = null, ifsc = null
 where coalesce("bankName", '') <> '' or coalesce("bankAccountNo", '') <> '' or coalesce(ifsc, '') <> '';
update public.employees set pan = null, "bankAccount" = null
 where coalesce(pan, '') <> '' or coalesce("bankAccount", '') <> '';
update public.workers set pan = null, aadhaar = null, "bankAccountNo" = null, ifsc = null
 where coalesce(pan, '') <> '' or coalesce(aadhaar, '') <> '' or coalesce("bankAccountNo", '') <> '' or coalesce(ifsc, '') <> '';

insert into public.app_migrations (version, name) values ('196', 'party_pii_blank')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect every count = 0 | mig = 1):
--   select (select count(*) from public.customers where coalesce(pan,'')<>'' or coalesce("accountNo",'')<>'') as cust,
--          (select count(*) from public.suppliers where coalesce(pan,'')<>'' or coalesce("accountNo",'')<>'') as supp,
--          (select count(*) from public.employees where coalesce(pan,'')<>'' or coalesce("bankAccount",'')<>'') as emp,
--          (select count(*) from public.workers where coalesce(pan,'')<>'' or coalesce(aadhaar,'')<>'') as wrk,
--          (select count(*) from public.procurement_farmers where coalesce("bankAccountNo",'')<>'') as farm,
--          (select count(*) from public.app_migrations where version = '196') as mig;
