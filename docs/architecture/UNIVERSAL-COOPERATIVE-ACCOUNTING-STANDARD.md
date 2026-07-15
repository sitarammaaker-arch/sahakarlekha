# SahakarLekha — Universal Cooperative Accounting Standard (UCAS)

- **Status:** Accepted — accounting SSOT. One standard for every cooperative type, realized as a **common core + capability-resolved variation packs**.
- **Date:** 2026-07-11
- **Sits on:** [Canonical Financial Data Model](CANONICAL-FINANCIAL-DATA-MODEL.md) (the entities & laws) · [ADR-0002 Capabilities](../adr/0002-capability-driven-architecture.md) · [ADR-0003 Activities](../adr/0003-activities-layer.md) · [ADR-0008 Rules Engine](../adr/0008-rules-engine.md).
- **Scope:** documentation only. No code, no schema. Defines *what* correct cooperative accounting is; the data model defines *how* it is stored; the rules engine defines *where* jurisdictional variation lives.

> **The core idea.** There is **one** accounting standard. Its universal core (principles, COA skeleton, statements, appropriation, compliance) applies to every society. Type- and activity-specific behavior is **not a different standard** — it is a **variation pack** switched on by a capability (ADR-0002/0003) and parameterized by effective-dated, jurisdiction-scoped rules (ADR-0008). A Multipurpose PACS running credit + dairy + fair-price shop applies the core once and layers three variation packs — automatically.

---

## Part A — Common accounting principles (the universal core)

These hold for **every** cooperative regardless of type, state, or activity. They combine generally-accepted accounting principles with the **cooperative-distinctive** principles that separate cooperative accounting from company accounting.

### A.1 Generally-applicable principles (inherited, not restated)
Double-entry, accrual (with cash-basis statements also produced — see FS), going concern, consistency, prudence, materiality, substance-over-form, and historical-cost (with regulator-directed exceptions). Accounts follow **Accounting Standards (AS) issued by ICAI** to the extent applicable; cooperative societies are **not companies**, so the Companies (Ind AS) Rules do **not** automatically apply — Ind AS applies only where a regulator directs it (e.g. RBI for cooperative banks). Every principle is realized through the immutable, double-entry postings of the Canonical Data Model (laws CL-1…CL-9).

### A.2 Cooperative-distinctive principles (the heart of UCAS)

- **UCAS-P1 — Surplus, not profit; patronage-based return.** A cooperative operates for member service, not profit maximization. Distributable surplus is returned **in proportion to a member's patronage** (transactions with the society — deposits, borrowings, milk supplied, purchases made), not merely in proportion to capital. **Patronage dividend / bonus is a first-class accounting object**, not an afterthought. This is the defining accounting difference from a company.
- **UCAS-P2 — Limited return on share capital.** Dividend on shares is **capped** (commonly ≤ 15% without Registrar sanction) — capital is a servant, not the master. The cap is a **rule** (jurisdiction-scoped), not a constant.
- **UCAS-P3 — Statutory appropriation of surplus precedes distribution.** Net surplus is appropriated in a **legally-mandated order** (Reserve Fund first, then statutory funds, then limited dividend, then patronage bonus) — see CM-1. Appropriation is an accounting event, posted through vouchers, never a spreadsheet exercise.
- **UCAS-P4 — Indivisible reserves.** The **Statutory Reserve Fund is not distributable** to members — not as dividend, not on dissolution (it devolves to cooperative purposes). It is member-attributable equity that no member can withdraw. Accounting must ring-fence it distinctly from distributable reserves.
- **UCAS-P5 — Member vs. non-member distinction.** Transactions and the surplus arising from them are classified **member / non-member**, because rights (patronage, voting) and **tax treatment (§80P)** depend on it. Every patronage-bearing transaction carries the member linkage (Canonical `partyRef` → Member).
- **UCAS-P6 — Fund accounting.** Cooperatives maintain **earmarked statutory and bye-law funds** (Reserve, Education, Building/Sinking, Bad & Doubtful Debt Reserve, Dividend Equalization, Provident) — each a distinct equity/liability head with its own movements and, where required, **ring-fenced investments** (e.g. reserve-fund investment norms).
- **UCAS-P7 — Refundable/withdrawable share capital.** Unlike company shares, cooperative share capital is frequently **withdrawable/redeemable** by exiting members per bye-laws — so share capital is not permanently fixed and its movements are a first-class ledger (Canonical: Share entity).
- **UCAS-P8 — Statutory-format primacy.** The society's **State Cooperative Act (or the MSCS Act / RBI for banks)** prescribes book, statement, and audit formats. UCAS produces a **superset** internally and **projects** the required statutory format at the boundary (a report projection, per CL-4) — never the reverse.

