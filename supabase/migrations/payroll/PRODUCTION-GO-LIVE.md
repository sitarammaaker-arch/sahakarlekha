# Payroll — Production Go-Live Runbook

Practical checklist to take the payroll platform from "built + staging-verified" to **live for real
societies**. Everything is additive and isolated (new `pay_*` schemas + 5 Edge Functions; existing
tables/app untouched). **Production has never been touched.**

> All ⬛ **`node …` / `npx …`** commands run from a checkout that contains `supabase/migrations/payroll/`,
> in Git Bash. 🔴 = you must do it · 🟡 = optional/verify. Each step says what you'll see + how to undo.

---

## What is already built + STAGING-verified (on `main`)

- Full `pay_*` schema + RLS + WORM + partitioning + attendance + statutory settings (migrations 100–119).
- **The whole operational cycle**, as 5 Deno Edge Functions:
  - `pay-employee` — add/edit/remove employees, attendance, statutory IDs (UAN/PAN/ESIC), editable rates.
  - `pay-run` — server-side compute + persist a run (the pure pipeline, bundled in `_shared/pay-core.mjs`).
  - `pay-transition` — verify → approve → lock (maker-checker).
  - `pay-post` — post a locked run to the general ledger (double-entry voucher).
  - `pay-pay` — disburse a posted run (payment voucher).
- Public read API (115, 117) + partitioned-table RLS fix (116).
- Payroll UI: runs list, payslip breakdown, print, Register CSV, **PF ECR** file, employee + statutory editors.
- AAL2 MFA gate (114) — staging-verified, **NOT applied anywhere yet** (deliberately gated, step 4).

**Readiness gates — all GREEN on staging (2026-07-22):** RLS coverage (73 `pay_*` tables all
enabled+forced, 157 policies, no permissive SELECT, WORM tables lock UPDATE/DELETE); the pure calc
suite (payslip aggregation incl. fixed-component lines); routing + role-gated nav (admin/accountant);
the `_shared/pay-core.mjs` bundle in sync with `src/lib/pay`; and the full cycle (add → run → post →
pay) with multi-employee + odd-paise + LOP tying out exactly to the ledger.

---

## Step 0 — 🟡 Pre-flight (re-run after each step below; all green = safe to proceed)

Point `DATABASE_URL` at the target project, then:
```bash
node scripts/pay-apply.mjs supabase/migrations/payroll/VERIFICATION.sql   # schema objects present → ALL OK
npm run test:pay-rls-coverage                                             # live RLS complete → PASS
npm run test:pay-payslip && npm run test:pay-assemble-run                 # pure calc invariants → PASS
```
On production these confirm the deploy landed; on staging they are green today.

---

## Step 1 — 🔴 Deploy the schema to production

Migrations **100–119 (17 files), NOT 114** (114 comes after MFA, step 4).

1. **Backup** — prod Supabase dashboard → Database → Backups → confirm a recent backup exists.
2. **Connection URL** — on the **production** project (the ref your live app uses — in Vercel →
   `VITE_SUPABASE_URL`; it is **not** the staging ref `ivmrlhjrqtwftdlxajxk`), click **Connect →
   Session pooler**, copy the URI, replace `[YOUR-PASSWORD]`. Keep this URL — step 2 reuses it.
