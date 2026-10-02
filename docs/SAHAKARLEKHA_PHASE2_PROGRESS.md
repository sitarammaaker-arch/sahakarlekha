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
- **Phase A: COMPLETE and LIVE.** (Old note follows.) A1–A4. PR #584 is MERGED and the client is deployed (2026-09-30 16:20 UTC). Still AWAITING-FOUNDER: deploy the 8 edge fns, then apply 084 + 085 (files staged in `D:\SahakarLekha-Backups\sec\`).
- **A5:** the P0 (086) is **LIVE**. The founder applied it 2026-09-30 ~16:15 UTC after backup `sahakarlekha-prod-20260930-1613Z.dump`. Verified read-only: anon EXECUTE is false for both fns, the guard is in the body, and the app_migrations row is 086. PR #585 is awaiting merge. The last A5 items (087 issue_certificate, create-order caller check) are in PR `sec/a5-order-cert`.
- **Next task:** Phase A is code-complete. Next is **B1/B2** (server-posting rollout readiness; the next society is 7f2919f0), then B3.

## Roadmap status

### Phase A — Critical security
| Task | Status | Notes |
|---|---|---|
| A1 MFA enrolment (SEC-01) | COMPLETE (LIVE 2026-10-01) | mig 084; harness 34/34; the down file reproduces the hole |
| A2 MFA admin reset (SEC-02) | COMPLETE (LIVE 2026-10-01) | mig 084 (same functions) |
| A3 MFA bound to session / JWT (SEC-03) | COMPLETE (LIVE 2026-10-01; founder re-login verified) | mig 085 + AuthContext + 8 edge fns; harness 41/41 |
| A4 TOTP brute-force | COMPLETE (LIVE 2026-10-01) | mig 085: 5 fails / 15 min per email |
| A5 SECURITY DEFINER audit | COMPLETE (086 + 087 + create-order LIVE 2026-10-01) | **A5-1 P0 FIXED in PR #585 (mig 086, harness 7/7):** app_add_society_user / app_reset_society_user_password skipped auth when the JWT email was null, and anon held EXECUTE. Reviewed OK: admin_feedback_* (is_platform_admin; the p_email/p_password args are ignored), pay_payslip_lines (tenant guard), public_reviews/increment_blog_view/verify_certificate (public by design), society_has_users (boolean only), register_society/app_register_admin (signup; only for a user-less society = P3). **A5-2 (P2):** issue_certificate let anyone rename a certificate's holder, which breaks verification for the real holder. Fix: mig 087, harness 7/7 (3/7 before). **A5-3 (P2):** the create-order edge fn accepted the anon key plus any society_id and leaked plan/renewal via the prorated amount. Fix: the caller must be an active user of that society, on a non-pending session. Remaining leads, all accepted as P3: `create-order` edge fn takes `society_id` from the body with no caller check; `issue_certificate` overwrites holder_name; `society_users_bootstrap` anon insert (P3); `app_set_my_password` allowed while 2FA pending (DoS only, by design: the password-reset flow needs it) |
| A6 Critical RLS verification | COMPLETE (harness) | `scripts/db-harness/tests/a6-tenant-isolation.mjs`, **469/469** on the 2026-09-30 prod dump. Coverage: all 104 tables with society_id × read / update / delete / insert-copy / move-own-row as an S1 admin against a real S2; anon and a signed-in stranger see 0 rows in every table; platform tables (platform_admins, societies, user_mfa…, app_migrations…) cannot be written or read by anon or a stranger. Deny-all tables (account_reclass_log, data_fix_log, member_portal_users) refuse with permission denied. By design: public INSERT on error_log + feedback (unreadable by clients; a foreign society_id only pollutes a log, P3). A 2FA-pending token is covered by a3 (085). |

