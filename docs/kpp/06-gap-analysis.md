# 06 — Gap Analysis

> Gaps in the **populated** Knowledge Item database (the KPP layer). Distinct from the SMRD/KAE gap
> analyses (which cover research + engine gaps) — this one tracks **KI coverage**: what concepts still
> need a record, duplicates to merge, and missing glossary/software terms. Prioritized for population.

**Priority:** 🔴 P0 (foundational, blocks the graph) · 🟠 P1 (high value) · 🟡 P2 · ⚪ P3.

---

## 1. Missing Knowledge Items (concepts not yet in the registry)

Wave-1 covers the foundational spine (356 KIs). Known coverage gaps to populate next:

| Area | Missing KIs (examples) | Wave | Pri |
| --- | --- | --- | --- |
| **Inventory & stock** | stock item, stock movement, FIFO, weighted-avg, NRV, closing-stock formula, stock register, physical verification, MSP procurement, kachi aarat, HSN | W2 (G18) | 🟠 |
| **Sales & purchase** | cash/credit sale, cash/credit purchase, invoice, ITC, sales return, purchase return, bill-wise settlement, per-item ledger routing | W2 (G19) | 🟠 |
| **Loans & recovery** | loan, disbursement, repayment, simple/reducing interest, EMI, KCC, drawing power, NPA, aging, demand notice, OTS, write-off, subvention | W2 (G20) | 🟠 |
| **Deposits** | savings/FD/RD, interest accrual, maturity, 15G/15H, pigmy | W2 (G21) | 🟠 |
| **Assets & depreciation** | fixed asset register, SLM, WDV, depreciation rate, capitalisation, disposal P/L, capital vs revenue | W2 (G22) | 🟠 |
| **Payroll** | salary, payslip, EPF, ESI, PT, salary TDS, gratuity, honorarium | W2 (G24) | 🟠 |
| **GST** | applicability, registration, ITC, GSTR-1/3B, RCM, e-way, member mutuality, exemptions, HSN rate | W3 (G25) | 🟠 |
| **TDS & income tax** | TDS section/rate, 26Q, Form 16A, 194C/194I/194H, 80P, ITR, advance tax, tax audit | W3 (G26) | 🟠 |
| **Compliance & returns** | annual return, NABARD return, federation report, statutory registers, compliance calendar, penalty | W3 (G27) | 🟠 |
| **Governance** | AGM, quorum, notice, minutes, resolution, board, election, returning officer, byelaw amendment | W3 (G28) | 🟠 |
| **Profit distribution (depth)** | appropriation %, dividend computation, bonus, fund transfers | W3 (G29) | 🟡 |
| **Society-type specifics** | per-type COA/treatment deltas (PACS/dairy/consumer/credit/marketing/housing) | W3 (G30) | 🟡 |
| **State-wise legal variants** | per-`concept_key` state KIs (reserve %, dividend cap, audit class, returns) | W3 (G31) | 🟠 |
| **Digital / AI** | AI assistant, OCR, anomaly detection, recovery scoring | W3 (G32) | ⚪ |
| **Budget / management** | budget, variance, working capital, break-even, viability | W2/W3 | 🟡 |

## 2. Duplicate-concept risks (merge, don't coexist)

| Potential overlap | Resolution |
| --- | --- |
| "Profit & Loss" (KI-000201) vs "Income & Expenditure" (KI-000202) | **keep both** — distinct concepts; add `related` + a "distinction" KI (KI-000220) ✓ done |
| "Net profit/surplus" appears in G09 (KI-000167) and G11 (KI-000203) | **merge** → one canonical (KI-000167); KI-000203 `related`, scoped to "net result line in P&L" |
| "Opening balance" (KI-000051) vs "Opening voucher" (KI-000077) vs glossary (KI-000300) | distinct: concept / process / term — keep, link via `related` |
| "Maker-checker" (KI-000064) vs "Maker-checker audit control" (KI-000261) | **merge** → KI-000064 canonical; KI-000261 → `related` audit-context view |
| "Audit log" (KI-000315) vs "Audit trail" (KI-000253) | **merge** → KI-000253 canonical; KI-000315 = product surface `related` |
| Cash deposit/withdrawal (KI-000111/112) vs cookbook recipes | KI = concept; cookbook = recipe asset (different layer) — keep |

> Action: run duplicate detection (QA Q5, [KAE 08](../kae/08-quality-assurance.md)) before advancing any KI to
> `active`; apply the merges above.

## 3. Missing glossary terms (extend G14 in W2/W3)

Not yet given a glossary KI: तलपट-suspense (निलंबन खाता), घाटा (deficit), प्रावधान done, माल-सूची (inventory),
मूल्यांकन (valuation), वसूली done, अनुदान (grant/subsidy), जमानत/प्रतिभूति (security), बकाया (overdue),
ब्याज-दर (interest rate), कर (tax), जीएसटी (GST), टीडीएस (TDS), बजट (budget), संचालक मंडल (board),
आम सभा (AGM), संकल्प (resolution), निर्वाचन (election), समापन (year-end close), नामांकन (nomination).
→ ~20+ glossary KIs queued.

## 4. Missing software / SaaS concepts (extend G15)

Not yet KI'd: e-way bill, GST summary (module), TDS register (module), Form-16A (module), HSN master,
KCC module, election module, board-of-directors module, NABARD/federation report modules, depreciation
schedule module, asset register module, budget module, deleted-vouchers/recycle, compound voucher,
recoverables register, aging analysis, stock valuation module. → ~17 product KIs queued (map 1:1 to
the ~95 routes in [SCOS Module Index](../scos/02-knowledge-architecture.md)).

## 5. Structural gaps (not concepts — the database plumbing)
- **Definitions unwritten:** all 356 Wave-1 KIs are stubs (`definition` empty) — population step pending.
- **Evidence records (`EV-`) not instantiated** in KAE for each KI — needed for `active`.
- **No KI data store** yet (markdown spec → tables/JSON) — same as [KAE 12](../kae/12-gap-analysis.md) 🔴.
- **SME not engaged** → no B/C/D KI can clear E3 (the universal blocker). Level-A can proceed now.

## 6. Prioritized population sequence
1. 🔴 Write **Level-A definitions** for Wave-1 (no SME needed) → advance ~210 educational/product KIs to `active`.
2. 🔴 Instantiate `EV-` records + stand up the KI store (turns registry into queryable data).
3. 🟠 Engage SME → clear Wave-1 **B** accounting KIs (vouchers, books, TB, statements).
4. 🟠 Populate **Wave 2** (inventory, loans, sales/purchase, assets, payroll, deposits).
5. 🟠 Populate **Wave 3** (GST, TDS/IT, compliance, governance) — all SME-gated.
6. 🟡 Glossary + software-concept extensions; state-wise `concept_key` variants.

---

### Cross-references
[Wave-1 Registry](05-wave-1-registry.md) · [Wave Plan](02-wave-1-plan.md) · [Quality Gates](07-quality-gates.md) · [KAE Gap Analysis](../kae/12-gap-analysis.md) · [SMRD Gap Analysis](../smrd/00-master-research-index.md)
