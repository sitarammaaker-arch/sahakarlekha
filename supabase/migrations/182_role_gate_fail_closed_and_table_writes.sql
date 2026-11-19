-- 182 · SEC-04 + SEC-03 (product audit 2026-11-17, both confirmed in production)
--
-- SEC-04 — the role gate failed OPEN. jwt_can_write() / jwt_can_delete() began with
--   "auth.jwt() ->> 'user_role' is null or …": a token WITHOUT the claim passed every write and delete gate. The
--   access-token hook swallows its own errors (it must never block a login), so a hook failure silently turned
--   every login into a writer. Who has no claim today (checked 2026-11-19): platform admins, member-portal and
--   partner logins — none of them has a society id, so none passes a tenant check on society tables anyway; the
--   posting RPCs already refuse a token with no claim ('no_role_claim'), and pay-post / pay-pay call post_voucher
--   AS THE SIGNED-IN USER. So no legitimate path depends on the null branch; it is removed. Tokens live one hour.
--
-- SEC-03 — read-only logins could write and hard-delete 71 tables through the REST API. Their write policies
--   checked the society and nothing else (the browser only hides the buttons). Every PERMISSIVE write policy on
--   these tables now also requires jwt_can_write() — the same role list the 030/031 tables use. An ALL policy is
--   split into select (unchanged) + insert + update + delete.
--   DELETE uses jwt_can_write(), not jwt_can_delete(): the app's writer roles (accountant, cashier, …) hard-delete
--   rows on these tables as part of ordinary edits (voucher_entries on a cancel, challan links on a rebuild,
--   muster lines…). jwt_can_delete() would break those and leave drift; the goal here is the read-only hole.
--   Left alone on purpose: audit_objections (the auditor family files objections — rbac 'auditNote'), audit_log
--   (every role records its own actions, e.g. an export), public forms (error_log, feedback, leads), the
--   admin-gated tables (societies, society_settings, society_capabilities, society_users) and the RESTRICTIVE
--   branch policies (an extra layer on top of the gated ones).
--   The original policies are kept in public._rls_182_backup so the down file restores them exactly.
--
-- Idempotent: a policy that already carries jwt_can_write / jwt_can_delete is skipped. Undo: the _down file.

begin;

