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

## Current position (2026-10-02, end of day)
- **Phases A–M processed.** The final gate and report are in [SAHAKARLEKHA_PRODUCTION_READINESS_REPORT.md](SAHAKARLEKHA_PRODUCTION_READINESS_REPORT.md).
- **Verdict:** production-usable, but not yet READY. The blockers are:
  - S4: the database still accepts direct client accounting writes
  - open CA tax questions
  - E3 payroll posting is off
  - the db-harness is not in CI
- **Founder actions open:**
  - Vercel Redeploy (#665/#668 are rate-limited)
  - apply 098
  - Rania: delete its 2 returns, and enter its audited share-capital opening
  - answer the CA questions
- **Next dependency-safe task:** S4 design. The database refuses direct client writes to `vouchers`, `voucher_entries` and `ledger_events` for posting-ON societies, with the work done on the harness first, then staging.

## 2026-10-03: 098 LIVE; CA tax answers checked against the Act's text
- **098 LIVE** (founder: backup `sahakarlekha-prod-20261003-0343Z.dump`, then "SQL OK").
  - Verified read-only: the migration row (03:53 UTC); `app_update_society_user_email` is SECURITY DEFINER; anon cannot execute it, authenticated can; 0 mixed-case emails.
- **CA answers, each read against the text on incometaxindia.gov.in** (s.393 and s.402 of the 2025 Act; CBDT Circular 20/2021):
  1. **The 194Q buyer gate is real.** The figure is right but the CA's cite was wrong: they pointed to "393(1) entry 6(i)", which is the contractor row. The gate lives in **s.402(6) Table Sl. 1, the definition of "buyer"**: preceding-year turnover above ₹10 crore. It is now VERIFIED, and recorded but not enforced: the advice states the condition.
  2. **GST in the 194Q base:** Circular 20/2021 para 5.2.1 (restating 13/2021 para 4.3.2) excludes GST only when it is shown separately **and** TDS is deducted on credit. On a payment basis, TDS is on the whole amount; the CA's answer missed this half. It is a 1961-Act circular, and its continuity under the 2025 Act has not been read, so it is recorded UNVERIFIED.
  3. **Whole sum, not excess:** s.393(1)(a), "on the entire amount… where the amount or aggregate… exceeds the threshold". `charge_on_excess_only = 0` for 194H/194C/194J/194I. computeTds now computes these, and also checks 194C's ₹30,000 single-payment limit (`paymentMinor`).
- **NEW finding, 194A downgraded:** ₹50,000 / ₹1,00,000 is the banking-payers row (5(ii)).
  - A non-banking society falls under 5(iii), with a ₹10,000 threshold.
  - s.393(4) Sl. 7(b) exempts interest a non-bank co-operative pays to its members or to other co-operatives (unless turnover exceeds ₹50 crore).
  - The rate is "Rates in force".
  - It is now UNVERIFIED, so the F-lane and computeTds refuse instead of telling a PACS ₹50,000.
- All CA_CHAIN cites were replaced by the text's own words plus the URL.
- **099** records catalog version `98270a8826d27783` (22/26, 21 verified / 5 unverified).
- **ai-ask needs a redeploy** after merge (the ask-core bundle changed).

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
- D: slices live (093, 194Q advice); CA questions open.
- E: cumulative salary TDS verified; E3 deferred.
- F1: COMPLETE.
- G: COMPLETE (G6/G7 deferred with evidence).
- H: COMPLETE (see the 2026-10-02 H sections).
- I–M: processed (see their dated sections; final gate in the readiness report).

### Phase H — summary (2026-10-02)
| Area | Result | PR |
|---|---|---|
| Trading: sales/purchases ⇄ vouchers, stock, returns | consistent; FOUND returns outliving cancelled vouchers | #620 |
| GST (H4) | bill tax = ledger 2201/3310 to the paisa | (audit only) |
| Members / share capital | FOUND share transfer half-cancellable | #621 |
| Cash / bank / TB | FOUND reversal voucher editable (client + server) | #622 + mig 095 LIVE |
| Governance / audit trail (H11) | FOUND bill edits + 4 deletes audited to console only | #623 |
| Domain modules (dairy, housing, labour, consumer, marketing) | FOUND ~30 voucher types cancellable without their document; deletes ignored refused cancels | #624, #625 |
| Data notes for the founder | Rania share capital not in books (₹32,150 short); 06cea2fb half transfer; Kisan opening imbalance ₹2,400; Demo Labor edited reversal | — |

### Phase I — assessment (2026-10-02, awaiting a founder decision)
- **Have:**
  - 302 pure `test:*` suites run in CI, along with tsc and the edge-bundle gate.
  - Vercel previews act as the build check.
  - 24 db-harness suites (RLS a6, posting service s3*, FY c1/c2, drift b7, 095…) pass **locally only**, because they need a prod dump and the repo is public, so prod data can never be in CI.
- **Gaps:**
  - I6/I7: no E2E (Playwright) framework.
  - I2/I9: the harness is not in CI. The repo's schema sources can't bootstrap a fresh DB (known circularity), so CI has no database to test against.
- **Decision needed:** an E2E or harness run needs a non-prod backend. Options:
  - **(a) Free staging Supabase project.** Schema only, no prod data, plus seeded demo societies. Its URL/keys become GitHub secrets. This unblocks both E2E and harness-in-CI.
  - **(b) E2E with a mocked network** (no backend). UI flows only, so lower value.
  - **(c) Defer I** and move to J (performance).


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

### 2026-10-02: Phase G closed, Phase H started (H4 trading/GST)
- **G CLOSED.**
  - Shipped: G1 #610, G2/G8 #612, G8 #613, G4 #614 and G3 #618.
  - G5 is covered by F1, G3 and G4.
  - Deferred: G6 (no proof yet) and G7 (no evidence in 60 days).
  - error_log is quiet: 0 rows in the 6 hours after the deploys.
- **H prioritised by real usage (prod row counts):** vouchers 3141, members 506, sales/purchases/movements 233/91/420, returns 7+7. The domain modules are nearly empty (procurement 3 lots, housing 3 flats, dairy 0, loans 0). So H starts with trading/GST.
- **H4 read-only audit (prod):**
  - Every live sale and purchase has a live voucher. Every deleted one has a cancelled voucher. All amounts match.
  - Stock: 8 items show `currentStock` cache drift and 3 orphan sale/purchase movements. Neither is user-visible: every surface (Inventory, Closing Stock, Valuation, Dashboard, Sale, Retail, Trading A/c) uses `reconcileMovements` (live records), and nothing reads the cache.
  - Returns: every return's adjustment qty matches its items, and deleted returns are netted by `/REV` movements.
  - **FOUND:** 2 Rania returns (SRET/PRET/2026-27/001) are LIVE while their vouchers were cancelled from the voucher screen ("Cancel Due to Wrong Entry", 2026-10-01). Their sale and purchase had been deleted under them.
- **Fix (PR):**
  - `cancelVoucher` refuses `sale.return` / `purchase.return` unless called with `viaParent` (the Returns page). An already-cancelled voucher is now a no-op success.
  - Return delete/edit abort if their voucher stays live.
  - deleteSale/deletePurchase refuse while a live return exists. They now return a boolean, and the pages say "deleted" only when it ran.
- **Data cleanup (founder / Rania, after deploy, via the app — no SQL):** delete SRET/2026-27/001 and PRET/2026-27/001 from the Sales/Purchase Return pages. The cancel becomes a no-op, the `/REV` stock movement is written, and the row is marked deleted.

### 2026-10-02: H, members / share capital / core vouchers (read-only prod audit)
- **Clean:**
  - 0 unbalanced posted vouchers.
  - 0 live vouchers of a deleted member.
  - 0 duplicate live member numbers.
- **FIXED (PR #621):** a share transfer (two journals bridged by Suspense 9999) could be half-cancelled from the voucher screen.
  - In 06cea2fb (2026-07-11) the transferor half was cancelled with reason "s", leaving Dr 9999 / Cr 1102 ₹5,000 live.
  - Both halves now carry `refType 'share.transfer'` + one id. `cancelVoucher` refuses a half (legacy halves are recognised by narration) and points to a reverse transfer.
  - The 06cea2fb data is left for the founder (2-member society; it also has a Dr 1102 / Cr 4403 ₹40,000 payment that looks like experimentation).
- **FOUNDER DECISION NEEDED: Rania share capital is not in the books.**
  - Its 455 live members' register shows ₹32,650.
  - Ledger 1100/1101/1102/1103 nets ₹500 (one receipt). Every opening balance is 0 and `previousYearBalances` is empty.
  - So the Balance Sheet understates share capital by ₹32,150.
  - Fix = enter the audited 31-03-2026 share-capital opening (an Opening Balances / opening journal) **from the society's audited BS**. Do not copy it from the register.
- Minor: SSK (d0dd474f) has a ₹500 member scalar and ₹0 ledger (no contact). 45e91c0d has one member's scalar at ₹500 vs ₹250 in vouchers (the society total ties). ShareRegister already shows a per-member reconciliation.

### 2026-10-02: H cash/bank/TB, GST, governance (read-only prod audits)
- **TB:** Σ posted movement = 0 in every society, and 0 lines sit on unknown accounts.
  - Kisan Samriddhi (45e91c0d): the opening balances don't balance (Dr ₹2,400). This is a data-entry note; nothing changed.
- **095 LIVE** (#622; backup `sahakarlekha-prod-20261002-0431Z.dump`; verified: migration row, check in body, anon exec false, drift 0).
  - Cause: a reversal voucher could be edited (Demo Labor Society RV/044, 2,00,000 → 2,50,000 on 2026-07-16; cash went negative to −₹2,42,850).
  - Fix: `isEditLocked` and `edit_voucher` now also lock `reversalOf`.
- **GST (H4 COMPLETE):** for every taxed society, bill tax = ledger 2201/3310 to the paisa (ddcb71c2: sales ₹15,99,393.25 / purchases ₹53,46,386.40).
- **H11 governance:**
  - audit_log records voucher cancel / approve / reverse / reject and bill deletes.
  - Voucher creation and edits are traced by the append-only journal (ledger_events producer) plus `editHistory`.
  - **FOUND:** sale/purchase EDITS and account / salary-slip / supplier / customer DELETES "audited" with `console.info` only. That trail dies in the browser (16 bill-edit cancels in 30 days with no audit row). **Fixed in PR:** they now write `emitAudit` rows. For the bill edits, the row is written before the server/legacy split, so both paths record the edit.
- **Rania returns:** still live, waiting for the founder to delete them via the Returns pages.

### 2026-10-02: Phase I, staging + E2E LIVE (founder decision क)
- **Staging** `sahakarlekha-staging` (ivmrlhjrqtwftdlxajxk, Singapore) was un-paused.
  - The July payroll test fixture was found and inspected: 24 synthetic `dede0000-…` vouchers dated 2027-28. It was dropped.
  - The production **schema with no data** was applied (116 tables / 197 policies / 77 fns, RLS on all).
  - One synthetic seed society was added (`5eed0000-…`, 177 accounts, FY 2026-27 open, posting ON, trial).
  - The access-token hook is enabled, and the test admin `e2e-admin@sahakarlekha.test` was created by the founder.
  - Staging files live in `D:\SahakarLekha-Backups\staging\` and are not in the repo. `apply-sql-staging.ps1` is pinned to the staging ref. Every file refuses a database holding real-society vouchers (verified on the prod copy: refused, 3141 vouchers intact).
- **Playwright e2e** (#627, #628):
  - The config refuses the prod ref.
  - `smoke`: the app renders, and no request reaches prod.
  - `voucher-persist` (RULE 1 end to end): log in → save → reload → still listed.
  - The CI `e2e` job uses 4 `E2E_*` secrets. First green run: 3/3 (run 36975369836).
- **Next in I:** run the db-harness suites against staging in CI (needs a `STAGING_DATABASE_URL` secret), plus more E2E flows (sale/purchase, year close).

### 2026-10-02: I7 cancel flow; NEW finding — voucher numbering is client-side
- **E2E (#629):**
  - `voucher-cancel` (RULE 3): cancel with a reason → reload → listed under Cancelled.
  - E2E now runs on a **production build** (`vite preview`). The dev server's dependency re-optimisation force-reloaded the page and aborted an in-flight cancel_voucher (seen in the trace).
  - CI result: 4/4.
- **FOUND (prod, P1): voucher numbers are not server-sequenced.**
  - The format is `RV/2026/27/NNN` (4 parts, because the FY is rendered with a slash), so `_official_doc_no` skips the server sequence. That sequence only handles BOOK/FY/SEQ.
  - The number is therefore the client's provisional one, or the max+1 fallback.
  - Evidence (7f2919f0, last 30 days): RV 1783 → 1863 → 1884 …; it went backwards to 289 / 292 / 293 on 09-22, then back to 1931. `document_sequences` has no RV/PV/JV book. Rania JV: 5 vouchers over a 165-wide span.
  - This is the likely root of the G6 duplicate-number refusal.
  - The fix needs a prod migration: seed the sequences from the current max per prefix, then let `_official_doc_no` sequence 4-part prefixes. **Awaiting founder approval.**

### 2026-10-02: 096 server voucher numbering LIVE (founder: "system over society data")
- **Founder direction:** stop chasing individual societies' manual data. Prod anomalies are evidence only; fix the system.
- **096 LIVE** (#630; prod backup `sahakarlekha-prod-20261002-0726Z.dump`; also applied to staging with 095).
  - `post_voucher` issues the official number inside its transaction (gapless).
  - 4-part `RV/YYYY/YY/NNN` numbers are now sequenced.
  - Sequences are seeded from current maxima.
  - anon is off `next_document_number`.
- **Verified read-only:** migration row present; post_voucher numbers; anon exec false; drift 0; **47 voucher sequences, 0 differing from their series max**.
- **E2E:** green on main with 096.
  - A rare post-cancel full reload (2 runs) aborted `cancel_voucher`.
  - It did not reproduce in 5 later runs.
  - #631 keeps permanent diagnostics in the cancel spec.

### 2026-10-02: Phase J (perf) closed, Phase K (architecture) started
- **J results, measured on a production build:**
  - J1: chunk split. Initial JS per page went from 819 to 465 KB.
  - J2: lazy blog bodies. Landing and blog pages are −50%.
  - J6: no society load while logged out. Public-page requests went from 41 to 0.
  - J6b (#642): capability-gated Housing, Labour and Dairy loads. Post-login requests went from 82 to 60.
- **#643:** e2e waits for the save/cancel RPC before reloading. A CDP initiator log stays in the cancel spec.
- **K1 (#646):** `getTrialBalance`'s voucher-state compute moved verbatim to `src/lib/reports/trialBalance.ts`.
  - DataContext keeps the T-09 source decision.
  - A one-off randomized old-vs-new check ran 400 cases with 0 mismatches.
  - New `test:trial-balance` and `e2e/trial-balance.spec.ts` (balanced on staging).
  - **K approach:** lift pure computes out of DataContext one at a time, each with an equivalence check plus a unit test. No state or behaviour change.
  - **Next candidates:** P&L, Trading A/c, Receipts & Payments, cash/bank books.
- **K2 (#648, merged):** the Trading A/c and P&L/I&E computes moved to `src/lib/reports/tradingAndProfitLoss.ts`.
  - Equivalence check: 500 random books, 0 mismatches.
  - New `test:trading-pl` (19 checks).
  - Two source-pinning tests now read the new module.
  - e2e covers `/trading-account` and `/profit-loss`.
- **K3:** the Receipts & Payments voucher-state compute moved to `src/lib/reports/receiptsPayments.ts`.
  - It also returns the paise openings and bank ids, which the T-09 projection needs.
  - Equivalence check: 500 cases, 0 mismatches.
  - New `test:receipts-payments` (14 checks).
  - e2e covers `/receipts-payments`.
- **K4:** the Cash Book and Bank Book moved to `src/lib/reports/accountBook.ts`.
  - They were the same compute duplicated in DataContext, and now share one core.
  - Equivalence check: 500 cases (2,008 rows), 0 mismatches for each book.
  - New `test:account-book` (13 checks).
  - e2e covers `/cash-book` and `/bank-book`.
- **K5:** the delete pre-check (`getEntityLinks`) moved to `src/lib/entityLinks.ts`.
  - Equivalence check: 14,400 checks, 0 mismatches.
  - **System fix, in its own commit:** the `account` pre-check now counts multi-line `lines`, using the same rule as `deleteAccount`'s guard.
    - Before, Ledger Heads said "no links" for an account used only inside a multi-line voucher, and the delete was then refused.
    - No data was at risk, because the guard itself was right.
  - New `test:entity-links` (13 checks).
- **J5 (#656, #659, merged):** a DevTools-hook probe counts React commits from login to network idle.
  - Batching 32 independent table loads (DataContext 17, Marketing 10, Consumer 5) took commits from 81 to 43.
  - The shared subscription read (3 fetches → 1) brought data-phase commits down to **10**.
  - The remaining roughly 30–50 commits are the dashboard recharts entry animation (chart subtree only). That is a visual choice and was left as is.

### 2026-10-02: Phase L started (SEO / public website)
- **L1, old-browser crashes:** checked error_log read-only.
  - `.at` and `Object.hasOwn` stopped after G1's polyfills (#610). None since.
  - What remains on public pages is about one stale-chunk error per day ("Failed to fetch dynamically imported module"). These come from tabs left open across deploys and still running the old build. `ua` is now logged (#612), so future rows are diagnosable.
  - **Fixed:**
    - J2's article-body loader turned a failed body chunk into "missing post" and silently redirected the reader to /blog. It now reloads once, and if loading still fails it shows a reload message.
    - Shared `lib/chunkReload`: at most one reload per 30 s.
    - The old "clear on success" flag would have looped forever when the page chunk loaded and the body chunk failed. A new e2e test caught this: 14 reloads in 8 s. It now asserts exactly 2 loads.
  - New `test:chunk-reload` (6 checks).
- **L2–L4, public pages + sitemaps:** crawled the live sitemap index, all 8 child sitemaps and all 378 listed URLs (read-only). Every URL returns 200, with no duplicates. Problems found:
  - **18 sitemap URLs had no static file:** /login, /register, /privacy, /terms, /guide/quick-start, /guide/certificate, /guide/verify and 10 quizzes. Crawlers got the homepage template, with the homepage title and canonical "/". So each of these URLs declared itself a copy of the homepage.
    - Fix: the sitemap now lists only pages the prerender actually wrote.
    - The other 16 now get their own head (the same title, description and canonical as their useDocumentMeta) and a short body. Quizzes list their real questions.
    - /login and /register are out of the sitemap (they are app entry points).
    - UserGuide had no meta of its own, so it now sets one.
  - **40 blog posts had no h1** in their static HTML: the markdown has no "# " line. The prerender now mirrors BlogPost, using the post's `title:` as the h1 and stripping the markdown's own heading.
  - **lastmod in the future:** one post has `updated: 2026-10-04`, and that leaked into the homepage, /blog and two sitemap-index entries. Sitemap lastmod and dateModified are now clamped to the build day.
  - **5 guide appendices had an empty meta description** (in the client registry too). They now have Hindi summaries that mirror the existing English ones.
  - `test:dist` now also checks:
    - every sitemap `<loc>` maps to its own file, canonical and title
    - no lastmod is in the future
    - every page has a description and exactly one h1
  - **Still open, for L8:** 392 blog links point to 262 glossary terms that do not exist (for example trial-balance, reserve-fund, audit, cm-pacs). GlossaryTerm sends these readers to the /glossary index. Because of this, `test:dist` still fails, and it is not in CI yet.
- **L8, glossary links:** 392 of the 570 hand-written `/glossary/<slug>` links in blog posts pointed at 262 terms that do not exist. GlossaryTerm sent those readers to the /glossary index.
  - **Fix:** a render-time rule (`src/content/glossaryLinks.ts`). It applies in both GuideMarkdown and the prerender, so no markdown file is rewritten:
    - if the term exists, the link stays as written
    - if an exact synonym exists, the link points to it (4 aliases: registrar ×2, marketing-society, nomination)
    - otherwise the words stay and render as plain text
  - When a missing term is later added to the glossary, its links come back on their own.
  - **The markdown files were deliberately left untouched:** the main checkout has a large set of uncommitted blog edits.
  - Tests:
    - new `test:glossary-links` (12 checks)
    - new e2e test for the rule
    - **`test:dist` now passes and runs in CI** (verify job: `npm run build && npm run test:dist`)
  - **Content backlog:** the most-linked missing terms are cm-pacs ×9, reserve-fund ×7, managing-committee ×6, trial-balance ×5, share-capital ×5, maker-checker ×5 and general-body ×5. Each new term needs its source (statutory-values rule).
- **L5–L7 and L9–L12 audit:** re-crawled all 376 live sitemap URLs, then **rendered every one in a headless browser**.
  - **Clean on all 376:**
    - no redirect
    - canonical = own URL, in both the static HTML and the rendered page
    - no noindex
    - exactly one h1
    - valid JSON-LD with the required fields (BlogPosting, BreadcrumbList, FAQPage, HowTo, DefinedTerm, Article, Course)
    - no duplicate title or description
    - lang is hi-IN
  - The only state page (`/cooperative-software/haryana`) is fine: there is just one state in `states.ts`.
  - **Drift found:** what crawlers first see (static HTML) differed from the rendered page on all 6 hubs and on all 110 glossary terms.
    - The glossary client used the English definition, while the prerender deliberately uses Hindi (for CTR).
    - /guide disagreed on facts: "9 भाग" vs "30 अध्याय". The real numbers are **10 parts and 35 chapters**.
  - **Fix:** `src/content/hubMeta.ts` is the one source, read by both the pages and the prerender (HUB_META + glossaryMetaDescription).
    - New `test:hub-meta` (25 checks). It pins the guide counts to the registry and checks that no private copy remains.
    - A local render of the 6 hubs and 109 terms after the fix: 0 mismatches.
  - **Noted, not changed:**
    - Titles over 70 characters: 63 glossary terms and 29 blog posts. Google truncates them, but they are not wrong.
    - The static bodies of cookbook/help/privacy/terms are shorter than the rendered page. Google renders JS anyway.
    - The 13 app-shell guide pages have no BreadcrumbList.

### 2026-10-02: Phase M (AI / knowledge)
- **M1–M5, the knowledge stack:** 109 active KIs, all Level A, all CENTRAL. 100 are E2† and 9 are E2.
  - By KAE 10, Level A may be active without an SME, so the gate law holds.
  - A scan of every KI body for sections, rules, %, ₹ amounts and due dates found nothing beyond generic Dr = Cr, 1 April–31 March and example face values. No Level-B/C/D specific is hiding in a Level-A KI.
  - The ask-ai-map's KI-000170 is correctly marked "planned".
  - The 50 body references to not-yet-active KIs render as plain labels; there are no broken links.
  - SMRD covers clusters by ranges (C095–C096 …), so no research id is actually missing.
- **M7, drift fixed:**
  - KIs 401–409 (added in #321) were never registered in the KPP registry, and all 9 were stamped `topic_id: C001` (Cooperative society). They are now registered (Wave 1.2) and re-traced to their real clusters (C096, C095, C038, C039, C134, C124, C112, C079, C087).
  - The registry now says 109, not 100.
- **M8, attribution:** /ask names the internal source (शब्दकोश / मदद / …) and links it.
  - **Primary-source attribution does not exist yet.** Every KI's `evidence_id` (EV-…) points to a KAE evidence record that was never created, and no KI cites a primary source.
  - This cannot be generated: per the statutory-values rule it needs real sourcing. It is the path from E2 to E3.
- **M6, /ask:** eval:ask gives top-1 **83.2%** and top-6 97.9%, with 0 dead ends.
  - The 2 wrong answers are the known synonym gap, left deliberately.
  - The seam is live, and its guard refuses regulated specifics (checked live: "आरक्षित निधि कितने प्रतिशत है" → refusal).
  - **Gap fixed:** while the seam was thinking (up to 20 s), or when it was unreachable, the page showed the local top hit as "जवाब · स्रोत: कैलकुलेटर" for a regulated question. The page now runs the same pure `classify()`:
    - regulated + no seam reply → "प्रमाणित स्रोत देखा जा रहा है…", then the same refusal text (`REGULATED_REFUSAL`, now shared with core.ts; ask-core bundle rebuilt)
    - once the seam replies, the seam decides
  - New e2e test with the seam blocked: regulated → refusal, ordinary → answer card.
- **M9:** the eval set (95 answerable + 12 must-not-assert) is in place.
- **M10:** no LLM generation. `model: null` throughout, as intended.

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