---

## Part B — Society-specific variations (as capability-switched packs, not separate standards)

Each variation pack is enabled by a **capability/activity** (ADR-0002/0003) and parameterized by **rules** (ADR-0008). The core (Part A) always applies underneath.

| Variation Pack | Enabled by capability | Accounting specifics it adds |
|---|---|---|
| **VP-CREDIT** (PACS, credit society) | `loan_ledger`, `deposit_ledger` | Demand–Collection–Balance (**DCB**) register; overdue ageing; interest accrual on loans & deposits; bad & doubtful debt provisioning; member deposit ledgers. |
| **VP-BANKING** (UCB, StCB, DCCB) | banking caps | RBI **IRAC** norms (NPA classification & provisioning), **CRAR**, SLR/CRR, income recognition on NPAs; RBI return formats. (Regulator-directed Ind AS where applicable; **§80P not available** to cooperative banks.) |
| **VP-DAIRY** | `procurement_engine` + `quality_pricing` | Milk pooling; **fat/SNF-based** producer pricing; producer payment register; price-difference/pooling accounts; cattle-feed & input recovery. |
| **VP-MARKETING/PROCESSING** (sugar, oilseed, marketing) | `procurement_engine`, `bom_costing` | Commodity **pooling accounts**; cane/produce price (FRP/SAP); processing **cost/BOM**; by-product accounting; commission/aggregation income; price-pooling settlement. |
| **VP-CONSUMER** | `pos_billing`, `inventory` | Retail margin; POS day-book; **patronage rebate on purchases**; expiry/damage; sales/purchase returns. |
| **VP-HOUSING** | `property_units`, `maintenance_billing` | **Income & Expenditure** (non-trading); service/maintenance charges; **Sinking & Repair funds**; non-occupancy charges; **transfer premium**; member-wise sub-accounts; corpus. |
| **VP-LABOUR/CONTRACT** | `labour`, `pf_esi` | Work-order costing; wage distribution to member-workers; PF/ESI; contract-wise P&L. |
| **VP-PRODUCER/ALLIED** (fishery, weavers, handicraft, FPO) | activity-specific | Input-supply + output-marketing cycle; revolving/production funds; member produce accounts. |
| **VP-FAIR-PRICE/PDS & INPUT** | `fair_price_shop_pds`, `subsidy_reconciliation` | Government **subsidy claim & reconciliation**; PDS commission; fertilizer/seed subsidy accounting. |

**Key point:** these are **additive layers on one standard**, resolved automatically from the society's activities. A society is never "a dairy accounting system" or "a housing accounting system" — it is UCAS core + whichever packs its capabilities light up.

---

## Part C — Standard Chart of Accounts (universal skeleton + capability extensions)

A **single COA skeleton** applies to all cooperatives; capabilities seed additional heads via COA templates (Canonical: Account, `capabilityOrigin`; per-item routing per RULE 4). Structure by the five classical groups, with cooperative-specific heads marked ★.

