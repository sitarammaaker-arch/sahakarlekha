-- Undo 196 · writes the PII back from party_identity into the party columns (where they are empty). party_identity
-- itself is kept (it is 195's table).
begin;
update public.customers c set pan = coalesce(nullif(c.pan, ''), p.fields->>'pan'), "bankName" = coalesce(nullif(c."bankName", ''), p.fields->>'bankName'),
       "accountNo" = coalesce(nullif(c."accountNo", ''), p.fields->>'accountNo'), ifsc = coalesce(nullif(c.ifsc, ''), p.fields->>'ifsc')
  from public.party_identity p where p.entity_type = 'customer' and p.entity_id = c.id::text and p.society_id = c.society_id::text;
update public.suppliers s set pan = coalesce(nullif(s.pan, ''), p.fields->>'pan'), "bankName" = coalesce(nullif(s."bankName", ''), p.fields->>'bankName'),
       "accountNo" = coalesce(nullif(s."accountNo", ''), p.fields->>'accountNo'), ifsc = coalesce(nullif(s.ifsc, ''), p.fields->>'ifsc')
  from public.party_identity p where p.entity_type = 'supplier' and p.entity_id = s.id::text and p.society_id = s.society_id::text;
update public.procurement_farmers f set "bankName" = coalesce(nullif(f."bankName", ''), p.fields->>'bankName'),
       "bankAccountNo" = coalesce(nullif(f."bankAccountNo", ''), p.fields->>'bankAccountNo'), ifsc = coalesce(nullif(f.ifsc, ''), p.fields->>'ifsc')
  from public.party_identity p where p.entity_type = 'farmer' and p.entity_id = f.id::text and p.society_id = f.society_id::text;
update public.employees e set pan = coalesce(nullif(e.pan, ''), p.fields->>'pan'), "bankAccount" = coalesce(nullif(e."bankAccount", ''), p.fields->>'bankAccount')
  from public.party_identity p where p.entity_type = 'employee' and p.entity_id = e.id::text and p.society_id = e.society_id::text;
update public.workers w set pan = coalesce(nullif(w.pan, ''), p.fields->>'pan'), aadhaar = coalesce(nullif(w.aadhaar, ''), p.fields->>'aadhaar'),
       "bankAccountNo" = coalesce(nullif(w."bankAccountNo", ''), p.fields->>'bankAccountNo'), ifsc = coalesce(nullif(w.ifsc, ''), p.fields->>'ifsc')
  from public.party_identity p where p.entity_type = 'worker' and p.entity_id = w.id::text and p.society_id = w.society_id::text;
delete from public.app_migrations where version = '196';
commit;
