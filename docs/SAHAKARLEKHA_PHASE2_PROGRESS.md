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
- **Current task:** A1–A4. PR #584 is MERGED and the client is deployed (2026-09-30 16:20 UTC). Still AWAITING-FOUNDER: deploy the 8 edge fns, then apply 084 + 085 (files staged in `D:\SahakarLekha-Backups\sec\`).
- **A5:** the P0 (086) is **LIVE**. The founder applied it 2026-09-30 ~16:15 UTC after backup `sahakarlekha-prod-20260930-1613Z.dump`. Verified read-only: anon EXECUTE is false for both fns, the guard is in the body, and the app_migrations row is 086. PR #585 is awaiting merge. The last A5 items (087 issue_certificate, create-order caller check) are in PR `sec/a5-order-cert`.
- **Next task:** Phase A is code-complete. Next is **B1/B2** (server-posting rollout readiness; the next society is 7f2919f0), then B3.

## Roadmap status

### Phase A — Critical security
| Task | Status | Notes |
|---|---|---|
| A1 MFA enrolment (SEC-01) | AWAITING-FOUNDER | mig 084; harness 34/34; the down file reproduces the hole |
| A2 MFA admin reset (SEC-02) | AWAITING-FOUNDER | mig 084 (same functions) |
| A3 MFA bound to session / JWT (SEC-03) | AWAITING-FOUNDER | mig 085 + AuthContext + 8 edge fns; harness 41/41 |
| A4 TOTP brute-force | AWAITING-FOUNDER | mig 085: 5 fails / 15 min per email |
| A5 SECURITY DEFINER audit | AWAITING-FOUNDER (086 LIVE; 087 + create-order in PR) | **A5-1 P0 FIXED in PR #585 (mig 086, harness 7/7):** app_add_society_user / app_reset_society_user_password skipped auth when the JWT email was null, and anon held EXECUTE. Reviewed OK: admin_feedback_* (is_platform_admin; the p_email/p_password args are ignored), pay_payslip_lines (tenant guard), public_reviews/increment_blog_view/verify_certificate (public by design), society_has_users (boolean only), register_society/app_register_admin (signup; only for a user-less society = P3). **A5-2 (P2):** issue_certificate let anyone rename a certificate's holder, which breaks verification for the real holder. Fix: mig 087, harness 7/7 (3/7 before). **A5-3 (P2):** the create-order edge fn accepted the anon key plus any society_id and leaked plan/renewal via the prorated amount. Fix: the caller must be an active user of that society, on a non-pending session. Remaining leads, all accepted as P3: `create-order` edge fn takes `society_id` from the body with no caller check; `issue_certificate` overwrites holder_name; `society_users_bootstrap` anon insert (P3); `app_set_my_password` allowed while 2FA pending (DoS only, by design: the password-reset flow needs it) |
| A6 Critical RLS verification | COMPLETE (harness) | `scripts/db-harness/tests/a6-tenant-isolation.mjs`, **469/469** on the 2026-09-30 prod dump. Coverage: all 104 tables with society_id × read / update / delete / insert-copy / move-own-row as an S1 admin against a real S2; anon and a signed-in stranger see 0 rows in every table; platform tables (platform_admins, societies, user_mfa…, app_migrations…) cannot be written or read by anon or a stranger. Deny-all tables (account_reclass_log, data_fix_log, member_portal_users) refuse with permission denied. By design: public INSERT on error_log + feedback (unreadable by clients; a foreign society_id only pollutes a log, P3). A 2FA-pending token is covered by a3 (085). |

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
| SEC-04 (new, P0) | anon user-add / password-reset bypass | **FIXED, LIVE** (086, 2026-09-30) |
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

### 2026-09-30 — A5-1 anon user-admin bypass (branch `sec/user-admin-anon-bypass`, PR #585)
- **Files:** `supabase/migrations/086_user_admin_rpcs_auth{,_down}.sql`, `scripts/db-harness/tests/a5-user-admin-rpcs.mjs`.
- **Tests:** harness 7/7 after 086 and 3/7 before it (reproduces both takeovers). Idempotent re-apply; the down file was re-verified.
- **Prod read-only evidence:** among recent logins, no unknown admin was added to an existing society. Use cannot be ruled out.

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
