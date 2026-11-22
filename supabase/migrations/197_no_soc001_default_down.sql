-- Undo 197 · puts the 'SOC001' default back on the 85 tables that had it on 2026-11-22 (read from prod), and forgets
-- the migration row. Only for a rollback — the default is the misroute 197 removed.
begin;

do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'assets', 'audit_log', 'audit_objections', 'bank_reconciliations', 'budgets', 'compliance_filings',
    'consumer_patronage_runs', 'consumer_price_lists', 'consumer_purchase_orders', 'customers',
    'dairy_dispatches', 'dairy_distributions', 'dairy_input_issues', 'dairy_rate_charts', 'dairy_settlements',
    'department_bills', 'departments', 'deposit_accounts', 'deposit_transactions', 'elections', 'employees',
    'eway_bills', 'housing_amc', 'housing_buildings', 'housing_charge_heads', 'housing_complaints',
    'housing_documents', 'housing_flats', 'housing_fund_investments', 'housing_insurance', 'housing_parking',
    'housing_transfers', 'hsn_master', 'kachi_aarat_entries', 'kcc_loans', 'ledger_events', 'loans',
    'maintenance_bills', 'marketing_transporters', 'meeting_register', 'members', 'milk_entries',
    'muster_entries', 'p7_entries', 'pf_esi_runs', 'procurement_agencies', 'procurement_bardana_types',
    'procurement_centres', 'procurement_crops', 'procurement_deduction_rules', 'procurement_events',
    'procurement_farmers', 'procurement_financial_intents', 'procurement_jforms', 'procurement_lots',
    'procurement_moisture_records', 'procurement_msp_rates', 'procurement_posting_requests',
    'procurement_posting_rule_results', 'procurement_quality_specs', 'procurement_quality_tests',
    'procurement_seasons', 'procurement_settlements', 'procurement_varieties', 'purchase_returns', 'purchases',
    'recoverables', 'salary_records', 'sales', 'sales_returns', 'society_activities', 'society_capabilities',
    'society_settings', 'stock_items', 'stock_movements', 'suppliers', 'tds_challan_links', 'tds_challans',
    'tds_entries', 'voucher_entries', 'vouchers', 'work_orders', 'worker_advances', 'workers'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I alter column society_id set default %L', t, 'SOC001');
    end if;
  end loop;
end $$;

delete from public.app_migrations where version = '197';

commit;