### Phase B — Accounting integrity (from the audit)
| Task | Status | Notes |
|---|---|---|
| B1 verify server posting architecture | COMPLETE (audit) | Only DataContext writes `vouchers`; each write site was mapped against the flag. Bypasses under the flag: postJoiningReceipts, updateSalaryRecord, clear/unclear/reject (whole-row upsert), reverseVoucher links, mergeAccounts. |
| B3 disable unsafe client writes | PARTIAL, PR #587 | Fixed: salary edits now repost the journal (a JRN-01 source, flag on AND off); joining receipts go via the server; clear/unclear/reject use a targeted update; editedBy. Static test 15/15. Remaining: mergeAccounts, and the flag-off cancelLinkedVouchers path. Runtime spot-check after deploy: edit a paid salary in Rania. |
| B2 rollout to all societies | AWAITING-FOUNDER | **Founder's direction (2026-10-01): no per-society work; one rule for every society.**<br>• `scripts/posting-readiness.mjs` classifies ALL societies in one read-only pass: ON / READY / EMPTY / HEAL / WAIT-FY / BLOCKED. Parity is checked per account: vouchers vs journal vs entries.<br>• Prod 2026-10-01: ON 1, READY 8, EMPTY 9, HEAL 4, WAIT-FY 1, BLOCKED 3.<br>• `heal-voucher-consistency` was extended. A rejected voucher whose posting was live gets a voucher.cancelled event (₹500 cash overstated in 2 societies). Entries on the wrong account/side are fixed (historical: the syncEntries outage).<br>• `posting-flag-batch.mjs` turns ON every READY/EMPTY society in one tx. It re-checks readiness inside the tx and aborts on drift.<br>• mig 088: a new society gets its open FY row. mig 089: a new society starts with posting ON.<br>• Harness verified: heal clears all drift, then the flip turns on 21 (+Rania = 22). Re-apply is refused, undo is exact, and the abort-on-drift works. b2-new-society-fy 7/7 (3/6 before 088).<br>• **WAIT-FY/BLOCKED (4) need FY rollover = Phase C**, and the rollover rule needs the founder's decision. |
| B7 journal/ledger parity | AWAITING-FOUNDER (PR #599) | mig 092 `ledger_drift()` and `log_ledger_drift()` plus the nightly pg_cron job (02:00 IST), for all societies. The journal is read as the statements read it. Readiness uses the same rule and also checks ON societies. On the harness (latest prod dump) no society drifts. |
| B4–B6, B8–B10 | NOT STARTED | |

### Phase C — Financial year
| Task | Status | Notes |
|---|---|---|
| C1 rollover rule | DECIDED | Founder decision (अ), 2026-10-01: after moving to the new FY, the previous FY stays 'closing' and accepts postings until it is closed or audited. |
| C5 create next FY (server) | AWAITING-FOUNDER (PR) | **mig 090:** the society_settings trigger performs the rollover when the label moves to the NEXT year: open → closing, next year inserted 'open' (previous_fy_id linked). It REFUSES (the app rolls back and shows the message) a jump of more than one year, a missing open year, or a year still 'closing'. All 6 server posting fns accept 'open' or 'closing'. SocietySetup announces success only after the cloud accepts (`updateSociety(…, { onSaved, onFailed })`). Harness c1-fy-rollover 13/13 (8/13 on the pre-090 schema); the s3*/a*/b2 suites are green. |
| C2/C3/C4 closing validation, closing entries, closing → closed | AWAITING-FOUNDER (PR) | Decisions D1–D4 (founder, 2026-10-01): continuous ledger · surplus to 1208 · closing stock into the ledger · board resolution required. **C-a (PR #595):** TB opening = balance b/f at the FY start, on both paths. **C-b mig 091 `close_financial_year`:** checks (closing year, authority, no pending, books agree read as the statements read them, next year open), then posts the closing-stock delta journal (31 Mar, `fy.close.stock`) and the nominal sweep into 1208 (1 Apr, `fy.close`), both via post_voucher; the year becomes closed and an audit row is written. **C-c:** SocietySetup YearCloseCard; the Trading A/c recognises `fy.close.stock`. Harness c2-close-fy 21/21 on Kapil, Rania, Assandh and Kisan: opening = closing per account, BS unchanged, 1208 rises by the surplus, the closed year refuses posts. |
| C6/C7 carry-forward, previous closing = next opening | NOT STARTED | The client snapshot (previousYearBalances) still runs. A server-side opening event is to be designed. |

### Phases D–M
NOT STARTED. See the roadmap in the master prompt; the order follows the dependency rule.

## 2026-10-01: Phase A went live
- The founder took backup `sahakarlekha-prod-20261001-0115Z.dump`, then applied 087, 084 and 085 (all "SQL OK"). PRs #584–#587 are merged and deployed (Vercel `125cff0`).
- Claude deployed 9 edge fns (create-order, ai-ask, pay-employee/pay/post/rollback/run/transition, member-portal-admin). member-portal-admin first failed to bundle because the helper sat inside a multi-line import; it was fixed, redeployed, and a CI parse test was added (PR #588).
- **Verified from the public internet (anon key only):**
  - app_mfa_enroll, app_mfa_admin_reset, app_add_society_user, app_reset_society_user_password and app_totp_matches all return 42501.
  - create-order, member-portal-admin and pay-run return 401.
- **Prod catalog:** app_migrations shows 084–087, the hook stamps mfa_pending, and platform_admin_identity exists.
- The founder ran 085_down by mistake at 01:28 UTC (they had read the undo command as a step). They re-applied it at 01:36 UTC after backup `sahakarlekha-prod-20261001-0133Z.dump`.
- **Verified:** platform admin login at 01:48:02 UTC, then 2FA, then the session was marked verified at 01:48:51 UTC. mfa_verified_sessions has 1 row and mfa_failures has 0. The dashboard opened normally.
- **Lesson:** put the undo command under a clearly separate "only if it fails" heading.

### 2026-10-01 (evening): live summary
- **C (FY):**
  - 090 rollover (decision अ), C-a TB opening b/f, and 091 close_financial_year (D1–D4) are all LIVE.
  - D5 (Bacher's 2024-25 year-transfer) is deferred by the founder.
- **B7:** 092 nightly-ledger-drift (02:00 IST) is LIVE. It returned 0 drifting societies at go-live.
- **TAX-02:** delete rollback is LIVE (#600).
- **D (tax):**
  - 093 recorded the catalog version.
  - `tds.<s>.charge_on_excess_only`: only 194Q has it, sourced from Note 1(b). computeTds refuses above the threshold without it.
  - /ask end-of-question cue fix (#607).
  - 194Q purchase advice (#608, advice only).
  - ai-ask was redeployed twice. Verified: "194H की दर" → F-lane 2%, "194Q की सीमा" → ₹50,00,000.
- **Backup bundles:** rebuilt to registry 98 in a separate session (#606), with a CI gate `check:edge-bundles`.
- **Open questions for the CA** (each needs an Act/circular URL):
  - (a) Where does the 194Q buyer-turnover gate sit in the 2025 Act?
  - (b) Is GST in the 194Q base?
  - (c) For 194C / 194H above the threshold, is TDS on the whole sum or the excess?
- **Next:** E (payroll TDS cumulative, PAY-01), then F (offline policy), then G1 (old-browser build target).

### 2026-10-02: D5, E, G1 and F1
- **D5 LIVE:** the founder confirmed the figures ("सब सही है और audit हो चुका है"), then applied Bacher's 2024-25 year-transfer from prod-derived SQL (not committed; `D:\SahakarLekha-Backups\b2\d5-*`).
  - Verified: all income/expense accounts read 0 at 01-04-2025.
  - 1208 is Cr ₹75,843.85.
  - Drift is 0.
- **E:** cumulative salary TDS was already wired (verified). The new payroll engine's ledger posting stays off by design, because usage is tiny (1 society, 9 payslips). **E3 (payroll through the posting service) is deferred.**
- **G1 LIVE (#610, deployed 2026-10-02):** runtime polyfills for `.at`, `Object.hasOwn` and `findLast` / `findLastIndex`. These caused 22 + 11 errors in error_log over 14 days.
  - Watch error_log to confirm those errors stop.
  - The "Failed to fetch dynamically imported module" errors (12) come from stale chunks after a deploy. lazyWithRetry already reloads once, so nothing was changed for them.
- **F1 offline policy (founder decision अ, online-only; PR):**
  - **Finding:** supabase-js *resolves* a network failure as `{data:null,error}`, so the catch-block localStorage fallback never ran. An offline load therefore showed ₹0 and empty registers with no warning. The accounts query also fell back to the CMS template and overwrote the device's cached real chart.
  - **Fix:**
    - `lib/connectivity/writeBlock` is the single rule: offline, or any of the 8 core load parts errored, blocks entry. The 8 core parts are vouchers, accounts, members, society_settings, stock_items, stock_movements, sales and purchases. The other 11 parts only warn.
    - The guard lives in guardFYLocked (91 mutations), addVoucher, updateSociety and closeFinancialYear, and in the 5 domain contexts.
    - A non-dismissable OfflineBanner shows the failed parts and a reload button.
    - Back online after a full load, entry reopens automatically. After an incomplete load it needs a reload.
    - Nothing is queued and nothing syncs; `src/lib/offline/` stays unwired.
  - **Also:**
    - With TOAST_LIMIT = 1, a page's unconditional "सहेजा गया" would replace the red refusal, so use-toast drops non-destructive toasts for 3s after a refusal.
    - SocietySetup now shows "saved" only from `onSaved`.
    - The banner is not sticky: the root's `overflow-x-hidden` breaks sticky, and `overflow-x-clip` would regress old Safari, the very audience G1 serves.
  - **Checks:**
    - Prod (read-only): all 19 load tables exist and `authenticated` holds SELECT on them, so no society is blocked permanently.
    - test:offline-write-block 35/35.
    - Browser, with the worktree having no Supabase env, so the load genuinely fails:
      - the banner shows on desktop and mobile;
      - the settings save is refused with the red toast and no false "saved";
      - an offline event switches to the offline message;
      - an online event after an incomplete load stays blocked.
- **Next:** remaining phases G–M. Open CA questions (above) remain.

### 2026-10-02: Phase G (production reliability)
- **F1 LIVE** (#611, deployed `9c650a5`): the live entry bundle contains the banner strings (verified by curl).
- **G8 error_log audit (30 days):**
  - `hasOwn` / `.at` (43 + 29): fixed by G1.
  - ResizeObserver noise (24).
  - About 30 stale-chunk rows reached the ErrorBoundary.
  - 2 sale-post-service duplicate voucherNo rows.
- **G2 (PR #612):** the stale-chunk rows look like crawlers re-rendering cached HTML, not users.
  - Evidence: public pages only; one stale entry (`index-D4K6ozdD.js`) requested across days of deploys; fixed daily times.
  - Found: a missing `/assets/*.js` was served index.html as `200 text/html`.
  - Fix: the SPA rewrite excludes `assets/` (real 404); reportError stamps `ua`; window.error drops ResizeObserver noise.
  - The preview is behind Vercel auth. **Verify after merge:** `curl -I https://sahakarlekha.com/assets/x.js` should return 404.
- **G6 DEFERRED (investigated):** Rania, 2026-09-29 17:30 and 17:34 UTC. `post_stock_document` was refused with `uniq_vouchers_society_no`.
  - RULE 1 held: rolled back, red toast. The retry at 17:48 posted RV/2026/27/915.
  - `_official_doc_no` checks that a number is free before post_voucher inserts it. The max at the time was 914, so 915 was free. A collision needs a concurrent insert that left no row.
  - The read-only prod data cannot prove a root cause. Next step: a harness repro (concurrent `post_stock_document` + `addVoucher` in one society) or the `ua` / society stamp in future rows.
  - Gap: reportError rows carry no `society_id` (all 30-day rows are NULL). Stamping it is a candidate G8 follow-up.

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
| TAX-02 | TDS register / bank-reco delete: console.warn only | fix in PR: rollback + destructive toast on failure OR RLS 0-row refusal, FY-lock guard, a deleted challan unlinks its entries |
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
