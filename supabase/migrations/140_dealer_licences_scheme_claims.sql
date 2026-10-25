-- 140 · Dealer licences (FCO authorisation + Form O) and scheme-claim register (2026-10-25, Marketing E1).
--
-- WHY: a society selling fertiliser must hold an authorisation letter under the Fertiliser (Control)
-- Order 1985 — Memorandum of Intimation in Form A1 with a certificate of source in Form O, one per
-- source (cl. 8); valid three years (cl. 10); a renewal filed more than one month after expiry is too
-- late and the letter lapses (cl. 11(3),(5)). The fertiliser SUBSIDY itself goes to the manufacturer
-- under DBT, not to the dealer — so instead of a "fertiliser subsidy claim", a GENERAL scheme-claim
-- register (founder 2026-10-25) records any state / central scheme amount the society claims
-- (seed subsidy, handling margin …): claim Dr receivable (3305) / Cr the society's chosen ledger;
-- money received Dr bank / Cr the receivable. The claim row owns its claim voucher.
--
-- WHAT: marketing_dealer_licences, marketing_scheme_claims. RLS role-split (as 128). Additive.
-- Undo: 140_dealer_licences_scheme_claims_down.sql.

begin;

create table if not exists public.marketing_dealer_licences (
  id              text primary key,
  society_id      text not null,
  jurisdiction    text,
  kind            text not null check (kind in ('authorisation', 'sourceCertificate')),
  "productGroup"  text,
  "licenceNo"     text,
  authority       text,
  "issuedOn"      text,
  "validUpto"     text,
  "supplierId"    text,
  "sourceName"    text,
  note            text,
  "isDeleted"     boolean not null default false,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create index if not exists idx_marketing_dealer_licences_society on public.marketing_dealer_licences (society_id);

create table if not exists public.marketing_scheme_claims (
  id                    text primary key,
  society_id            text not null,
  jurisdiction          text,
  "claimNo"             text not null,
  date                  text not null,
  "schemeName"          text not null,
  authority             text,
  period                text,
  amount                numeric not null default 0,
  "creditAccountId"     text not null,
  "receivableAccountId" text not null,
  "voucherId"           text,
  note                  text,
  "isDeleted"           boolean not null default false,
  "createdAt"           timestamptz not null default now(),
  "updatedAt"           timestamptz not null default now()
);
create index if not exists idx_marketing_scheme_claims_society on public.marketing_scheme_claims (society_id);

do $$
declare t text;
begin
  foreach t in array array['marketing_dealer_licences', 'marketing_scheme_claims'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (society_id::text in (select public.current_user_society_ids()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write()) with check (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_write())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (society_id::text in (select public.current_user_society_ids()) and public.jwt_can_delete())', t || '_delete', t);
  end loop;
end $$;

insert into public.app_migrations (version, name) values ('140', 'dealer_licences_scheme_claims')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
