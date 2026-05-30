# SahakarLekha Portal — NCDC Cooperative Accounting Compliance Audit Report

**Audited Entity:** SahakarLekha Portal (sahakarlekha.com) — Marketing + Processing Cooperative Accounting System (CMS)
**Standard:** NCDC Cooperative Accounting Standards (Annexures I–VII), read with Haryana Cooperative Societies Act, 1984
**Report Date:** 30 May 2026
**Method:** 10 dimensions independently audited + adversarially verified (21-agent audit), rejected findings removed.

---

## 1. Executive Summary

The portal is a functionally rich, double-entry-based cooperative accounting system with a comprehensive 136+ GL chart of accounts. Core mechanics (asset/liability classification, soft-delete filtering, running balances, depreciation, reserve-fund appropriation gates) are largely sound. However, the portal is **not yet audit-ready** for a marketing cooperative because three structural pillars are weak: (a) **double-entry balance enforcement is absent at save time** — imbalanced multi-line vouchers can be persisted; (b) **activity-wise reporting** (Annexure V) is not implemented — all activities lump into one Trading Account; and (c) the **P&L → Appropriation → Balance Sheet chain is broken** — Gross Profit never flows into P&L, and reserves are UI-computed, never journalled.

**Overall Portal Compliance: ~60%.**
**Verdict: PARTIALLY COMPLIANT — not fit for final statutory audit sign-off until Critical findings are remediated.**

**Issue counts (verified):** Critical: **12** | High: **3** | Medium: **14** | Low: **34**

### Compliance Scorecard

| Dimension | Compliance % | Status | Critical | Medium | Low | High |
|---|---|---|---|---|---|---|
| Chart of Accounts & Ledger Classification | 72% | Partially Compliant | 3 | 3 | 8 | 0 |
| Double-Entry & Voucher Posting Logic | 32% | **Non-Compliant** | 2 | 2 | 3 | 1 |
| Trial Balance (Annexure I) | 62% | Partially Compliant | 2 | 3 | 5 | 0 |
| Trading Account (incl. activity-wise) | 42% | Partially Compliant | 2 | 3 | 2 | 0 |
| Profit & Loss / Income & Expenditure | 42% | Partially Compliant | 3 | 1 | 1 | 1 |
| Balance Sheet (Annexure IV) | 62% | Partially Compliant | 1 | 3 | 4 | 0 |
| Cash/Bank Book & Bank Reconciliation | 72% | Partially Compliant | 1 | 1 | 8 | 0 |
| Stock / Inventory Accounting | 68% | Partially Compliant | 0 | 4 | 6 | 0 |
| Receipts & Payments (R&P) | 60% | Partially Compliant | 2 | 1 | 5 | 0 |
| Depreciation, Reserve Fund & Appropriation | 92% | Partially Compliant | 0 | 1 | 9 | 0 |

---

## 2. Critical Findings (all dimensions)

### C-1 — No Dr=Cr balance enforcement at voucher save *(Double-Entry)*
- **A. Observation:** `validateVoucher()` validates account existence and voucher-type rules but does **not** accept or check `voucher.lines`; it cannot compare Dr total vs Cr total. Imbalanced multi-line vouchers are saveable. `src/lib/validation.ts:40-144`.
- **B. Book Ref:** NCDC double-entry — *"All transactions will have a debit and a credit voucher for equal amounts."*
- **C. Status:** Non-Compliant.
- **D. Deviation:** A voucher with Dr ₹100 / Cr ₹95 persists silently → Trial Balance drifts, root cause untraceable.
- **E. Fix:** Extend `validateVoucher` to accept `lines?: VoucherLine[]`; reject save when `|drTotal − crTotal| ≥ 0.01`.
- **F. Correct Format:** `if (Math.abs(drTotal - crTotal) >= 0.01) errors.push('वाउचर असंतुलित है: Dr ≠ Cr')`.

