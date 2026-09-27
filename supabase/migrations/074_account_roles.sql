-- 074 · account_roles + accounts.report_class (Phase-3 S1 · M1-3 · RM-05).
--
-- WHY: the engine hard-codes account ids ('1102', '2201', '3303' …) but the same id means
-- different things in different charts — 3303 is Sundry Debtors (CMS), KCC loans (PACS) and
-- Maintenance Receivable (Housing). The target engine asks for a ROLE and each society maps its
-- own account to it here. See the Phase-3 design, section A-6; the role catalog is code
-- (src/lib/accounting/roles.ts).
--
-- WHAT THIS DOES
--   1. public.account_roles (society_id, role) → account_id, with a composite FK to
--      accounts (id, society_id) — production's accounts PK — so a role can only point at an
--      account of the SAME society, and an account a role points at cannot be deleted.
--      RLS: a tenant may READ its own map. NO write policy: the map is EMPTY after this migration
--      and is seeded only after review (M1-4, decision 3); admin editing comes with its audit.
--   2. accounts.report_class — a new NULLABLE column (values limited to the report classes).
--      Reports will read it instead of parentId '4100' / '5100'. Every existing row stays NULL.
--
-- ADDITIVE ONLY: one new table (empty) and one new nullable column; no existing value changes and
-- no app code reads either yet. Re-running is harmless. Requires 072 (app_migrations).
-- Reversible: 074_account_roles_down.sql.

begin;

create table if not exists public.account_roles (
  society_id  text not null,
  role        text not null check (role ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)*$'),
  account_id  text not null,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  constraint account_roles_pkey primary key (society_id, role),
  constraint account_roles_account_fkey foreign key (account_id, society_id)
    references public.accounts (id, society_id)
);

create index if not exists account_roles_account on public.account_roles (society_id, account_id);

alter table public.account_roles enable row level security;

drop policy if exists account_roles_tenant_select on public.account_roles;
create policy account_roles_tenant_select on public.account_roles
  for select using (society_id::text = get_current_society_id());

revoke insert, update, delete, truncate on public.account_roles from anon, authenticated;
grant select on public.account_roles to authenticated;

comment on table public.account_roles is
  'Per-society role → account map (RM-05). Empty until reviewed seeding (M1-4). Read-only to tenants.';

alter table public.accounts add column if not exists report_class text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_report_class_check'
                 and conrelid = 'public.accounts'::regclass) then
    alter table public.accounts add constraint accounts_report_class_check check (
      report_class is null or report_class in (
        'trading_income', 'trading_expense', 'inventory', 'closing_stock_contra',
        'indirect_income', 'indirect_expense', 'reserve', 'provision', 'fund'));
  end if;
end $$;

comment on column public.accounts.report_class is
  'Statement placement (RM-05). NULL until classified; reports keep using parentId until they switch.';

insert into public.app_migrations (version, name) values ('074', 'account_roles')
  on conflict (version) do nothing;

commit;