**1. Capital & Funds (Equity / Member Funds)**
- Member Share Capital ★ (withdrawable — UCAS-P7)
- **Statutory Reserve Fund** ★ (indivisible — UCAS-P4)
- Education Fund ★ · Building/Sinking Fund ★ · Dividend Equalization Fund ★ · Bad & Doubtful Debt Reserve ★ · Provident Fund ★
- Profit & Loss Appropriation ★ · Patronage/Bonus Payable ★ · Dividend Payable ★

**2. Liabilities**
- Member Deposits ★ (VP-CREDIT/BANKING) · Other Deposits
- Borrowings — from DCCB/StCB/NABARD/apex ★
- Sundry Creditors · Interest Payable · Statutory dues (GST/TDS/PF/ESI) · Provisions

**3. Assets**
- Cash · Bank · **Investments** (incl. earmarked reserve-fund investments ★)
- **Loans & Advances to Members** ★ (VP-CREDIT) · Overdue/NPA sub-classification ★
- Inventory/Stock (VP-CONSUMER/MARKETING) · Sundry Debtors
- Fixed Assets (net of depreciation) · Deposits with banks/federations

**4. Income**
- Interest on Loans ★ · Sales/Trading Income · Commission/Aggregation ★ · Processing Income · **Service/Maintenance Charges** ★ (VP-HOUSING) · **Subsidy/Grant Income** ★ · Interest/Dividend on Investments · Other Income
- *(per-category routing, RULE 4: e.g. Fertilizer Sales, Consumer Goods Sales, Milk Sales as distinct heads)*

**5. Expenditure**
- Interest on Deposits & Borrowings ★ · Cost of Goods/Procurement · Producer Payments ★ (VP-DAIRY) · Salaries & Wages · Establishment · Depreciation · **Cooperative Audit Fee / Supervision Cess** ★ · Provisions & Write-offs

**Governance:** the skeleton is the always-on core (capability-independent); every ★-with-capability head is seeded only when its capability is entitled. New statutory heads arrive as **COA template data** (ADR-0008), never as code — historical accounts are never disturbed (Canonical: Account immutability).

---

## Part D — Standard financial statements (universal set, capability-selected)

UCAS defines the **full statement set once**; which statements a given society renders is **capability-driven** (mirroring report tiering — statutory statements gate on legal type, operational ones on capability). All are **projections** over immutable postings (CL-4), so any statement is reproducible as-of any date.

| Statement | Applies to | Selection driver |
|---|---|---|
| **FS-1 Receipts & Payments A/c** | All (cash-basis view; primary for service/non-trading) | Universal |
| **FS-2 Income & Expenditure A/c** | Non-trading/service societies (housing, welfare, credit-only) | `!inventory` / service capability |
| **FS-3 Trading A/c** | Trading/manufacturing societies | `inventory` / `bom_costing` capability |
| **FS-4 Profit & Loss A/c** | Societies with commercial operations | trading/processing capabilities |
| **FS-5 Profit & Loss Appropriation A/c** ★ | **All surplus-generating societies** — the statutory appropriation (Part E) | Universal (where surplus exists) |
| **FS-6 Balance Sheet** | All | Universal |
| **FS-7 Statutory schedules & registers** | All (state-act formats, e.g. fund schedules, DCB, member/share registers) | Legal type + capability |
| **FS-8 Audit Report + Classification** | All (statutory audit output) | Legal type (jurisdiction) |

**Distinctive:** **FS-5 (Appropriation A/c)** is the cooperative signature statement — it makes the statutory division of surplus (Reserve/Education/Dividend/Patronage) an auditable, posted output, not a note. Housing and other service societies center on **FS-2 (I&E)** rather than P&L; trading societies produce **FS-3/FS-4**; a Multipurpose PACS produces several concurrently — all from the same postings.

---

## Part E — Standard compliance model

One compliance framework, with the **variable numbers held as jurisdiction-scoped, effective-dated rules** (ADR-0008) so 28 states' Acts and changing tax law are absorbed as data, and historical periods reproduce their own era's rules.