### C-2 — Balance-check helpers are dead code *(Double-Entry)*
- **A. Observation:** `voucherDrTotal` / `voucherCrTotal` defined at `src/lib/voucherUtils.ts:21-27` but **never imported or called** anywhere.
- **B. Book Ref:** NCDC — every voucher must be verified for balance before posting.
- **C. Status:** Non-Compliant.
- **D. Deviation:** No middleware calls these before `persistVoucher()`; portal cannot detect unbalanced vouchers.
- **E. Fix:** Wire them into `addVoucher`/`updateVoucher`, rejecting + rolling back on imbalance (per RULE 1).

### C-3 — Admission Fee (4407) misclassified as equity, excluded from P&L *(COA + P&L)*
- **A. Observation:** Account 4407 is `type:'equity'`, `parentId:'1200'` (Reserves). `getProfitLoss` filters only `type==='income'`, so admission fees never appear in I&E.
- **B. Book Ref:** NCDC Annexure III lists *Admission Fees* as a P&L Cr (income) line.
- **C. Status:** Non-Compliant.
- **D. Deviation:** A ₹5,000 admission fee shows zero income impact.
- **E. Fix:** Reclassify 4407 to `type:'income'`, `parentId:'4400'`; transfer to 1201 via a separate appropriation journal.
- **F. Correct Format:** Receipt: `Dr 3301 Cash / Cr 4407 Admission Fee (income)`; Appropriation: `Dr 4407 / Cr 1201`.

### C-4 — Patronage Rebate (4406) sits in the expense tree *(COA)*
- **A. Observation:** 4406 is `type:'expense'`, `parent:'5400'`, yet tagged `subtype:'other_income'` — self-contradictory.
- **B. Book Ref:** NCDC Annexure III shows Patronage Rebate as a P&L Cr-side income deduction (profit distribution), not opex.
- **E. Fix:** Move to `type:'income'`, `parent:'4400'`, `openingBalanceType:'debit'`; or create an Appropriations group `6000`.

### C-5 — Missing activity-wise Sales/Purchase GL heads *(COA)*
- **A. Observation:** Only 4101 Fertilizer, 4102 Seed, 4103 Consumer Goods exist. No GL heads for Pesticides, PDS (Wheat/Rice/Sugar/Kerosene), Govt Procurement Foodgrains, or Mid-day-meal; 5101 Purchase is generic.
- **B. Book Ref:** NCDC Annexure V mandates separate Trading Accounts per activity.
- **E. Fix:** Add 4104–4110 (sales) and 5102–5108 (purchases) per activity.

### C-6 — Trial Balance has no two-section split *(Trial Balance)*
- **A. Observation:** TB renders one flat list; no **"LIABILITIES & INCOME"** vs **"ASSETS & EXPENDITURE"** sectioning.
- **B. Book Ref:** NCDC Annexure I.
- **E. Fix:** In `getTrialBalance` tag each row with `section` by type; render two grouped tables with subtotals in page + PDF.

### C-7 — One lumped Trading Account; no activity-wise statements *(Trading)*
- **A. Observation:** `getTradingAccount` aggregates all 4100 sales into one array; no activity breakdown.
- **B. Book Ref:** NCDC Annexure V — activity-wise Trading Accounts are a **primary** reporting requirement for marketing societies.
- **E. Fix:** Group by activity; return `activities[]` with per-activity gross profit; add per-activity tabs.

### C-8 — Closing-stock journal credits Purchases (5101) *(Trading)*
- **A. Observation:** `postClosingStock` posts `Dr 3403 / Cr 5101`, reversing purchases.
- **B. Book Ref:** NCDC Annexure II — Closing Stock is a **separate Cr line**, not a purchase reduction.
- **E. Fix:** Credit a dedicated 5150 "Closing Stock Adjustment" or 1208 Surplus instead of 5101.

### C-9 — Gross Profit never carried into P&L *(P&L)*
- **A. Observation:** `getProfitLoss` aggregates only income/expense GL accounts; the `getTradingAccount` gross profit is never injected.
- **B. Book Ref:** NCDC Annexure III — P&L Cr side opens with *"Gross Profit from Trading."*
- **D. Deviation:** A society with ₹5L sales / ₹3.5L purchases shows ₹0 income, hiding ₹1.5L implicit gross profit.
- **E. Fix:** Call `getTradingAccount(asOnDate)`, prepend synthetic income line `{name:'Gross Profit from Trading', amount: grossProfit}` into `incomeItems`.

