# SahakarLekha — Production Readiness Report

> Roadmap §17 (gate) and §18 (report). Written 2026-10-02 at the end of Phases A–M.
> Status words: **READY** · **NEEDS VERIFICATION** · **PARTIAL** · **BLOCKED**. No numerical scores.
> Every status below rests on evidence gathered on 2026-10-02:
> - read-only production queries
> - CI on `main` (2955117, green)
> - the db-harness on prod dumps
> - Playwright on staging and on a production build
>
> Continuity detail: [SAHAKARLEKHA_PHASE2_PROGRESS.md](SAHAKARLEKHA_PHASE2_PROGRESS.md).

## 1. Executive summary

**Verdict: production-usable today, but not "production-ready" by the roadmap's own gate.**

**What is solid:**
- Tenant isolation.
- MFA.
- Server-side posting for 26 of 27 societies.
- Zero ledger drift.
- Server voucher numbering.
- FY rollover and close (on the harness).
- Audit trail.
- Backups.
- The public website.
- /ask safety.

**What stands between this and READY (all named in §14–16):**
1. **The database does not yet enforce server posting.** Any signed-in writer can still insert or update `vouchers`, `voucher_entries`, `accounts` and `ledger_events` directly. Server posting is authoritative only because the client takes that path (S4).
2. **Statutory tax rules still have open CA questions.** They are configurable and sourced where verified.
3. **Payroll ledger posting is off by design (E3).**
4. **The db-harness runs locally only, not in CI.**
5. **Two founder actions are pending:** apply migration 098, and run Redeploy after today's Vercel rate limit.

> **सार (हिन्दी):**
> - Tenant isolation, 2FA, server posting (27 में से 26 समितियाँ), ledger drift 0, voucher numbering, FY close, audit trail, backup और public site — ये सब जाँचे हुए हैं।
> - "Production-ready" कहने से पहले ये बाकी हैं:
>   - database अभी client से सीधे voucher/journal लिखने देता है (S4)
>   - टैक्स के CA प्रश्न खुले हैं
>   - payroll की ledger posting बंद है
>   - harness CI में नहीं है
>   - 098 apply करना और Vercel Redeploy अभी बाकी हैं

## 2. What was fixed (Phases A–M, 2026-09-30 → 10-02)

| Phase | Shipped (all merged; migrations applied by the founder with a backup + undo file) |
|---|---|
| A security | MFA bound to the JWT and session (084/085), TOTP brute-force limit, anon user-admin bypass P0 (086), certificate rename (087), create-order caller check. RLS harness 469/469. |
| B accounting | Unsafe client writes routed through the server (B3 partial), all-society posting rollout (B2), nightly `ledger_drift` (092). |
| C FY | Rollover rule (090), TB opening b/f, `close_financial_year` (091), D5 year transfer. |
| D tax | TDS catalog version + charge basis (093), 194Q advice, TDS/bank-reco delete rollback. |
| E/F | Cumulative salary TDS verified. Online-only write block with banner (F1). |
| G reliability | Old-browser polyfills, real 404 for stale chunks, `ua` and `society_id` on error_log, duplicate-number investigation. |
| H domain audit | Returns outliving cancelled vouchers, half-cancellable share transfers, editable reversals (095), console-only audit, about 30 voucher types cancellable without their document. |
| I testing | Staging project + Playwright e2e in CI (voucher persist / cancel / reports). Server voucher numbering (096) found through e2e evidence. |
| J perf | Initial JS 819 → 465 KB. Logged-out society load 41 → 0 requests. Post-login React commits 81 → 10 (data phase). |
| K architecture | Report computes lifted out of DataContext with equivalence checks: TB, Trading/P&L, R&P, Cash/Bank book, entity links. |
| L SEO | Stale-chunk recovery that cannot loop. Every sitemap URL has its own page. h1/lastmod/description fixes. Broken glossary links. `test:dist` in CI. One source for hub meta. |
| M AI/knowledge | /ask never presents a document as the answer to a regulated question. KPP registry drift fixed. |