### CM-1 — Statutory appropriation of net surplus (the mandatory order)
Posted through FS-5 in this sequence (exact rates are **rule data**, shown are common defaults):
1. **Statutory Reserve Fund** — **≥ 25%** of net profit, before any distribution (indivisible, UCAS-P4).
2. **Education Fund** — prescribed contribution to the State federal/apex society (commonly capped ~5%).
3. **Bye-law reserves** — Bad & Doubtful Debt Reserve, Building/Sinking Fund, Provident Fund, etc., per bye-laws.
4. **Dividend on share capital** — limited (**≤ 15%** without Registrar sanction, UCAS-P2).
5. **Patronage bonus/rebate** — to members in proportion to patronage (UCAS-P1).
6. **Other funds & charitable/public-purpose** appropriations (often ≤ 10%, with sanction).
7. **Balance** — to Reserve Fund / carried forward.

### CM-2 — Audit & supervision
- **Statutory audit** under the governing **State Cooperative Act** (e.g. MCS Act s.81 / Rule 69 pattern) or **MSCS Act** for multi-state societies, by a Registrar-empanelled auditor.
- The auditor **awards an audit classification (A/B/C/D)** per the Registrar's criteria (state-variable) — captured as a first-class compliance record.
- **Tax audit u/s 44AB** where turnover thresholds apply.
- Audited accounts + audit report **filed with the Registrar** and placed before the **AGM** within the statutory timeline.

### CM-3 — Taxation
- **Income Tax:** cooperative societies compute income with **§80P deductions** where eligible; **§80P is NOT available to cooperative banks** (since AY 2007-08) but **is** available to PACS, primary cooperative agricultural societies, and rural development banks — hence the **member/non-member** classification (UCAS-P5) is accounting-critical.
- **GST** (VP-CONSUMER/MARKETING/PROCESSING; RCM where applicable) and **TDS/TCS** obligations, with statutory-dues heads in the COA.

### CM-4 — Regulatory & reporting
- **RBI** directions for cooperative banks/UCBs (IRAC, CRAR, returns — VP-BANKING).
- **NABARD** norms for rural credit; **RCS** periodic returns; **National Cooperative Database (NCD)** reporting — served by mapping internal heads to **stable external codes** (ADR-0004/0008), never raw internal enums.

### CM-5 — Fund & investment compliance
- Ring-fenced **reserve-fund investment** norms; earmarked statutory funds reconciled to their investments; member deposit/borrowing limits per bye-laws.

**All CM rates, thresholds, formats, and classifications are effective-dated + jurisdiction-scoped rule data** — a Gujarat PACS in FY2027 and a Maharashtra housing society in FY2032 each resolve their own numbers from the same engine, and a 2027 statement reproduces 2027's rules when reopened in 2035.

---

## Part F — How UCAS is realized (one standard, no forks)

```
                 ┌───────────────────────────────────────────────┐
                 │  UCAS CORE  (Part A principles · Part C COA     │
                 │  skeleton · Part D statement set · Part E CM-1  │
                 │  appropriation)  — applies to EVERY society     │
                 └───────────────┬───────────────────────────────┘
                                 │ layered by capability/activity
   ┌──────────┬──────────┬───────┴────┬──────────┬──────────┬──────────┐
 VP-CREDIT  VP-DAIRY  VP-MARKETING  VP-CONSUMER VP-HOUSING VP-LABOUR  VP-…      ← variation packs
   └──────────┴──────────┴────────────┴──────────┴──────────┴──────────┘
                                 │ parameterized by
                 ┌───────────────┴───────────────┐
                 │  RULES ENGINE (ADR-0008):       │  effective-dated, jurisdiction-scoped:
                 │  reserve %, dividend cap,        │  rates · formats · audit class criteria ·
                 │  interest, pricing, subsidy, tax │  §80P eligibility · state-act formats
                 └───────────────┬───────────────┘
                                 │ stored & posted via
                 ┌───────────────┴───────────────┐
                 │  CANONICAL FINANCIAL DATA MODEL │  immutable double-entry postings;
                 │  (CL-1…CL-9)                    │  statements = projections (CL-4)
                 └───────────────────────────────┘
```

