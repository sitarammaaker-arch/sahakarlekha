# SahakarLekha — Phase 2 Progress (continuity file)

> Read this first every session. Baseline is the Phase 1 audit (2026-09-30):
> `SahakarLekha-Phase1-Audit-2026-09-30.pdf` / Claude Doc `4ebf8720-77c5-467a-b4d4-619c37b55056`.
> Status words: COMPLETE (verified), PARTIAL, BLOCKED, DEFERRED, FAILED, IN PROGRESS.
> "COMPLETE" means verified on the harness or in prod. A prod-affecting step that waits on the founder
> (DB password, merge, deploy) is **AWAITING-FOUNDER**: the code is done and tested, but not yet live.

## Standing constraints (never violate)
- Claude never handles DB passwords. The founder runs `scripts/backup-prod.ps1` and `scripts/apply-sql.ps1`.
- The repo is PUBLIC, so never commit prod-derived data. Prod queries are read-only only.
- The founder merges PRs. Every prod change needs a backup and an undo file.
- Explain findings to the founder in Devanagari Hindi, with stepwise instructions.
- Statutory values need a SOURCE (Act or circular text plus URL), never a statement.

## Current position
- **Phase:** A — Critical security
- **Current task:** A1–A4 are code-complete in PR (branch `sec/mfa-jwt-identity`): AWAITING-FOUNDER (merge, deploy edge fns, apply 084 + 085).
- **Next task:** A5 (SECURITY DEFINER function audit), which does not depend on 084/085 being live.

## Roadmap status

### Phase A — Critical security
| Task | Status | Notes |
|---|---|---|
| A1 MFA enrolment (SEC-01) | AWAITING-FOUNDER | mig 084; harness 34/34; the down file reproduces the hole |
| A2 MFA admin reset (SEC-02) | AWAITING-FOUNDER | mig 084 (same functions) |
| A3 MFA bound to session / JWT (SEC-03) | AWAITING-FOUNDER | mig 085 + AuthContext + 8 edge fns; harness 41/41 |
| A4 TOTP brute-force | AWAITING-FOUNDER | mig 085: 5 fails / 15 min per email |
| A5 SECURITY DEFINER audit | NOT STARTED | 51 SD fns, 24 anon-exec (audit). Known leads: `create-order` edge fn takes `society_id` from the body with no caller check; `issue_certificate` overwrites holder_name; `society_users_bootstrap` anon insert (P3); `app_set_my_password` allowed while 2FA pending (DoS only, by design: the password-reset flow needs it) |
| A6 Critical RLS verification | NOT STARTED | |

### Phase B — Accounting integrity (from the audit)
B1 server posting architecture: verified for Rania (S3, migs 077–083 live). B2 rollout to all societies: NOT STARTED (next candidate 7f2919f0). B3–B10: NOT STARTED.

### Phases C–M
NOT STARTED. See the roadmap in the master prompt; the order follows the dependency rule.

## Tracked audit findings
| ID | Area | Status |
|---|---|---|
| SEC-01 | MFA enrolment anon + caller email | fix in PR (084) |
| SEC-02 | MFA admin reset trusts caller email | fix in PR (084) |
| SEC-03 | 2FA not bound to JWT | fix in PR (085) |
| ACC-01 | server posting rollout (only Rania) | open → B2 |
| ACC-02 | FY closing only sets fyLocked | open → C |
| S4 | client accounting writes still allowed | open → B3 |
| JRN-01 | residual journal drift | open → B7/B8 |
| TAX-01 | TDS engine absent, validateTds unused | open → D |
| TAX-02 | TDS register / bank-reco delete: console.warn only | open → D8 / G |
| PAY-01 | payroll ledger posting off; TDS not cumulative | open → E |
| OFF-01 | offline fallback restores a partial state | open → F |
| OPS-01 | no vite build.target (old-browser crashes) | open → G1 / L1 |
| TEST-01 | no E2E framework | open → I6 |
| PERF-01 | 3.1 MB main chunk, god-context | open → J |
| DEEP-01 | domain modules not traced end-to-end | open → H |

## Completed-work log

### 2026-09-30 — A1–A4 MFA (branch `sec/mfa-jwt-identity`)
- **Files:**
  - `supabase/migrations/084_mfa_identity_from_jwt{,_down}.sql`
  - `supabase/migrations/085_mfa_session_binding{,_down}.sql`
  - `src/contexts/AuthContext.tsx`
  - `src/lib/auth/mfaPending.ts`
  - `supabase/functions/{ai-ask,member-portal-admin,pay-employee,pay-pay,pay-post,pay-rollback,pay-run,pay-transition}/index.ts`
  - `supabase-tables.sql` (MFA grants no longer to anon, plus a SUPERSEDED note)
  - `package.json` (`test:mfa-pending`)
  - tests; `docs/security/MFA-SESSION-BINDING.md`
- **Tests:**
  - harness a1 34/34 and a3 41/41; smoke 8/8
  - s3a/b/d/e2/f1/f2/f3 all green
  - `tsc` clean
  - full pure suite: 274 scripts, all pass (ucas-rules shows a Windows libuv exit crash after 23/23 pass)
  - The m1-2 / m1-3 / m1-4b / s2 / rm01 harness tests refuse to run on a post-migration dump by design.
- **Prod facts before the fix (read-only):**
  - 1 `user_mfa` row, which belongs to the platform admin (`platform_admins.mfa_enabled` = 1)
  - 0 society users enrolled
  - 1 mixed-case `society_users` email, handled by the case-insensitive compare
- **Remaining risk:** the platform admin is the only enrolled account. After 085, that login depends on the new client flow. The rollback is `085_..._down.sql`.
- **Deploy order:** see `docs/security/MFA-SESSION-BINDING.md`.

## Session hand-off notes
- Harness: `node scripts/db-harness/harness.mjs up --dump D:/SahakarLekha-Backups/sahakarlekha-prod-20260930-1500Z.dump`. That dump includes 083. The local harness currently has 084 and 085 applied.
- For read-only prod queries, use the scratchpad `m0/run.sh` wrapper (`supabase db query --linked` in a read-only transaction).