## 3. Security status — **READY** (with the P3s listed)
- **P0 open: zero.** SEC-01/02/03 (084/085) and SEC-04 (086) are live. The anon calls to the MFA and user-admin RPCs return 42501, verified from the public internet on 2026-10-01.
- **SECURITY DEFINER functions executable by anon (prod, 2026-10-02):** 11. All were reviewed in A5 and are public or harmless by design: tenant helpers that return null for anon, `increment_blog_view`, `public_reviews`, `verify_certificate`, `issue_certificate` (087-guarded), `register_society` (signup only), `jwt_branch_ok`.
- **Accepted P3s:** `society_users_bootstrap` anon insert; `app_set_my_password` allowed while 2FA is pending (by design); public INSERT into error_log/feedback.
- **Fixed today:** `get_current_society_id` exact-case email match (097, live 13:14 UTC). It had silently refused a mixed-case admin on 20 RLS tables. Evidence: one `ledger_events` 42501 for Assandh at 11:54 UTC; the same voucher's server edit succeeded at 13:15, after 097.

## 4. Accounting status — **PARTIAL**
| Gate item | Status | Evidence |
|---|---|---|
| Posting is server-authoritative | PARTIAL | `society_flags.posting_service` is ON for 26 of 27 societies. The one OFF (SSK, d0dd474f) has 3 vouchers, the last in 2026-07. New societies start ON (089). |
| Client accounting writes blocked | **NOT YET** | RLS lets any writer of the society insert/update `vouchers`, `accounts` and `ledger_events`, and `voucher_entries`/`loans`/`salary_records` are `society_rw FOR ALL`. Blocking is the next dependency-safe step now that posting is ON almost everywhere (roadmap §13: enforce only after server posting works). Remaining client paths: `mergeAccounts`, and flag-off `cancelLinkedVouchers` (B3). |
| Dr = Cr | READY | Σ posted movement = 0 in every society. 0 unbalanced posted vouchers (H audit). |
| Ledger = entries | READY | `ledger_drift()` returns **0 drifting societies** (prod, 2026-10-02). The nightly job succeeded on 2026-10-01 20:30 UTC. |
| Reports = ledger source | READY | T-09 cutover: statements read the journal. K1–K5 equivalence checks found 0 mismatches. |
| Voucher numbering | READY | 096: gapless server numbers inside `post_voucher`; 47 sequences, 0 off their series max. |

## 5. Database / RLS status — **READY**
- 116 public tables, **0 without RLS** (prod, 2026-10-02).
- Harness a6: all 104 society tables × read/update/delete/insert-copy/move, as S1 against S2, plus anon and a stranger: **469/469**.
- Migrations: `app_migrations` reaches 097. **098 is merged but NOT applied** (founder action). Until it is applied, a User Management email edit shows "ईमेल नहीं बदला गया" and saves nothing. That is safe, but the feature is unavailable.

## 6. Tax status — **NEEDS VERIFICATION**
- The TDS catalog is versioned (093), and charge-on-excess applies only where sourced (194Q, Note 1(b)). `computeTds` refuses what it cannot source.
- GST: bill tax equals ledger 2201/3310 to the paisa in every taxed society (H4).
- **Open CA questions (each needs an Act/circular URL):**
  - Where is the 194Q buyer-turnover gate in the 2025 Act?
  - Is GST in the 194Q base?
  - Is 194C/194H above the threshold charged on the whole sum or on the excess?
- Assandh RCS purchases: ₹16.19 lakh ITC was taken with no RCM liability. This is a data note for the society's CA.

## 7. Payroll status — **PARTIAL**
- Cumulative salary TDS is verified.
- The new payroll engine's ledger posting is **off by design**: usage is 1 society and 9 payslips, and E3 (payroll through the posting service) is deferred.
- Legacy salary edits repost the journal (B3).

## 8. Offline status — **READY**
- Policy: online-only (founder decision अ).
- When offline, or when any of the 8 core load parts fails, entry is blocked everywhere, with a non-dismissable banner. Nothing is queued.
- Verified in a browser, and by `test:offline-write-block` 35/35.

