# Report Data Reconciliation

Test log: `REPORT_AUDIT_EVIDENCE/fragments/_A_testlog.txt`. Runtime/production-data checks are UNVERIFIED unless stated.


---

## Slice A — statements reconciliation & test results


Method: read the formulas (cited file:line), ran the existing npm test scripts (output below, run 2026-10-03 on branch feat/registers-show-returns, tail of each run saved in fragments/_A_testlog.txt), then reasoned over code. No source modified. Anything only runtime/prod data can prove is marked UNVERIFIED.

## 1. Test results (all executed here)

| Script | Result |
|---|---|
| test:ledger-trial-balance | 10 passed, 0 failed |
| test:ledger-report-parity | 26 passed, 0 failed |
| test:trading-account | 10 passed, 0 failed (pure helpers only) |
| test:reports-statements-wiring | 12 passed, 0 failed |
| test:statement-selection | 22 passed, 0 failed |
| test:money-tb | 17 passed, 0 failed |
| test:ledger-cash-book | 12 passed, 0 failed |
| test:ledger-receipts-payments | 12 passed, 0 failed |
| test:accounting | 23 passed, 0 failed (tests a JS MIRROR of voucherImmutability, not the real module: scripts/test-accounting.mjs:1-3) |
| test:ledger-split-tb | 14 passed, 0 failed |
| test:ledger-parity | 11 passed, 0 failed |
| test:ledger-rp-classify | 15 passed, 0 failed |
| test:ledger-member-ledger | 9 passed, 0 failed |
| test:ledger-aggregate-state | 9 passed, 0 failed |
| test:ob (opening balances) | 22 passed, 0 failed |
| test:appropriation | 15 passed, 0 failed |
| test:soft-delete | 10 passed, 0 failed |
| test:year-close | 11 passed, 0 failed |
| test:period-lock | 13 passed, 0 failed |
| test:rp-label | 13 passed, 0 failed |
| test:money | 42 passed, 0 failed |

Total 21 scripts, 0 failures. Coverage caveat (A-18): none of these imports `getTrialBalance`, `getProfitLoss`, `getTradingAccount`, `getReceiptsPayments` or the BS/I&E page assembly from DataContext (grep of scripts/ shows only ledger-lib and money tests reference those names). They prove the pure libraries and projections, not the page-level numbers. Passing tests therefore do NOT show that findings A-01, A-02, A-04, A-05, A-06 are absent; those sit in untested code.

## 2. Code-reasoned integrity checks

