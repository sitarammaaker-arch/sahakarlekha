-- Undo 195 · removes party_identity. SAFE ONLY BEFORE 196 has blanked the legacy columns. After 196 the values exist
-- ONLY here, so copy them back first, e.g. for customers:
--   update public.customers c set pan = coalesce(nullif(c.pan,''), p.fields->>'pan'), "bankName" = coalesce(nullif(c."bankName",''), p.fields->>'bankName'),
--          "accountNo" = coalesce(nullif(c."accountNo",''), p.fields->>'accountNo'), ifsc = coalesce(nullif(c.ifsc,''), p.fields->>'ifsc')
--     from public.party_identity p where p.entity_type = 'customer' and p.entity_id = c.id::text and p.society_id = c.society_id::text;
--   (and the same for suppliers, procurement_farmers, employees, workers) — 196_down does exactly this.
begin;
delete from public.restore_tables where table_name = 'party_identity';
drop table if exists public.party_identity;
drop function if exists public.jwt_can_read_party_pii(text);
delete from public.app_migrations where version = '195';
commit;
notify pgrst, 'reload schema';
