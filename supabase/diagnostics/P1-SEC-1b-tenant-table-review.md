# P1-SEC-1b · Tenant-Table Review (W-7)

Review of every table 007 will tenant-scope, to confirm none is shared/reference
data that scoping would wrongly hide, and none has a client access path that
scoping would break. 007 discovers tables **dynamically by the `society_id`
column**, so this review classifies that set (~90 tables) by domain.

## Method
- The set = every `public` table with a `society_id` column (007's discovery rule).
- Each is classified as tenant domain data, WORM, or RPC-mediated.
- Client access patterns were checked with `grep "from('<table>')"`.

## Conclusion (PASS)
Every discovered table is **per-society tenant data** — there is no shared/global
reference table in the set (the only global/platform tables — `platform_admins`,
`user_mfa`, `user_mfa_recovery`, `guide_certificates` — have **no** `society_id`
and are correctly excluded; `societies` is scoped by `id` separately). Scoping all
of them by `society_id = get_current_society_id()` is correct and does not hide
data any tenant is entitled to.

## Domain classification

| Domain | Tables (representative) | Notes |
|---|---|---|
| Core accounting | accounts, vouchers, voucher_entries, members, loans, kcc_loans, assets, budgets, recoverables, bank_reconciliations, audit_objections | Per-society. 001 already scopes accounts/vouchers/members/loans/assets (007 preserves those + fills gaps). |
| Inventory / trade | stock_items, stock_movements, purchases, sales, purchase_returns, sales_returns, suppliers, customers, hsn_master, godowns, eway_bills | Per-society. **hsn_master is per-society** (code scope-corrected; no client `.from()` read). |
| Procurement (MSP) | procurement_* (lots, events, farmers, settlements, jforms, msp_rates, quality_*, …) | Per-society MSP domain data. |
| Dairy | dairy_rate_charts, milk_entries, dairy_settlements, dairy_dispatches, dairy_distributions, dairy_input_issues | Per-society. |
| Housing | housing_* (flats, buildings, charge_heads, complaints, parking, transfers, insurance, amc, documents, fund_investments), maintenance_bills | Per-society. |
| Consumer / marketing | consumer_price_lists, consumer_patronage_runs, consumer_purchase_orders, marketing_transporters, kachi_aarat_entries | Per-society. |
| Deposits / payroll / tax | deposit_accounts, deposit_transactions, employees, salary_records, workers, worker_advances, muster_entries, pf_esi_runs, work_orders, department_bills, departments, tds_entries, tds_challans, tds_challan_links, compliance_filings | Per-society. |
| Governance / config | society_settings, society_users, society_activities, society_capabilities, branches, elections, meeting_register | Per-society. `society_users` login read resolves the caller's OWN row (get_current_society_id ↔ same email). |
| **WORM (append-only)** | **ledger_events, audit_log** | SELECT+INSERT only; **no client UPDATE/DELETE** exists (verified) — WORM guarantee is compatible with real usage. |
| RPC-mediated only | document_sequences, hsn_master | **0** direct client `.from()` reads — accessed via SECURITY DEFINER RPCs (e.g. `next_document_number`) which bypass RLS. Scoping is harmless. |

## Special-case verifications
- **WORM writes:** `grep from('ledger_events').update|delete` and same for `audit_log` → **none**. The client only inserts/selects these → 007's append-only policies do not break any code path.
- **society_users at login:** the post-`signInWithPassword` read of the caller's own `society_users` row is visible under the scoped SELECT (its `society_id = get_current_society_id()`), so login continuity holds (see also W-1).
- **document_sequences / hsn_master:** no direct client reads → only RPC/export paths (bypass RLS) → unaffected.

## Empirical confirmation (staging)
Static review is necessary but not sufficient. The runbook's staging smoke tests
are the empirical gate:
- **Step 4** (registration), **Step 5** (voucher save → also writes `ledger_events`
  + `audit_log` under the scoped INSERT), **Step 6** (all reports render identical
  figures). Exercise at least one page from each domain group above for the test
  society, and confirm no "empty list / permission denied" regression.
- List the live coverage: run the LIVE VERIFICATION SQL from `test-rls-coverage.mjs`
  (query (a)) and confirm every row is `rls_enabled=true, policies>=1, permissive=false`.