- **Core = capability-independent**; every society gets Part A/C/D-core/E-CM1.
- **Variation = a capability-switched pack**, resolved from the society's declared activities (ADR-0003). Enabling `procurement_engine`+`quality_pricing` *is* enabling VP-DAIRY's accounting; nothing is forked.
- **Jurisdiction & time variation = rules**, never code (ADR-0008) — so state-Act divergence and annual policy change are data.
- **Everything posts through the Canonical Model** and every statement is a projection — so UCAS is auditable, reproducible, and future-report-compatible by construction.

### Governance & versioning
- UCAS is versioned as a whole; each **variation pack** and each **rule set** is independently versioned and effective-dated.
- A new statutory requirement is added as **rule data + (if needed) a new capability-seeded COA head or variation pack** — never by editing the core or a historical account.
- UCAS changes only by a superseding, ratified revision (recorded as an ADR), preserving the Canonical Model's immutable-field guarantees.

---

## Part G — Why one standard is achievable (the thesis)

Every Indian cooperative — credit, dairy, housing, consumer, marketing, sugar, labour, fishery, producer — shares the **same accounting skeleton**: member capital, indivisible reserves, statutory fund appropriation, limited dividend, patronage-based surplus, double-entry books, and a State-Act-prescribed audit. They differ only in **which operational sub-ledgers and which statutory parameters** apply. UCAS captures the shared skeleton as an invariant core and pushes every difference into **capability-switched variation packs** and **effective-dated rules**. That is precisely the shape the Ministry of Cooperation's own trajectory demands — Multipurpose PACS running many activities under one set of books — and it is the shape SahakarLekha's architecture already supports. **One standard, universally applied, infinitely varied at the edge.**

---

## Sources

- [Reserve Fund (25%) & appropriation — Maharashtra Coop Societies Act pattern](https://mysocietyclub.com/act/maharashtra-cooperative-society-act-1960/society-property-fund) · [Housing bye-law appropriation of profits](https://mysocietyclub.com/bye-laws/maharashtra-cooperative-housing-society-bye-laws/appropriation-profit)
- [Kerala Coop Societies Act — properties & funds (Ch. VII)](https://cooperation.kerala.gov.in/coop/wp-content/uploads/kcsact1969/55%2056%2056A.pdf)
- [Education Fund in cooperative societies](https://www.nobrokerhood.com/blog/education-fund-in-cooperative-society/)
- [Audit of cooperative societies & classification (ICAI background material)](https://bangaloreicai.org/images/icons/2014/backgroundmaterial/20140802.3.pdf) · [Co-op audit — Sec 81 & Rule 69](https://www.nagpuricai.org/seminar-presentations/Audit-Report-and-responsibilities-Sec-81-R-69.pdf) · [Co-operative Societies Audit Manual](https://cdnbbsr.s3waas.gov.in/s392c5ad73d34a8c18d276a0f0b60ea745/uploads/2025/02/20250209244461432.pdf)
- [Section 80P — deduction for cooperative societies (not available to coop banks)](https://cleartax.in/s/section-80p) · [Income Tax India — Section 80P](https://www.incometaxindia.gov.in/w/section-80p) · [Guidance Notes on Assessment of Co-operatives (NADT)](https://www.nadt.gov.in/writereaddata/MenuContentImages/Guidance%20Notes%20on%20Assessment%20of%20Co-operatives638434488286353931.pdf)
- Cross-references: [Canonical Financial Data Model](CANONICAL-FINANCIAL-DATA-MODEL.md), [ADR-0002](../adr/0002-capability-driven-architecture.md), [ADR-0003](../adr/0003-activities-layer.md), [ADR-0008](../adr/0008-rules-engine.md), project RULE 2 / RULE 4.
