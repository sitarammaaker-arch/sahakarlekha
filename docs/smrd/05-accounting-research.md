# 05 — Accounting Research Framework

> A **research framework** for the accounting domain — the *questions to answer and verify*, not the
> answers. **No accounting treatments, Dr/Cr, rates, or formats are asserted here.** Every treatment is
> a research target that must reach **E3** (primary source + SME) before any content uses it ([01](01-research-methodology.md)).
>
> Anti-duplication: mechanics already verified in `/guide`, `/cookbook` (~40 recipes), and the app's
> module formulas are cited as **internal corroboration (T5)** — not re-derived. The framework's job is
> to attach **primary sources + SME sign-off** to those treatments and to fill the gaps.

**For every item below, the research record captures:** `claim → source(s) → evidence level → SME →
jurisdiction → as_of`. `⚠️ NEV` until E3.

---

## 1. Chart of Accounts (→ C031, C032; SRC-OPS-PACS-COA, SRC-INT-COA)
Research questions:
- Is there a **prescribed COA** per society type / per state (e.g. PACS CAS)? Capture the authoritative list. `⚠️ NEV`
- Standard group hierarchy (assets/liabilities/income/expenditure/capital) — does the state act mandate heads? `⚠️ NEV`
- Society-type deltas: which heads are added/renamed for dairy, credit, consumer, marketing, housing? `⚠️ NEV`
- Reconcile in-app standard COA (T5) against the prescribed COA — record differences.
Deliverable targets: COA packs ([08](08-template-opportunities.md)); validation = SME + SRC-OPS.

## 2. Voucher Scenarios (→ C037–C048; SRC-INT-COOKBOOK)
Research questions:
- Enumerate the **scenario catalogue** (the ~40 cookbook recipes are the seed list — verify completeness).
- For each scenario: which voucher type, which heads, any society-type variation? `⚠️ NEV`
- Special scenarios needing expert confirmation: MSP procurement, kachi-aarat commission, subvention, share refund, NPA provisioning, OTS, loan write-off, grant-funded assets.
- Cancellation/soft-delete and audit-trail rules per audit manual. `⚠️ NEV`
Output: a **scenario→treatment matrix** (each cell E3-gated).

## 3. Journal Entries (→ C040, C036; SRC-STD-ICAI-AS, SRC-INT-COOKBOOK)
Research questions:
- Adjusting entries set: prepaid, outstanding, accrued, depreciation, provisions, closing stock — confirm treatment vs ICAI AS. `⚠️ NEV`
- Rectification entries: error taxonomy (omission/commission/principle/compensating) and the correcting entry pattern. `⚠️ NEV`
- Year-end appropriation entries (reserve, dividend, funds) — order is **state-statutory**. `⚠️ NEV`
Output: verified entry templates feeding `/cookbook` upgrades (different-intent, not duplicate).

## 4. Ledger Structures (→ C027, C032, C063; SRC-INT-MODULES)
Research questions:
- Required subsidiary ledgers (members, shares, loans, deposits, suppliers, customers) — which are statutory registers vs accounting sub-ledgers? `⚠️ NEV`
- Control-account ↔ subsidiary reconciliation expectations in audit.
- Per-member / per-loan ledger granularity expected by auditors. `⚠️ NEV`

## 5. Trial Balance (→ C049, C214; SRC-INT-MODULES)
Research framework:
- Verify the TB computation rule matches the app and the golden rules (Dr=Cr) — low NEV (mechanics).
- Common TB mismatch causes → diagnostic checklist (corroborate with `/guide` troubleshooting, T5).
- Mapping TB heads → statutory statement lines. `⚠️ NEV` (format).

## 6. Financial Statements (→ C050–C055; SRC-ST-ACT-{XX}, SRC-STD-ICAI-AS)
Research questions per statement (Trading, P&L/I&E, Receipts & Payments, Balance Sheet):
- Is there a **prescribed format** under the state act/rules? Capture it. `⚠️ NEV`
- Society-specific lines (I&E vs P&L; appropriation section; fund accounts).
- The **report→statutory-form map** (C055): which app report feeds which government form. `⚠️ NEV`
- Schedules/annexures required (C057). `⚠️ NEV`
Internal corroboration: app modules already produce these (T5) — research attaches the legal format + SME.

## 7. Audit Requirements (→ C143–C153; SRC-ST-AUDITMAN-{XX}, SRC-STD-ICAI-AUD)
Research questions:
- Statutory audit scope, periodicity, who audits (dept/empanelled), per state. `⚠️ NEV`
- Audit **classification/grading** criteria (A/B/C/D). `⚠️ NEV`
- Required audit schedules, certificate format, memo/rectification process. `⚠️ NEV`
- Internal vs concurrent audit applicability (credit societies/coop banks). `⚠️ NEV`
- Catalogue of **common audit objections** + correct resolution (SME-sourced).
Output: feeds audit checklist magnet (LIVE) refresh + audit clusters.

## 8. Common Errors (→ C036, C213–C219; SRC-INT-GUIDE)
Research framework:
- Build the **error catalogue**: data-entry, classification, reconciliation, opening-balance, period-lock, stock-formula, ledger-routing errors.
- For each: detection signal + correct rectification entry (E3-gated where it's an accounting treatment).
- Cross-link to the app's data-integrity rules (CLAUDE.md RULES 1–6) as T5 corroboration — these are product invariants, not external law.

## 9. Validation Requirements (the accounting NEV gate)
Before any accounting treatment is publishable (E3):
1. **Primary standard/law** captured (ICAI AS / state act / Income-tax) with exact ref + `as_of`.
2. **Jurisdiction** tagged (central vs state vs society-type).
3. **SME sign-off** (CA / cooperative auditor) recorded.
4. **Internal consistency** check: does the app/module produce the same result? (flag mismatches to engineering — could be a product bug or a research error).
5. **Worked example** verifiable against demo-society data (T5).

> **Hard rule:** if (1) or (3) is missing → status stays `NEV`; content may explain the concept
> generally but must **not** state a specific entry/rate/format as fact.

---

## Accounting research backlog (priority order)
1. COA prescriptions (PACS CAS + per-state) — unblocks many clusters.
2. Statutory statement formats + report→form map (C055).
3. Depreciation rates/method (C112) — high demand, high NEV.
4. Appropriation order + reserve/dividend rules (C172–C174) — state-statutory.
5. NPA classification/provisioning (C073) — NABARD/RBI.
6. Audit grading + objection catalogue (C145, C153).
7. Sector treatments: MSP/aarat, dairy fat-SNF, KCC subvention.

---

### Cross-references
[Topic Research Registry](03-topic-research-registry.md) · [Law & Compliance](06-law-and-compliance.md) · [Template Opportunities](08-template-opportunities.md) · [Content Readiness](10-content-readiness.md) · [SCOS Authority Engine](../scos/13-authority-engine.md)
