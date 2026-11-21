-- 195 · DB-09 (product audit 2026-11-17) — PAN / Aadhaar / bank details of customers, suppliers, farmers, employees
-- and workers move behind a role-scoped table, the same way members' PII did (106 member_identity → 122 blank).
--
-- WHY: these columns sit on the party tables, and every role of the society can read them through the tenant-wide
-- SELECT policies: viewer, cashier, dataEntry, boardMember and the rest. On 2026-11-21 prod held 7 employee PANs and
-- 7 employee bank accounts, 35 customer PANs and 2 customer bank accounts, and 1 supplier PAN plus 1 supplier bank
-- account. Farmers and workers had none yet.
--
-- WHAT (additive, nothing removed here):
--   • party_identity(society_id, entity_type, entity_id, fields jsonb). `fields` holds exactly the property names the
--     app uses on that entity:
--       customer / supplier → pan, bankName, accountNo, ifsc
--       farmer              → bankName, bankAccountNo, ifsc
--       employee            → pan, bankAccount
--       worker              → pan, aadhaar, bankAccountNo, ifsc
--   • READ / WRITE: jwt_can_read_pii() — admin, societyAdmin, accountant, secretary, manager, the same five roles as
--     member_identity. A procurementOfficer may also read and write a FARMER's row, because farmer payments need
--     the bank details. DELETE: jwt_can_delete().
--   • The existing values are copied in, and party_identity joins the restore allowlist (restore_tables).
--   • The app finds this table at load (src/lib/partyIdentity.ts). It overlays the values for roles allowed to see
--     them, strips them for everyone else, and saves new values here, never on the party row.
-- The legacy columns are blanked by 196, run only AFTER this PR's app is live (same order as 106 → 122).
-- Undo: 195_party_identity_down.sql.
begin;

create table if not exists public.party_identity (
  society_id  text not null,
  entity_type text not null check (entity_type in ('customer', 'supplier', 'farmer', 'employee', 'worker')),
  entity_id   text not null,
  fields      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (society_id, entity_type, entity_id)
);
alter table public.party_identity enable row level security;
-- Explicit, not left to project default privileges: signed-in users go through the policies below; anon gets nothing.
revoke all on public.party_identity from public, anon;
grant select, insert, update, delete on public.party_identity to authenticated;
grant all on public.party_identity to service_role;

create or replace function public.jwt_can_read_party_pii(p_entity_type text) returns boolean
  language sql stable set search_path to 'public'
as $$
  select public.jwt_can_read_pii()
      or (p_entity_type = 'farmer' and coalesce(auth.jwt() ->> 'user_role', '') = 'procurementOfficer');
$$;
revoke execute on function public.jwt_can_read_party_pii(text) from public, anon;
grant execute on function public.jwt_can_read_party_pii(text) to authenticated;

drop policy if exists pi_select on public.party_identity;
create policy pi_select on public.party_identity for select
  using (society_id in (select current_user_society_ids()) and jwt_can_read_party_pii(entity_type));
drop policy if exists pi_insert on public.party_identity;
create policy pi_insert on public.party_identity for insert
  with check (society_id in (select current_user_society_ids()) and jwt_can_read_party_pii(entity_type));
drop policy if exists pi_update on public.party_identity;
create policy pi_update on public.party_identity for update
  using (society_id in (select current_user_society_ids()) and jwt_can_read_party_pii(entity_type))
  with check (society_id in (select current_user_society_ids()) and jwt_can_read_party_pii(entity_type));
drop policy if exists pi_delete on public.party_identity;
create policy pi_delete on public.party_identity for delete
  using (society_id in (select current_user_society_ids()) and jwt_can_delete());

-- ── copy what exists today (only non-empty values; a party with none gets no row) ──
insert into public.party_identity (society_id, entity_type, entity_id, fields)
select c.society_id::text, 'customer', c.id::text, jsonb_strip_nulls(jsonb_build_object(
         'pan', nullif(c.pan, ''), 'bankName', nullif(c."bankName", ''), 'accountNo', nullif(c."accountNo", ''), 'ifsc', nullif(c.ifsc, '')))
  from public.customers c
 where coalesce(c.pan, '') <> '' or coalesce(c."bankName", '') <> '' or coalesce(c."accountNo", '') <> '' or coalesce(c.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do update set fields = party_identity.fields || excluded.fields, updated_at = now();

insert into public.party_identity (society_id, entity_type, entity_id, fields)
select s.society_id::text, 'supplier', s.id::text, jsonb_strip_nulls(jsonb_build_object(
         'pan', nullif(s.pan, ''), 'bankName', nullif(s."bankName", ''), 'accountNo', nullif(s."accountNo", ''), 'ifsc', nullif(s.ifsc, '')))
  from public.suppliers s
 where coalesce(s.pan, '') <> '' or coalesce(s."bankName", '') <> '' or coalesce(s."accountNo", '') <> '' or coalesce(s.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do update set fields = party_identity.fields || excluded.fields, updated_at = now();

insert into public.party_identity (society_id, entity_type, entity_id, fields)
select f.society_id::text, 'farmer', f.id::text, jsonb_strip_nulls(jsonb_build_object(
         'bankName', nullif(f."bankName", ''), 'bankAccountNo', nullif(f."bankAccountNo", ''), 'ifsc', nullif(f.ifsc, '')))
  from public.procurement_farmers f
 where coalesce(f."bankName", '') <> '' or coalesce(f."bankAccountNo", '') <> '' or coalesce(f.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do update set fields = party_identity.fields || excluded.fields, updated_at = now();

insert into public.party_identity (society_id, entity_type, entity_id, fields)
select e.society_id::text, 'employee', e.id::text, jsonb_strip_nulls(jsonb_build_object(
         'pan', nullif(e.pan, ''), 'bankAccount', nullif(e."bankAccount", '')))
  from public.employees e
 where coalesce(e.pan, '') <> '' or coalesce(e."bankAccount", '') <> ''
on conflict (society_id, entity_type, entity_id) do update set fields = party_identity.fields || excluded.fields, updated_at = now();

insert into public.party_identity (society_id, entity_type, entity_id, fields)
select w.society_id::text, 'worker', w.id::text, jsonb_strip_nulls(jsonb_build_object(
         'pan', nullif(w.pan, ''), 'aadhaar', nullif(w.aadhaar, ''), 'bankAccountNo', nullif(w."bankAccountNo", ''), 'ifsc', nullif(w.ifsc, '')))
  from public.workers w
 where coalesce(w.pan, '') <> '' or coalesce(w.aadhaar, '') <> '' or coalesce(w."bankAccountNo", '') <> '' or coalesce(w.ifsc, '') <> ''
on conflict (society_id, entity_type, entity_id) do update set fields = party_identity.fields || excluded.fields, updated_at = now();

-- The server restore (178) may write it back from a backup.
insert into public.restore_tables (table_name) values ('party_identity') on conflict do nothing;

insert into public.app_migrations (version, name) values ('195', 'party_identity')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tbl = true | rows = 47 or so (one per party with any value) | restorable = 1 | mig = 1):
--   select to_regclass('public.party_identity') is not null as tbl,
--          (select count(*) from public.party_identity) as rows,
--          (select count(*) from public.restore_tables where table_name = 'party_identity') as restorable,
--          (select count(*) from public.app_migrations where version = '195') as mig;
