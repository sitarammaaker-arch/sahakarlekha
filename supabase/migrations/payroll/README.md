# Payroll Physical Schema (Phase 4)

Production PostgreSQL 17 / Supabase schema for the SahakarLekha Payroll platform.
All objects live in dedicated `pay_*` schemas **outside `public`** — payroll only *references*
the existing app (via FKs to `societies`, `branches`, `vouchers`), it never mutates it.

> **Status:** applied and verified on a staging Supabase (PostgreSQL 17.6) during Sprint 1 —
> `VERIFICATION.sql` and `scripts/test-pay-rls-coverage.mjs` both green; full rollback + re-deploy proven.
> **Placement note (T1.9, pending):** these files keep their `1xx` numbering for now. Their final
> location/renumbering into the single canonical migration lineage is the schema-lineage-unification
> decision and is deliberately deferred — do **not** treat this folder as the final home yet.

## Apply order

```
100 → 101 → 102 → 103 → 104 → 105 → 106 → 107 → 108 → 110 → 111 → 113
```

(There is no `109`/`112`; those numbers are intentionally reserved for a later split of
history/matviews.) Each file is idempotent-safe to apply on a fresh database and is applied in its
own transaction by the runner below.

| File | Purpose |
|---|---|
| `100_pay_schemas.sql` | logical schemas, extensions, grants |
| `101_pay_enums_domains.sql` | enums, domains (money/i18n/…), open reference tables |
| `102_pay_functions_triggers.sql` | generic triggers + business-function **signatures** (stubbed) |
| `103_pay_audit_history.sql` | WORM change-log / history / employment events (partitioned) |
| `104_pay_establishment.sql` | employee/appointment/… + PII-isolated identity/bank |
| `105_pay_config.sql` | component & structure catalogs, hierarchy, templates |
| `106_pay_rule_formula_policy.sql` | rule (sourced) / formula (DAG) / policy catalogs + facts |
| `107_pay_calc.sql` | runs, snapshots, **partitioned** payslip/line, `pay_event` (WORM) |
| `108_pay_disbursement_compliance.sql` | payments, statutory liabilities, `posting_link` → `vouchers` |
| `110_pay_rls.sql` | RLS: tenant + role + branch + PII + WORM |
| `111_pay_views_matviews.sql` | security-invoker views + matviews (tenant-safe wrappers) |
| `113_pay_seed.sql` | platform reference taxonomies, standard components, skeletons |
| `114_pay_aal2_gate.sql` | **AAL2 (native MFA) gate** — RESTRICTIVE `aal2` policies on financial writes + PII reads (ADR-0012 task 3). **Applied SEPARATELY, not with the base deploy** — see note below. |
| `114_pay_aal2_gate_down.sql` | removes the AAL2 gate (fully reversible) |
| `114_VERIFY.sql` | structural self-test for the gate (asserts 18 restrictive policies) |
| `999_pay_rollback_all.sql` | full teardown — drops every `pay_*` schema (public untouched) |
| `VERIFICATION.sql` | structural self-test (own transaction; rolls back its own test rows) |

> **⚠ Migration 114 deploy ordering (load-bearing).** `114` is **not** part of the `100→113` base
> deploy above. It fail-closes the gated surfaces for any `aal1` (password-only) session, so it must
> be applied **only after** native Supabase MFA is enabled on the project (ADR-0012 task 1) and
> enrolled users have factors (task 2) — otherwise it locks those surfaces for everyone. On empty
> staging it is harmless and is exactly the fail-closed behaviour verified by `114_VERIFY.sql`.
> Verified on staging (2026-07-22): clean apply → 18 restrictive policies → clean rollback → 0 remain.
> Behavioural verification (`aal1` denied / `aal2` allowed) is deferred to the task-1 live-auth harness.

## How to apply / verify (staging)

```bash
# credentials in a gitignored .env.staging.local (DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY)
node scripts/pay-apply.mjs supabase/migrations/payroll/1*.sql   # apply 100..113 in order
node scripts/pay-apply.mjs supabase/migrations/payroll/VERIFICATION.sql
npm run test:pay-rls-coverage
# rollback drill:
node scripts/pay-apply.mjs supabase/migrations/payroll/999_pay_rollback_all.sql
```

## Prerequisites (base app schema)

Payroll FKs to `public.societies` (uuid id), `public.branches` (text id), `public.vouchers`
(text id) and calls the RLS helpers `get_current_society_id()`, `jwt_can_write()`,
`jwt_can_delete()`, `jwt_branch_ok()`. A target DB must already carry the existing SahakarLekha
schema (these tables + helper functions). For **isolated** staging verification, a minimal base was
established from verbatim repo extracts: the `societies` / `society_users` / `branches` / `vouchers`
`create table` blocks from `supabase-tables.sql`, plus the helper functions from migrations
`007` / `029` / `039`. (Production carries the full base already.)

## Sprint-1 fixes applied to these files (found on first real deploy)

1. **`103`** — three partitioned tables had a PK of `id` only; a partitioned-table PK must include
   the partition key → changed to `primary key (id, occurred_at)`.
2. **`110`** — `leave_type` (which has a `society_id`) got a duplicate `leave_type_sel` policy from
   both the generic loop and an explicit statement → removed the redundant explicit one.
3. **`113`** — standard components `DA`/`HRA` were seeded with `calc_method='formula'` but no
   `formula_ref` (constraint `compver_formula_ck`) → seeded as `'fixed'` placeholders; Phase 6
   supersedes them with real formula versions.