| Check | Verdict | Evidence |
|---|---|---|
| Voucher debit = credit at entry | ENFORCED at add (float sum, tolerance 0.01, but residual < Rs 1 is silently plugged into the largest line) | DataContext.tsx:1780-1810; validation.ts:169-176 |
| Voucher debit = credit at edit | WEAK: only blocks diff >= 1, so 0.01-0.99 imbalance can be saved | DataContext.tsx:2130-2142 |
| Trial Balance Dr = Cr | Holds by construction if every voucher balances and openings are two-sided; page reports "balanced" when |diff| < Rs 1 (masking). Orphan/group-account legs added as synthetic rows keep it balanced | TrialBalance.tsx:77; DataContext.tsx:4749-4811 |
| Opening + movements = closing | Per account: yes in `getTrialBalance` (paise arithmetic, openingDr/Cr + txnDr/Cr, 4768-4789). Cash/Bank Book running balance: correct inside getter; page header rows wrong when filtered (A-05). R&P closing recomputed independently from vouchers (5237-5256) so R&P closing == TB cash+bank only if both use same voucher set (they do: activeVouchers) | as cited |
| Balance Sheet balances | Assets = (leaf Dr balances, sign-reclassified) + unposted stock; Liabilities = Cr leaves + net profit. Ties when TB balances AND stock rule is consistent. Diagnostic shows opening/txn gaps (BalanceSheet.tsx:145-155). Stock rule inconsistent when ledger stock O>0 (A-02) | BalanceSheet.tsx:121-155 |
| Net surplus consistency P&L vs BS | Both use `getProfitLoss(asOn)` -> same TB date. OK. Both cumulative from inception (A-01) | BalanceSheet.tsx:63-65 |
| Date inclusivity | TB/R&P: `date <= asOn` inclusive; Cash/Bank/Ledger: `>= from` and `<= to` inclusive; DeletedVouchers `to` uses T23:59:59 inclusive; BRS `<= asOfDate` inclusive but ignores clearedDate (A-07). String YYYY-MM-DD comparison, no timezone parsing, so no off-by-one risk found | DataContext.tsx:4749-4751, 4638-4651; Ledger.tsx:83-86; DeletedVouchers.tsx:42-47 |
| Soft-deleted vouchers | Context excludes isDeleted in `activeVouchers`; Ledger/DayBook/BRS/Audit Cert/Nabard/Federation re-filter raw state (isDeleted only) | DataContext.tsx:4462; A-03 |
| Rejected vouchers | Excluded in context; INCLUDED in Ledger, Day Book, BRS, Audit Certificate, NABARD, Federation, Vouchers export (A-03, E-06) | |
| Pending (maker-checker) vouchers | Excluded in context only when `society.approvalRequired`; same bypass in raw-voucher pages | DataContext.tsx:4465 |
| Cancelled/reversed vouchers | Cancel = isDeleted soft-delete with journal reversal (tests: soft-delete 10/10, voucher-reversal not run here). Listed in DeletedVouchers | DataContext.tsx:2329-2405 |
| Draft status | No "draft" voucher state exists; only approvalStatus pending/approved/rejected (types/index.ts:79,211) | |
| FY opening carry-forward | NOT a true carry-forward: rollover snapshots closing into previousYear* and leaves vouchers/openings as-is; nominal accounts never closed; yearClose engine unwired; applying audited openings while old vouchers remain risks double counting (A-01). UNVERIFIED on prod data | SocietySetup.tsx:307-343; OpeningBalances.tsx:119-176; lib/rules/yearClose.ts |
| Surplus / appropriation | Net surplus shown in full on I&E and BS; appropriation vouchers Dr 1208 / Cr funds read by narration text containing FY string (A-11). Reserve % default 25 and education 1% are indicative only in UI | ProfitLoss.tsx:58-80 |
| Rounding | Context aggregates in integer paise (money.ts, tests pass). Pages re-sum in float for totals/diff (A-14); BS/TB tolerance Rs 1 (A-09); Multi-Society whole-rupee rounding (A-15). Ledger.tsx running balance is float | |
| Tenant filtering | Data loaded per society through context (society-scoped load); BRS reads `bank_reconciliations` with `.eq('society_id')` (BankReconciliation.tsx:83); super-admin RPCs server-gated (mig 020). RLS is stated LIVE in project memory; not re-verified here. UNVERIFIED at DB level | |
| Branch scope | Openings only in Head Office scope (DataContext.tsx:4475-4480) honoured in TB/R&P/Cash/Bank; NOT honoured by Cash/Bank page header rows (A-05) or BRS opening | |
| Closing stock formula parity (RULE 2) | Trading A/c uses `reconcileMovements` + `computeStockValue` (5420-5425); BS uses `getTradingAccount().physicalClosingStock`; consistent source. Posted-journal detection is narration-text based (A-10) | |
| Ledger-journal cut-over parity | When `ledgerReadsEnabled`, TB/CashBook/BankBook/R&P/MemberLedger served from event log only if `ledgerParity` matches, else fall back to vouchers (DataContext.tsx:4742-4747, 5333-5387); tests pass | |

## 3. Reconciliation identities to test on real data (UNVERIFIED — need prod/read-only query)
1. Sum(TB closing Dr) == Sum(TB closing Cr) as on FY end per society (the app's own check uses tolerance Rs 1).
2. TB cash row closing == Cash Book last running balance == R&P closing cash == Reports-hub cash.
3. BS total assets == BS total liabilities (+ net profit) — compare stored `getLedgerReportParity` snapshots if exposed.
4. FY2 I&E total income vs sum of FY2-dated income vouchers (detects A-01 on multi-FY societies).
5. Closing stock: Trading A/c `totalClosingStock` vs `physicalClosingStock` when opening stock on 3400 accounts > 0 (A-02).
6. Count of vouchers with `approvalStatus='rejected'` per society and diff of Ledger vs TB for affected accounts (A-03).
7. Societies where `financialYearStart` year != FY first year (A-12).

None of these could be executed here (no prod access in this task).

## 4. Summary of integrity risk
- Mechanical arithmetic (paise, TB/BS ties, journal parity) is well covered and passing.
- The material risks are definitional: cumulative-from-inception basis and unwired year-close (A-01), stock opening/closing rule (A-02), pages that re-implement balances from raw vouchers (A-03, A-04, A-05, A-06, A-07), and false-success UX on refused saves (U-01).