-- ── SEC-04 ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.jwt_can_write() returns boolean
language sql stable set search_path = public as $$
  -- 182 / SEC-04: no claim ⇒ NO write (was: no claim ⇒ any write).
  select coalesce(auth.jwt() ->> 'user_role', '') in (
        -- legacy strings (existing users' claims carry these forever)
        'admin', 'accountant',
        -- matrix roles with UPDATE
        'societyAdmin', 'manager', 'cashier', 'storeKeeper', 'procurementOfficer',
        'salesOperator', 'secretary', 'employee', 'dataEntry',
        -- APPROVE-only roles (approval = an UPDATE on the voucher row)
        'boardMember', 'chairman'
      );
$$;

create or replace function public.jwt_can_delete() returns boolean
language sql stable set search_path = public as $$
  -- 182 / SEC-04: no claim ⇒ NO delete.
  select coalesce(auth.jwt() ->> 'user_role', '') in ('admin', 'societyAdmin', 'secretary');
$$;

grant execute on function public.jwt_can_write()  to authenticated, anon;
grant execute on function public.jwt_can_delete() to authenticated, anon;

-- ── SEC-03 ────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public._rls_182_backup (
  tablename  text not null,
  policyname text not null,
  cmd        text not null,
  permissive text not null,
  roles      text[] not null,
  qual       text,
  with_check text,
  created    text[] not null,
  primary key (tablename, policyname)
);
alter table public._rls_182_backup enable row level security;
revoke all on table public._rls_182_backup from public, anon, authenticated;

do $sec03$
declare
  tbls text[] := array[
    'assets','bank_reconciliations','budgets','consumer_patronage_runs','consumer_price_lists','consumer_purchase_orders',
    'customers','dairy_dispatches','dairy_distributions','dairy_input_issues','dairy_rate_charts','dairy_settlements',
    'department_bills','departments','document_sequences','elections','employees','eway_bills','housing_amc',
    'housing_buildings','housing_charge_heads','housing_complaints','housing_documents','housing_flats',
    'housing_fund_investments','housing_insurance','housing_parking','housing_transfers','hsn_master','kcc_loans',
    'ledger_events','loans','maintenance_bills','marketing_transporters','meeting_register','member_identity',
    'milk_entries','muster_entries','pf_esi_runs','procurement_agencies','procurement_bardana_types',
    'procurement_centres','procurement_crops','procurement_deduction_rules','procurement_events','procurement_farmers',
    'procurement_financial_intents','procurement_jform_counters','procurement_jforms','procurement_lots',
    'procurement_moisture_records','procurement_msp_rates','procurement_posting_requests',
    'procurement_posting_rule_results','procurement_quality_specs','procurement_quality_tests','procurement_seasons',
    'procurement_settlement_counters','procurement_settlements','procurement_varieties','purchase_returns',
    'salary_records','sales_returns','suppliers','tds_challan_links','tds_challans','tds_entries','voucher_entries',
    'work_orders','worker_advances','workers'
  ];
  p record;
  to_roles text;
  q text;
  wc text;
  n_ins text; n_upd text; n_del text;
  done int := 0;
begin
  for p in
    select tablename, policyname, cmd, permissive, roles, qual, with_check
      from pg_policies
     where schemaname = 'public' and tablename = any(tbls)
       and permissive = 'PERMISSIVE' and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
       and coalesce(qual, '') !~* 'jwt_can_(write|delete)' and coalesce(with_check, '') !~* 'jwt_can_(write|delete)'
     order by tablename, policyname
  loop
    select string_agg(quote_ident(r), ', ') into to_roles from unnest(p.roles) r;
    q  := p.qual;
    wc := coalesce(p.with_check, p.qual);
    n_ins := left(p.policyname, 52) || '_w_insert';
    n_upd := left(p.policyname, 52) || '_w_update';
    n_del := left(p.policyname, 52) || '_w_delete';

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    if p.cmd = 'ALL' then
      execute format('create policy %I on public.%I as permissive for select to %s using (%s)', p.policyname, p.tablename, to_roles, q);
      execute format('drop policy if exists %I on public.%I', n_ins, p.tablename);
      execute format('drop policy if exists %I on public.%I', n_upd, p.tablename);
      execute format('drop policy if exists %I on public.%I', n_del, p.tablename);
      execute format('create policy %I on public.%I as permissive for insert to %s with check ((%s) and public.jwt_can_write())', n_ins, p.tablename, to_roles, wc);
      execute format('create policy %I on public.%I as permissive for update to %s using ((%s) and public.jwt_can_write()) with check ((%s) and public.jwt_can_write())', n_upd, p.tablename, to_roles, q, wc);
      execute format('create policy %I on public.%I as permissive for delete to %s using ((%s) and public.jwt_can_write())', n_del, p.tablename, to_roles, q);
      insert into public._rls_182_backup values (p.tablename, p.policyname, p.cmd, p.permissive, p.roles, p.qual, p.with_check, array[p.policyname, n_ins, n_upd, n_del])
        on conflict (tablename, policyname) do nothing;
    elsif p.cmd = 'INSERT' then
      execute format('create policy %I on public.%I as permissive for insert to %s with check ((%s) and public.jwt_can_write())', p.policyname, p.tablename, to_roles, wc);
      insert into public._rls_182_backup values (p.tablename, p.policyname, p.cmd, p.permissive, p.roles, p.qual, p.with_check, array[p.policyname])
        on conflict (tablename, policyname) do nothing;
    elsif p.cmd = 'UPDATE' then
      execute format('create policy %I on public.%I as permissive for update to %s using ((%s) and public.jwt_can_write()) with check ((%s) and public.jwt_can_write())', p.policyname, p.tablename, to_roles, q, wc);
      insert into public._rls_182_backup values (p.tablename, p.policyname, p.cmd, p.permissive, p.roles, p.qual, p.with_check, array[p.policyname])
        on conflict (tablename, policyname) do nothing;
    else  -- DELETE
      execute format('create policy %I on public.%I as permissive for delete to %s using ((%s) and public.jwt_can_write())', p.policyname, p.tablename, to_roles, q);
      insert into public._rls_182_backup values (p.tablename, p.policyname, p.cmd, p.permissive, p.roles, p.qual, p.with_check, array[p.policyname])
        on conflict (tablename, policyname) do nothing;
    end if;
    done := done + 1;
  end loop;
  raise notice '182: % write policies now require jwt_can_write()', done;
end
$sec03$;

insert into public.app_migrations (version, name) values ('182', 'role_gate_fail_closed_and_table_writes')
  on conflict (version) do nothing;

commit;

-- VERIFY (read-only):
--   select pg_get_functiondef('public.jwt_can_write()'::regprocedure) !~ 'is null';                       -- true
--   select count(*) from public._rls_182_backup;                                                            -- the policies changed
--   select count(*) from pg_policies where schemaname='public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
--     and permissive='PERMISSIVE' and tablename in (select tablename from public._rls_182_backup)
--     and coalesce(qual,'')||coalesce(with_check,'') !~* 'jwt_can_write';                                  -- 0