## 9. Domain module status — **READY (audited), low usage**
- Trading, GST, members/share capital, cash/bank/TB, governance, dairy, housing, labour, consumer and marketing were all traced end to end (H). The bugs found are fixed (#620–#625, 095).
- Real usage is small (procurement 3 lots, housing 3 flats, dairy 0, loans 0), so these modules have had little production exercise.

## 10. Testing status — **PARTIAL**
- **CI on every PR:**
  - the full pure `test:*` set (314 suites)
  - tsc
  - the edge-bundle gate
  - `npm run build` + `test:dist`
  - Playwright e2e on staging: RULE 1 persist, cancel, TB/Trading/P&L/R&P/books, and the public-page specs
- **The db-harness (25 suites: RLS, posting, FY, drift …) runs locally only,** on prod dumps; the repo is public, so prod data cannot go to CI. Moving it to staging needs a `STAGING_DATABASE_URL` secret.
- Known flake: `test:ucas-rules` crashes on Windows libuv exit inside the local loop only. A separate session is investigating.

## 11. Performance status — **READY**
- Measured on a production build:
  - initial JS 465 KB (was 819)
  - 0 society requests while logged out
  - 60 requests after login (was 82)
  - 10 React commits in the data phase (was 81)
- What remains is the recharts entry animation, a visual choice.

## 12. SEO status — **READY**
- 376 sitemap URLs were rendered in a headless browser. On every one:
  - own canonical
  - no redirect
  - no noindex
  - one h1
  - valid JSON-LD with the required fields
  - no duplicate title or description
  - static and rendered meta identical
- `test:dist` gates all of this in CI.
- Content backlog: 262 glossary terms are linked but missing; 92 titles run over 70 characters.

## 13. AI / knowledge status — **READY (retrieval only)**
- /ask is retrieval only (`model: null`).
- eval: top-1 83.2%, top-6 97.9%, 0 dead ends.
- Regulated specifics are refused, by the seam and now by the page during its fallback.
- 109 KIs, all Level A, with no hidden statutory specifics.
- **No LLM generation, and none should be added:** primary-source evidence records (KAE) were never created (roadmap §13: no AI on unverified statutory knowledge).

## 14. Remaining limitations
1. Client accounting writes are not blocked by the database (S4). Highest priority.
2. Platform PITR is off and platform backups are null. Recovery relies on:
   - manual full `pg_dump` (latest 2026-10-02 07:26Z, restore-verified procedure)
   - the weekly per-society backup + restore rehearsal cron (last run 2026-09-27, succeeded)
   - **the storage bucket `backups` (262 files) is not in the dump**
3. FY carry-forward (C6/C7) still uses the client snapshot (`previousYearBalances`). `close_financial_year` proves opening = closing on the harness, but no server opening event exists yet, and no real society has closed a year through 091 in production.
4. A permanent flake budget for the e2e cancel spec (diagnostics kept, #631/#643).

## 15. Deferred items
- B4–B6, B8–B10 (not started).
- C6/C7 server carry-forward.
- E3 payroll posting.
- G6 duplicate-number root cause (likely 096).
- G7 (no evidence in 60 days).
- `src/lib/offline/` (unwired by policy).
- db-harness in CI.
- KAE evidence records (E2 → E3).

## 16. Required human / domain verification
- **CA:** the three TDS questions (§6); the Assandh RCM/ITC note.
- **Founder data actions (in the app, no SQL):**
  - delete Rania's SRET/PRET/2026-27/001
  - enter Rania's audited share-capital opening (₹32,150 short)
  - review 06cea2fb's half share-transfer
  - review Kisan's ₹2,400 opening imbalance
- **SME/legal:** every Level-B/C/D KI before activation; sourcing the KAE evidence records.

## 17. Production deployment checklist
1. [ ] **Vercel Redeploy** of `main`. #665 and #668 are merged but rate-limited: live /guide still shows the old title.
2. [ ] **Apply 098** (`scripts/apply-sql.ps1`, after `scripts/backup-prod.ps1`). Then check that an email edit in User Management succeeds.
3. [ ] Confirm the next nightly drift run (02:00 IST) logs 0, and that the weekly backup and rehearsal (Sunday 02:00/03:00 UTC) succeed.
4. [ ] Design and approve S4: database-level refusal of direct client writes to `vouchers`/`voucher_entries`/`ledger_events` for posting-ON societies. Do the migration on the harness first, then staging, then prod with a backup + undo file.
5. [ ] Add `STAGING_DATABASE_URL` to GitHub secrets, so the db-harness can run in CI.
6. [ ] Get the CA's answers, with sources, and update the TDS catalog.
7. [ ] Decide on storage-bucket backups, and on enabling PITR (paid plan).