### C-10 — Reserve appropriation is UI-only, not journalled *(P&L + Balance Sheet)*
- **A. Observation:** P&L hardcodes 25% statutory reserve as a *display* line; no journal moves surplus to reserve accounts.
- **B. Book Ref:** NCDC Principle (l) + Annexure III — appropriation is **separate** from P&L and posted by journal.
- **E. Fix:** Route through `postSurplusAppropriation(fy, …)` posting `Dr 1208 / Cr 1201, 1211…`; P&L and BS read ledger balances, not hardcoded percentages. *(The journal engine already exists in `ReserveFund.tsx`/`ProfitDistribution.tsx`; defect is P&L/BS pages compute inline.)*

### C-11 — R&P mixes accrual entries with cash basis; no GL-head/type field *(R&P)*
- **A. Observation:** `getReceiptsPayments` includes all voucher types touching Cash/Bank, and `ReceiptsPaymentsItem` lacks a `type` field.
- **B. Book Ref:** NCDC Annexure VII — R&P must classify by prescribed GL heads; accrual adjustments must never appear in cash-basis R&P.
- **E. Fix:** Add `type` to `ReceiptsPaymentsItem`; label by GL head; ensure only cash/bank-affecting legs surface.

### C-12 — R&P does not separate Capital vs Revenue receipts/payments *(R&P)*
- **A. Observation:** Flat `receipts[]`/`payments[]`; a govt procurement advance (capital) and a trading sale (revenue) appear identically.
- **B. Book Ref:** NCDC — Capital Receipts shall be distinguished from Revenue Receipts in the R&P Account.
- **E. Fix:** Add a `CAPITAL_ACCOUNTS` set; split into capital/revenue receipts & payments; render Capital | Revenue sections.

---

## 3. High / Medium Findings (by dimension)

**Double-Entry & Posting**
- **High** — Dashboard `bsTallied` uses `< 1` (₹1) tolerance; nothing prevents unbalanced vouchers upstream; tighten to `< 0.01` and enforce Dr=Cr at save.
- **Medium** — Sale/Purchase line construction lacks post-build balance check (rounding/TDS can drift by paise).
- **Medium** — Sale/Purchase *edit* (`updatePurchase`/`updateSale`) reconstruct lines without checking balance.

**Trial Balance**
- **Medium** — Orphaned-line synthetic `[Deleted]` accounts silently mask integrity issues; surface a UI alert.
- **Medium** — PDF lacks Opening/Closing columns (5-col vs Annexure I 6-col).
- **Medium** — CSV/Excel exports omit Opening & Closing Balance columns.

**Trading Account**
- **Medium** — Opening Stock from TB opening debit, not validated against prior-FY closing stock → continuity break on FY transition.
- **Medium** — Direct expenses not sub-classified (salesman salary / godown rent / electricity / insurance / interest) per Annexure II.
- **Medium** — No "lower of cost or market" valuation in closing stock.

**Profit & Loss / I&E**
- **High** — P&L conflates appropriation with operating result (reserve shown as a P&L expense line to force the T-balance); needs a separate Appropriation Account.
- **Medium** — No Provisions for Bad/Doubtful Debts mechanism (accounts 5404/3305 + `postProvisions` missing). Net profit overstated.

**Balance Sheet**
- **Medium** — Unposted physical closing stock added as phantom asset without a journal.
- **Medium** — Total Liabilities via blanket `-b.netBalance` sign inversion — fragile; use natural Dr/Cr per `openingBalanceType`.
- **Medium** — No ledger-vs-physical closing-stock reconciliation between BS and Trading A/c.

**Chart of Accounts**
- **Medium** — Inventory accounts 3401–3406 lack activity-wise segregation.
- **Medium** — Bank account 3302 is a leaf, not a group (no DCCB/SCB/FDR separation per Annexure IV).
- **Medium** — `VOUCHER_TEMPLATES` hardcode 4101/5101, ignoring `StockItem.salesAccountId/purchaseAccountId`.