3. **Apply**:
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
     supabase/migrations/payroll/117_pay_payslip_lines_api.sql \
     supabase/migrations/payroll/118_pay_attendance.sql \
     supabase/migrations/payroll/119_pay_statutory_setting.sql
   ```
   Expect `✓ applied …` per file, then `ALL OK (17 file(s))`.
4. **Verify**: `node scripts/pay-apply.mjs supabase/migrations/payroll/VERIFICATION.sql` → `ALL OK`.
5. **Undo if needed**: `node scripts/pay-apply.mjs supabase/migrations/payroll/999_pay_rollback_all.sql`
   (drops only `pay_*`; existing data untouched).

**Impact:** new empty `pay_*` tables + read API. No downtime, no change to existing app behaviour.

---

## Step 2 — 🔴 Deploy the Edge Functions + set the DB secret

The 5 functions reach the `pay_*` schemas over a **direct DB connection** (PostgREST cannot see
non-`public` schemas), so they need one secret: **`PAY_DB_URL`** = the same prod session-pooler URL from
step 1.2. Point the CLI at production (either `supabase link` to the prod ref, or pass `--project-ref
<prod-ref>` on every command below).

1. **Secret** (once):
   ```bash
   npx supabase secrets set PAY_DB_URL="<prod-session-pooler-URL>" --project-ref <prod-ref>
   ```
2. **Deploy** all five:
   ```bash
   for f in pay-employee pay-run pay-transition pay-post pay-pay; do
     npx supabase functions deploy "$f" --project-ref <prod-ref>
   done
   ```
   Expect `Deployed Functions.` each. The `_shared/pay-core.mjs` bundle is committed and ships with the
   functions automatically. (Only if you changed pipeline source: `npm run build:pay-core` first.)
3. **Verify**: log in as a prod admin, open the Payroll page, add one test employee → the `pay-employee`
   call returns 200. Undo: `npx supabase functions delete <name> --project-ref <prod-ref>` (schema stays).

**Impact:** the Payroll page becomes fully operational (add employees → run → post → pay).

---

## Step 3 — 🟡 Verify in production

Log in as a real society **admin/accountant** → the **पेरोल / Payroll** menu appears → add an employee,
run a period, open the payslip, download Register CSV / PF ECR. Post/Pay work under admin-JWT (see the
security note in step 4 before using them on real books).

---

## Step 4 — 🔴 MFA go-live (ADR-0012) — before real financial posting

**Security posture as shipped:** `pay-post` / `pay-pay` write over the direct DB connection, which
**bypasses RLS — so the migration-114 aal2 RLS gate does NOT reach them.** They are gated by a valid
**admin JWT + role**, but *not yet* by MFA. To require MFA on financial actions there is an in-function
`aal` check, **off by default** so it can never fail-close early.

1. **Enable native TOTP MFA** on the prod project (Authentication → Multi-Factor). *(done on staging.)*
2. **Migrate existing users** from the custom `user_mfa` table to native factors (one-time, reversible).
   *Ask for the stepwise migration when you reach this.*
3. **Client step-up** in `AuthContext` before consequential actions. *(Additive.)*
4. **Turn on the financial-action MFA gate** — once admins actually have MFA:
   ```bash
   npx supabase secrets set PAY_REQUIRE_AAL2=true --project-ref <prod-ref>
   ```
   Now `pay-post`/`pay-pay` reject any non-AAL2 session with 403. Undo: `secrets unset PAY_REQUIRE_AAL2`.
   *(Verified on staging both ways: unset → posts; `true` + a password-only session → 403 MFA.)*
5. **Apply the interactive-session RLS gate (114)** for the browser write paths:
   `node scripts/pay-apply.mjs supabase/migrations/payroll/114_pay_aal2_gate.sql`
   → verify with `114_VERIFY.sql` (restrictive policies) + `114_GATE_TEST.sql`.

---

## Later phases (ask when ready)

- **Statutory FILING beyond PF ECR** — ESI / TDS-24Q / PT: the format is defined
  ([STATUTORY-FILING-FORMATS.md](STATUTORY-FILING-FORMATS.md)); values fill in once each component is added
  to the salary structure with its own **sourced** rate. No layout is fabricated.
- **Config-RLS follow-up** — society-less `pay_config`/`pay_formula`/`pay_rule` tables are currently read
  via SECURITY DEFINER RPCs with explicit tenant guards; parent-scoped SELECT policies are a hardening
  follow-up, not a blocker.

---

*Everything above is reversible and isolated. Take it one step at a time; ask for the detailed sub-steps
(especially the task-2 user migration) when you reach each gate.*
