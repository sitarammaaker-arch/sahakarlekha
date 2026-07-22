# Payroll — Production Go-Live Runbook

Practical checklist to take the payroll platform from "built + staging-verified" to **live for real
societies**. Everything below is additive and isolated (new `pay_*` schemas; existing tables/app
untouched). Nothing here has been run against production yet — **production has never been touched.**

> Read [README.md](README.md) for the migration list. `next_document_number`-style server ops and the
> orchestrator Edge Function are **not** part of this runbook — see "Not yet built" at the end.

---

## What is already done (on `main`, staging-verified)

- Full `pay_*` schema + RLS + WORM + partitioning (migrations 100–113).
- AAL2 MFA gate (114) — **staging-verified, NOT applied anywhere yet** (deliberately gated, see step 3).
- Pure calc pipeline + orchestrator (TS) — a real run computes + persists on staging.
- Public read API (115, 117) + partitioned-table RLS fix (116).
- Read-only Payroll UI (runs list + payslip component breakdown).

---

## Step 1 — 🔴 Deploy the schema to production (you run this)

Migrations **100–113 + 115 + 116 + 117**, in order. **NOT 114** (that comes after MFA, step 3).

1. **Backup** — prod Supabase dashboard → Database → Backups → confirm a recent backup exists.
2. **Connection URL** — on the **production** project (the one your live app uses; its ref is in
   Vercel → `VITE_SUPABASE_URL`, and it is **not** `sahakarlekha-staging`), click **Connect →
   Session pooler**, copy the URI, replace `[YOUR-PASSWORD]`.
3. **Apply** (from a checkout that has `supabase/migrations/payroll/`, Git Bash):
   ```bash
   export DATABASE_URL="<prod-session-pooler-URL>"
   node scripts/pay-apply.mjs \
     supabase/migrations/payroll/100_pay_schemas.sql \
     supabase/migrations/payroll/101_pay_enums_domains.sql \
     supabase/migrations/payroll/102_pay_functions_triggers.sql \
     supabase/migrations/payroll/103_pay_audit_history.sql \
     supabase/migrations/payroll/104_pay_establishment.sql \
     supabase/migrations/payroll/105_pay_config.sql \
     supabase/migrations/payroll/106_pay_rule_formula_policy.sql \
     supabase/migrations/payroll/107_pay_calc.sql \
     supabase/migrations/payroll/108_pay_disbursement_compliance.sql \
     supabase/migrations/payroll/110_pay_rls.sql \
     supabase/migrations/payroll/111_pay_views_matviews.sql \
     supabase/migrations/payroll/113_pay_seed.sql \
     supabase/migrations/payroll/115_pay_public_api.sql \
     supabase/migrations/payroll/116_pay_rls_partitioned.sql \
     supabase/migrations/payroll/117_pay_payslip_lines_api.sql
   ```
   Expect `✓ applied …` per file, then `ALL OK (14 file(s))`.
4. **Verify**: `node scripts/pay-apply.mjs supabase/migrations/payroll/VERIFICATION.sql` → `ALL OK`.
5. **Undo if needed**: `node scripts/pay-apply.mjs supabase/migrations/payroll/999_pay_rollback_all.sql`
   (drops only `pay_*`; your existing data is untouched).

**Impact:** new empty `pay_*` tables + the read API. The **Payroll page becomes usable** for logged-in
users (RLS scopes it to their society). No downtime, no change to existing app behaviour.

---

## Step 2 — 🟡 Verify the UI in production

Log in as a real society user → the **पेरोल / Payroll** menu item appears (admin/accountant roles) →
the page loads (empty until a run is computed). PII surfaces are safe (no run/payslip data yet).

---

## Step 3 — 🔴 MFA go-live (ADR-0012) — REQUIRED before any financial run

The AAL2 gate (114) and disbursement/posting paths must **not** go live until native MFA is real,
or they will fail-close for everyone.

1. **task 1** — enable native TOTP MFA on the prod project (Authentication → Multi-Factor). *(done on
   staging.)*
2. **task 2** — migrate existing users from the custom `user_mfa` table to native factors (one-time,
   reversible). *Ask for the stepwise migration when you reach this.*
3. **task 4** — client native step-up in `AuthContext` before consequential actions. *(Additive; built
   when the run/approve/post UI exists to gate.)*
4. **THEN apply 114**: `node scripts/pay-apply.mjs supabase/migrations/payroll/114_pay_aal2_gate.sql`
   → verify with `114_VERIFY.sql` (18 restrictive policies) + `114_GATE_TEST.sql`.

---

## Not yet built (the next phases — ask when ready)

- **Run workflow UI** — trigger a run / verify / approve / **post**. "Run" needs the orchestrator as a
  **Deno Edge Function** (the TS pipeline exists + is proven as a Node script: `scripts/pay-run-staging.mjs`).
- **Config-RLS follow-up** — society-less `pay_config`/`pay_formula`/`pay_rule` tables need parent-scoped
  SELECT policies before the UI reads config directly (run-creation). Currently worked around by
  SECURITY DEFINER RPCs. Do it **with** the run-creation phase, not before.
- **Disbursement / statutory filing** — the schema exists (108); the flows are a later phase, gated on
  step 3.

---

*Everything above is reversible and isolated. Take it one step at a time; ask for the detailed
sub-steps (especially the task-2 user migration) when you reach each gate.*