**Cash/Bank**
- **Medium** — Cash Book exports omit denomination breakdown.

**Stock / Inventory**
- **Medium** — ClosingStockReport hardcodes purchase rate, ignoring per-item FIFO/Weighted-Avg → diverges from StockValuation.
- **Medium** — `valuationMethod` not exposed in Inventory ItemForm.
- **Medium** — No lower-of-cost/market check; `saleRate` unused in valuation.

**Depreciation / Reserve**
- **Medium** — Asset disposal voucher mixes legacy single Dr/Cr with multi-line array.

**R&P**
- **Medium** — `getReceiptsPayments` not called with `asOnDate` on the page; no interim-date R&P picker.

---

## 4. Low / Cosmetic Findings (selected)

- Interest income not bucketed into NCDC "Interest on Loans" vs "Investment Income" heads.
- `previousYearBalances` populated manually; no automated FY-close carry-forward routine.
- BRS lacks "bank charges / interest unrecorded" reconciling items; CSV match is amount-only.
- No physical-count vs book reconciliation UI; editing `openingStock` after movements gives no warning.
- Member-loan disbursement typed `'payment'` instead of `'journal'`.
- AssetRegister header label says "(SLM method)" though WDV is supported.

---

## 5. Top Priority Remediation Plan

1. **Enforce Dr = Cr at save time** (C-1, C-2). Wire `voucherDrTotal/voucherCrTotal` into `validateVoucher`, `addVoucher`, `updateVoucher`, `addSale/addPurchase` (+ updates). Reject + roll back per RULE 1. *Single highest-impact fix — guarantees every downstream report tallies by design.*
2. **Repair the P&L → Appropriation → Balance Sheet chain** (C-9, C-10). Inject Gross Profit into `getProfitLoss`; route reserves/dividend through journal-based appropriation; P&L and BS read ledger balances, not hardcoded 25%.
3. **Fix the closing-stock journal** (C-8). Stop crediting 5101 Purchases; credit 5150/1208.
4. **Implement activity-wise COA + Trading Accounts** (C-5, C-7). Add 4104–4110 / 5102–5108, group `getTradingAccount` by activity, route via `StockItem.salesAccountId/purchaseAccountId`.
5. **Reclassify 4407 & 4406** (C-3, C-4).
6. **Make Trial Balance Annexure-I compliant** (C-6). Two-section split + Opening/Closing columns.
7. **Make R&P cash-basis & classified** (C-11, C-12).
8. **Cash-denomination breakdown** for Cash Book closing balance.

---

## 6. Strengths / Compliant Areas

- **Sound account classification:** Assets (debit), Liabilities/Equity (credit), Income (credit), Expenses (debit), Accumulated Depreciation as contra-asset — all correctly typed per Personal/Real/Nominal rules.
- **Robust soft-delete discipline:** `activeVouchers = vouchers.filter(v => !v.isDeleted)` consistently applied; cancellation removes both Dr and Cr legs together.
- **Correct voucher-type rules:** Receipt (Dr Cash/Bank), Payment (Cr Cash/Bank), Contra (both Cash/Bank) strictly enforced.
- **Reliable Cash/Bank running balances** reconciling across Cash Book, Bank Book, Trial Balance, Balance Sheet via a single `getAccountBalance`.
- **Balance-tally guards** on Trial Balance, Balance Sheet (blocks PDF if unbalanced) and R&P.
- **Depreciation & appropriation engine (strongest, 92%):** SLM/WDV supported, land excluded, depreciation posted as proper journals, idempotent per FY; reserve fund posted as appropriation journals; **Section 65 gate blocks dividend until statutory appropriations are posted.**
- **Movement-based closing-stock quantity formula** applied uniformly (avoids phantom `currentStock` drift).

---

*Prepared by the Lead Cooperative-Society Auditor (automated multi-agent audit). Critical findings must be cleared and re-tested before the portal is used to produce statutory year-end statements for RCS/NCDC audit submission.*
