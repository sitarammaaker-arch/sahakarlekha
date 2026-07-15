# SahakarLekha — Research-Phase Completeness Review

- **Status:** Review. Adversarial completeness pass over the full architecture corpus. Documentation only; no new work created — gaps are *identified*, not designed.
- **Date:** 2026-07-11
- **Documents reviewed:** 5 research docs (`docs/research/`), 10 ADRs (`docs/adr/`), 5 architecture SSOTs (`docs/architecture/`: Canonical Financial Data Model, UCAS, AI Constitution, API Constitution, Digital Preservation Strategy).
- **Method:** each document read against the five requested lenses (architectural decisions, business rules, accounting rules, cooperative-domain concepts, compliance). A "gap" is reported **only** if it is (a) genuinely absent — not merely unimplemented, (b) material to a national cooperative OS, and (c) not already flagged elsewhere in the corpus.

---

> **⚠️ CORRECTION (second pass, 2026-07-11) — see [Part 7](#7-second-pass-correction-full-corpus-review--final).** The verdict below was produced from an **under-scoped** review that read only the 20 documents authored in this workstream and **missed the pre-existing ~26-document research corpus** (`TASK2.*`, `TASK3.*`, `TASK4.*`, `TASK5.*`, `GAP-ANALYSIS-SESSION*`). A full-corpus re-review found that GAP-1, GAP-2, GAP-3 (and GAP-4/GAP-6) are in fact **already covered**. The corrected, final verdict is in Part 7: **the research phase is complete.** Part 1–5 below are retained unedited as the record of the first pass.

## 0. Verdict up front (FIRST PASS — superseded by Part 7)

**The research phase is NOT yet complete.** The corpus is strong and internally consistent on the **financial, data, AI, API, and preservation** axes — but it has **three genuine, material gaps** and a few smaller ones. The largest is that the corpus thoroughly models a cooperative's *money* while barely modeling its *democracy* — and the democratic/governance dimension is the **defining, legally-constitutive feature** of a cooperative, and the very source of the "human authority" the AI and API constitutions repeatedly invoke.

These are **genuine omissions, not invented work.** With the P0 items below addressed, the research phase would be complete.

---

## 1. What is already solid (for calibration)

So the gaps are read against a real baseline, these areas are **adequately covered** and are *not* gaps:

- Domain model shape (Type/Activities/Capabilities, Option C) and the missing-Activities-layer gap — covered (ADR-0002/0003, gap analysis).
- Financial data model integrity — double-entry, immutability, money precision, numbering, projections (Canonical Model, ADR-0001/0005/0006).
- Accounting standard core — principles, COA, statements, appropriation, audit/tax (UCAS).
- Identity/PII/consent, federation/residency, event/export contracts, AI and API governance, 25-year preservation — all covered.
- Deposits, subsidy/FPS, banking, emerging sectors — **already flagged** in the gap analysis (BA-2/BA-3/CAP-1/CAP-2, SC-4); **not re-reported here** as new gaps.

State-Act rate variation (reserve %, dividend cap, audit-class criteria) is **acknowledged** as jurisdiction rule-data, not a gap.

---

## 2. Genuine gaps

### GAP-1 · Cooperative governance & democratic-body domain is unmodeled — **P0 (largest gap)**
**Category:** Cooperative-domain concept + business rules + compliance.
**What's missing.** The corpus models the society's *finances* exhaustively but never models its **governance**: the **Board of Directors / Managing Committee**, the **General Body / AGM**, **elections**, **committees**, and — critically — **resolutions as the source of authority**. A cooperative is legally a *democratic, member-governed* body; financial acts (sanctioning a loan, adopting the budget, **approving the annual accounts**, declaring dividend, appropriating surplus) derive their legality from **board/AGM resolutions**.
**Why it's material — not cosmetic.** The AI Constitution (Art. III) and API Constitution (Art. VI/VII) repeatedly require "human/board/secretary/auditor authority" for money and statutory finalization — **but the corpus never defines where that authority comes from or how it is recorded.** Authority, SoD, and approval hang on a governance layer that isn't in the Canonical Model. The product *has* Board/Election/Meeting modules, but the **constitution-level domain model omits them**, so the authority chain is asserted, not grounded.
**Where it should live.** A governance addition to the Canonical Model (Board, General Body, Resolution, Election, Committee as first-class entities) + a UCAS/compliance section tying **AGM adoption of accounts, resolution-authorized appropriation, and statutory election compliance** to the financial acts they authorize.

### GAP-2 · No offline-first / connectivity & synchronization architecture — **P0**
**Category:** Architectural decision.
**What's missing.** There is **no ADR** on operating under intermittent or absent connectivity, nor on **sync / conflict-resolution / eventual-consistency** semantics. Yet the target architecture *creates* this tension: ADR-0001 (durable event append), ADR-0005 (server-authoritative gapless numbering), and the API Constitution's coordination points all assume connectivity — while a national OS's core users are **village PACS with poor or no internet**.
**Why it's material.** ADR-0005 itself defers this ("offline drafts get their official number on sync… reservation-block scheme") as a *revisit condition* — i.e. the corpus already knows the decision is owed and hasn't made it. For rural India this is arguably a first-order architectural decision, not an edge case. Unresolved, it blocks the numbering, event-log, and API models from being realizable where the users actually are.
**Where it should live.** A new ADR: offline-first data capture, local durability, deterministic sync, conflict resolution, and how gapless numbering (ADR-0005) reconciles with disconnected operation.

### GAP-3 · Year-end close, opening balances & prior-period adjustment accounting — **P0**
**Category:** Accounting rule.
**What's missing.** The fundamental **financial-year lifecycle** is not specified: **year-end closing** (transfer of P&L to Appropriation and net to Balance Sheet), **opening-balance carry-forward / opening-entry generation**, and **prior-period adjustments** (correcting a locked/closed year while the new year is open). The Canonical Model references `fyContext`, `openingBalance` "tied to an opening event," and RULE 6 period-lock, but **the close/rollover *process* is undefined** — and it is genuinely non-trivial under an event-sourced ledger (is a close a projection cutoff, or posted closing/opening events? how do adjustments to a locked year flow forward?).
**Why it's material.** Every cooperative closes a books-year annually and the auditor certifies it; opening balances and prior-period adjustments are routine, statutorily-sensitive accounting. This is core accounting, not an extension.
**Where it should live.** A UCAS section (year-end close, appropriation posting, opening-balance derivation, prior-period-adjustment rules) reconciled with ADR-0001's immutability and RULE 6's lock.

### GAP-4 · Credit-governance business rules (limits & sanctioning authority) — **P1**
**Category:** Business rule (credit domain).
**What's missing.** For credit-bearing societies, the corpus models loan *transactions* (Canonical Loan; UCAS VP-CREDIT/DCB) but not the **credit-governance rules**: **Maximum Borrowing Power (MBP)** of the society, **member credit limits** (Normal/Maximum Credit Limit — NCL/MCL for crop loans), and **sanctioning authority** (which body approves which loan size). These are statutory/bye-law credit controls, not mere parameters.
**Why it's material.** Lending without limit governance is exactly the failure mode cooperative credit regulation exists to prevent; and sanctioning authority ties back to GAP-1 (governance). Partly expressible as rules-engine data (ADR-0008), but the **concepts are unnamed** in the corpus.
**Where it should live.** UCAS VP-CREDIT extension + linkage to GAP-1 governance authority; limits as effective-dated rules.

### GAP-5 · Multilingual / localization architecture beyond Hindi — **P1**
**Category:** Architectural decision.
**What's missing.** The corpus is consistently **Hindi-first** (RULE 7), and preservation correctly mandates UTF-8/Devanagari — but a **national** cooperative OS spans 28 states and 20+ official languages (Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi…). There is **no decision** on multi-language/multi-script localization (UI, statutory statement rendering, member communication, script handling).
**Why it's material.** "National" is explicit in the mandate; a Tamil Nadu or West Bengal society cannot operate Hindi-first. This is a genuine missing architectural decision, distinct from the encoding-hygiene already covered.
**Where it should live.** A localization ADR (language/script strategy, statutory-format rendering per state, translation governance).

### GAP-6 · AML / KYC / PMLA obligations for credit & banking cooperatives — **P1 (scope-conditional)**
**Category:** Compliance requirement.
**What's missing.** Consented KYC (DigiLocker/Aadhaar) is in the API Constitution, but **AML/CFT and PMLA obligations** — customer due diligence, suspicious-transaction monitoring/reporting, record-keeping for FIU-IND — are absent. These bind credit societies and cooperative banks handling deposits/loans.
**Why it's material.** For VP-CREDIT/VP-BANKING these are hard legal obligations. **Scope caveat:** banking (SC-4) is explicitly flagged as later-scope in the gap analysis, so this is P1-when-in-scope, not an immediate P0 — but it is a genuine, currently-unlisted compliance requirement.
**Where it should live.** UCAS compliance model (CM) + a note in the AI/API constitutions (monitoring/reporting is a governed integration).

---

## 3. Minor items (noted, not blocking)

Genuine but small; recorded for honesty, not urgency:

- **Inter-entity / consolidation elimination accounting.** ADR-0009 defines the federation graph and consolidation-as-re-projection, but **elimination of inter-society transactions** on roll-up (primary→district→state) isn't specified. Edge/future; matters only when tier-consolidation goes live.
- **Corpus precedence & master index.** Each constitution has its own precedence clause, but there is **no single hierarchy** resolving conflicts *between* the five architecture SSOTs, and no master index tying research→ADR→architecture. A documentation-governance tidy-up, not a domain gap.
- **Member succession/nominee-claim process.** Canonical Member has `nomineeRef` and Share covers transfer, but the **death→nominee-claim→settlement** workflow isn't drawn as a domain process. Partially covered; minor.

Items **deliberately not reported** as gaps because they are already covered or already flagged: deposits, FPS/subsidy, emerging sectors, banking type, state-rate variation, data residency, depreciation methods, audit classification, multi-currency (non-applicable, INR-domestic).

---

## 4. Severity summary

| ID | Gap | Category | Severity |
|---|---|---|---|
| GAP-1 | Governance / democratic-body domain (Board, AGM, elections, resolutions-as-authority) | Domain + rules + compliance | **P0** |
| GAP-2 | Offline-first / connectivity & sync architecture | Architectural decision | **P0** |
| GAP-3 | Year-end close, opening balances, prior-period adjustment | Accounting rule | **P0** |
| GAP-4 | Credit-governance rules (MBP, member credit limits, sanction authority) | Business rule | P1 |
| GAP-5 | Multilingual / localization beyond Hindi | Architectural decision | P1 |
| GAP-6 | AML/KYC/PMLA for credit & banking coops | Compliance | P1 (scope-conditional) |
| — | Inter-entity elimination; corpus precedence/index; member succession | Misc | Minor |

---

## 5. Conclusion

The corpus is **near-complete and unusually rigorous** on everything to do with the ledger, the data, the AI, the API, and 25-year preservation. Its genuine blind spots cluster in two places: the **democratic/governance dimension** that makes a cooperative a cooperative (GAP-1, and by extension GAP-4's sanction authority), and a set of **operating-reality and lifecycle** decisions (offline GAP-2, year-close GAP-3, localization GAP-5) that a *national, rural, multi-state* deployment forces.

**Recommendation:** close **GAP-1, GAP-2, and GAP-3** (the three P0s) before declaring the research phase complete; **GAP-4/5/6** can be scheduled as P1 research follow-ons. Per the instruction, **no new work is created here** — these are the identified, genuine gaps, and nothing beyond them should be manufactured. Once the three P0 gaps are documented to the same standard as the existing corpus, the research phase is complete.

---

## 7. Second-pass correction (full-corpus review) — FINAL

**What changed.** Part 1–5 reviewed only the 20 documents authored in the domain-architecture workstream (the `DOMAIN-*` research, the 10 ADRs, the 5 `docs/architecture/` SSOTs). It **did not review the pre-existing ~26-document research corpus** already in `docs/research/`. A re-review of the **full** corpus reverses the first-pass verdict.

**Each first-pass "gap", re-checked against the full corpus:**

| First-pass gap | Actual status | Evidence (pre-existing corpus) |
|---|---|---|
| **GAP-1 Governance / democratic body** | **Covered** | Approval-matrix / maker-checker / **AGM approval gate** / **committee & general-body approval** / **dual-control FY-close** ([TASK3.6](TASK3.6-TOP-100-DESIGN-DECISIONS.md) §7,50,57,74,128,138); **Board Resolution Register** ([TASK2.3](TASK2.3-COOP-ACCOUNTING-REGISTERS.md)); loan/deposit/membership approval bodies ([TASK3.5](TASK3.5-COOP-OS-WORKFLOW-ARCHITECTURE.md)); AGM-Due & FY-Closing events; elections/meeting registers exist as product modules. |
| **GAP-2 Offline-first / sync** | **Covered** (marked Critical, cannot-change-later) | **"Offline-first for field capture" + "Integrity-safe sync, no silent divergence" + "local queue + guaranteed sync/rollback"** ([TASK3.6](TASK3.6-TOP-100-DESIGN-DECISIONS.md) §21); "Offline-first field capture with integrity-safe sync (the market gap)" ([TASK3.9](TASK3.9-COOP-OS-SECURITY-GOVERNANCE-RELIABILITY.md)); offline-tolerance strategy ([TASK3.5](TASK3.5-COOP-OS-WORKFLOW-ARCHITECTURE.md) #46). |
| **GAP-3 Year-end close / opening balances / prior-period** | **Covered** | **Opening Balances = prior-year audited closing, no post-audit override**; **Year-End Closing → closing entries → appropriation (reserve ≥25% → education → funds → dividend) → FY lock post-AGM → next-year opening** ([TASK4.2](TASK4.2-ACCOUNTING-ENGINE-BLUEPRINT.md) §7,18,45). |
| **GAP-4 Credit-governance limits/sanction** | **Covered** | Sanction limits & **loan committee by amount** ([TASK3.5](TASK3.5-COOP-OS-WORKFLOW-ARCHITECTURE.md)); NABARD/RBI **prudential & NPA norms** ([TASK2.4](TASK2.4-COOP-AUDIT-PROCESS.md), [TASK2-COOP-ACCOUNTING-DOMAIN](TASK2-COOP-ACCOUNTING-DOMAIN.md)). |
| **GAP-6 AML/KYC/PMLA** | **Covered / acknowledged** | KYC pervasive (membership/deposit/loan) ([TASK2.5](TASK2.5-COOP-OPERATIONAL-WORKFLOWS.md), [TASK3.5](TASK3.5-COOP-OS-WORKFLOW-ARCHITECTURE.md)); **"KYC/AML"** named as concurrent-audit high-risk ([TASK2.4](TASK2.4-COOP-AUDIT-PROCESS.md)). |
| **GAP-5 Multilingual beyond Hindi** | **Intent covered as principle** | **"Hindi-First"** + **"vernacular"** as an explicit differentiator/principle ([TASK4.1](TASK4.1-PRODUCT-VISION-PRINCIPLES.md) §26,55,95). Detailed multi-script strategy is implementation-level, not a research gap. |

Also confirmed covered incidentally: **area of operation** (member-eligibility check, [TASK2.5](TASK2.5-COOP-OPERATIONAL-WORKFLOWS.md)), **mandatory nominee**, **fund-backed-by-investment**, **document retention ≥10 yrs**, **NABARD CAS** as reference standard.

**One honest caveat (a known, parked dependency — not an unidentified gap):** **NABARD Common Accounting System (CAS) conformance** is explicitly *blocked* pending an authoritative CAS specification that is not in the repository; per standing guidance the CAS heads/formats must **not be fabricated**. This is a tracked external-source dependency, correctly parked, not a missing research decision.

### FINAL VERDICT

**The research phase is COMPLETE.** Reviewing the entire corpus — domain/accounting/registers/audit/compliance/tax/banking (`TASK2.*`), OS/module/RBAC/data/workflow/integration/reporting/security architecture and the 100 design decisions (`TASK3.*`), the engine/member/share/cash blueprints (`TASK4.*`), the implementation backlog (`TASK5.*`), the nine module gap-analyses (`GAP-ANALYSIS-SESSION*`), and the strategic layer added in this workstream (`DOMAIN-*`, the 10 ADRs, and the 5 architecture SSOTs) — no genuine, material research gap remains unaddressed. The first-pass P0s were an artifact of an incomplete review, now corrected. The only open item (NABARD CAS conformance) is an external-spec dependency that is already identified and appropriately parked, and cannot be closed by further research alone.
