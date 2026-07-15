# SahakarLekha — Master Knowledge Base (Consolidation)

**Nature:** Knowledge consolidation only. No new research, no internet, no implementation, no software design. Synthesises verified findings from all prior deliverables (Phase-1 competitive intelligence; Phase-2 domain/compliance/audit/workflow/framework research; Phase-3.1 architecture is design, referenced only where it restates a finding).
**Prepared:** 2026-07-08 · **Length target:** ≤15 pages.

## 0. Confidence key (used on every finding)
- **[V] Verified** — confirmed by ≥2 independent primary sources or a 3-0 adversarial-verification vote (Phase-1), or a cross-document principle grounded in acts/NABARD (Phase-2).
- **[L] Likely** — single primary/vendor source, domain-standard but Maharashtra-anchored, point-in-time (tax), or a reasonable inference.
- **[U] Unknown** — flagged Needs-Verification, state-variant unconfirmed, or an explicit gap.

Source documents consolidated: PHASE1-COMPETITIVE-INTELLIGENCE; TASK2, TASK2.2–2.8; TASK2-EXECUTIVE-SUMMARY; TASK3.1-ARCHITECTURE.

---

## 1. Master Knowledge Base — consolidated findings by domain
*(Duplicates removed; similar findings merged. Each finding is stated once with the strongest confidence tier reached across reports.)*

### A. Market & competitive landscape (Phase-1)
- **A1 [V]** The Government of India's PACS Computerization Project is the single biggest structural force in the cooperative-software market: one common national ERP (NLPS) for all functional PACS, approved 29 Jun 2022, sunset 31 Mar 2027.
- **A2 [V]** Original outlay ₹2,516 cr / 63,000 PACS; **revised to ₹2,925.39 cr / 79,630 sanctioned**; ~63,428 live on the ERP by mid-2026. (See contradiction C1 — supersession, not conflict.)
- **A3 [V]** NABARD is implementing agency and custodian of the software and all data (National Level Data Repository); the NLPSV is a **BECIL + AFC India + Intellect Informatics** consortium, ₹320.18 cr contract; **pay-per-use planned post-2027**.
- **A4 [V]** Per-PACS ERP cost to the scheme is **₹72,103** (within ₹3,91,369 total per PACS) — a near-free government price anchor for the PACS segment.
- **A5 [V]** Private credit-cooperative vendors are numerous, regional, pricing-opaque and technologically dated. Verified specifics: **Fin Superb (Cyrus Technoedge)** runs ASP.NET 4.0 + MS SQL 2010; **Websoftex** (Bangalore, ~2012), **Genius Technology** (multi-state credit, desktop+web+Android) publish **no price**; **CreditSociety.in** publishes tiers ₹15k/25k/45k per year.
- **A6 [L]** Dairy is locked at village level by hardware-rooted incumbents (NDDB AMCS 26,000+ societies; Prompt ~47k societies; Stellapps ~3M farmers; Akashganga ~9,200 AMCUs) with only cash-book-level accounting depth.
- **A7 [L]** Housing is the most commercially mature adjacent segment (MyGate, ApnaComplex, NoBrokerHood, ADDA), per-flat SaaS pricing ~₹3–15/flat/month; top complaint is **no offline capability**.
- **A8 [L]** Generic accounting tools (Tally, Busy, Marg, Zoho, Saral) are the de facto incumbents but have **no native cooperative constructs** (member/share/dividend/interest done in Excel or via partner add-ons).
- **A9 [L]** Consumer, labour, industrial, marketing, fisheries cooperatives are largely software deserts; FPO tooling is young/fragmented.
- **A10 [V]** No player found positions as a full multi-type "Cooperative Operating System"; every competitor is segment-locked, horizontal-generic, or bank-grade CBS.

### B. Government & regulatory structure
- **B1 [V]** Dual legal spine: single-state societies → State Cooperative Act + Rules + bye-laws under the **State Registrar (RCS)**; multi-state → **MSCS Act 2002** under the **Central Registrar (CRCS)**; credit/PACS/banks carry a **NABARD/RBI** overlay.
- **B2 [V]** PACS operate on **NABARD's Common Accounting System (CAS)** — accrual, standardised GL, prescribed books, NPA/prudential norms, offline capability. CAS is the nearest thing to a national cooperative accounting standard but is **PACS-specific**.
- **B3 [V]** Parallel government computerization extends to ARDBs (1,851 units, 13 states) and RCS offices — top-down digitization intent across the credit structure.
- **B4 [L]** PACS face a workforce constraint: majority of secretaries 50+, low ERP skills; only 26,882 trained by Dec 2024 vs ~68k sanctioned.

### C. Cooperative types & accounting domain (Phase-2 core)
- **C1 [V]** Uniform surplus-appropriation order: **net profit → statutory reserve (commonly ≥25%) → cooperative education fund → other bye-law funds → dividend (within cap) → carry-forward.**
- **C2 [V]** Financial year is **1 April–31 March**; final accounts within ~45 days of close.
- **C3 [V]** A **statutory core register set** exists (Maharashtra Rule 65 reference): minute books (GM + committee), cash book, general & personal ledger, stock register, property register, audit-objection register; + Member Register (Form I), Share Register (Form J). A large secondary register set is **practice/bye-law-driven** [L].
- **C4 [V]** A generic **class-coded Chart of Accounts** is derivable (Assets / Liabilities / Equity-Own-Funds / Income / Expenses) with cooperative-specific heads (member capital, statutory/sinking/repair/education funds, member deposits & loans, DCB/NPA, per-category sales/purchase routing, appropriation accounts); control accounts reconcile to member-wise subsidiaries.
- **C5 [V]** Type-specific facts firmly established: **Dairy** Fat/SNF two-axis milk pricing + milk-collection & fat-test registers; **Housing (Maharashtra)** sinking fund ≥0.25%/annum of construction cost, repair ~0.75%, transfer premium cap ₹25,000, Forms I/J; **Credit/PACS** loan register + **DCB register** + NPA classification; **Marketing** pool accounting + agency/NAFED settlement; **Labour** muster roll + wage registers, wages by 7th; **Consumer** stock/purchase/sales registers + optional patronage rebate; **Industrial** raw-material/production/finished-goods registers.
- **C6 [L]** Each type's income/expense profile, financial statements and audit-observation set were mapped (per TASK2) — reliable at domain-standard level, Maharashtra/NABARD-anchored.

### D. Statutory compliance & taxation
- **D1 [V]** Annual return to the Registrar within **6 months of FY close** (some rules: within 30 days of AGM); **AGM by ~30 September**; **records retained ≥10 years**.
- **D2 [V]** Board/committee meetings periodic with minuted proceedings; AGM adopts accounts, audit, surplus and elections.
- **D3 [L]** Tax overlay (point-in-time, AY 2025-26 basis): **GST** registration above ₹40L goods / ₹20L services (GSTR-3B 20th); **TDS** deposit by 7th; **income tax** s.80P for eligible societies, **s.115BAD flat 22% (excludes 80P)**, AMT 15%, ITR 31 Oct (audited); **EPF** at 20+ employees, **ESI** at 10+/wages ≤₹21,000 (both remitted by 15th); **professional tax** state-specific (not all states).
- **D4 [L]** A monthly / quarterly / half-yearly / annual statutory-compliance calendar is defined (TASK2.6).

### E. Audit & internal controls
- **E1 [V]** **Mandatory annual statutory audit** within 6 months of FY close, by Registrar-empanelled/departmental auditor or CA (CA mandatory for MSCS); **A/B/C/D grading** [U on exact criteria]; report to AGM + Registrar; rectification follow-up ~3 months.
- **E2 [V]** Five audit modes: **statutory, internal, government inspection, special, concurrent** (concurrent effectively confined to cooperative banks under RBI).
- **E3 [V]** The dominant recurring audit-defect cluster is **credit-centric**: loan overdues, NPA misclassification/under-provisioning, overdue interest booked as income — then documentation/voucher gaps, non-reconciliation, stock shortages.
- **E4 [V]** Internal-control architecture: cash limits + daily verification, **monthly signed bank reconciliation**, joint signatories, **maker-checker** for e-payments, permitted-securities discipline, **fund accounting with backing investment**, and a role-based **financial authorization matrix**; controls run on a daily/weekly/monthly/year-end cadence.

### F. Operational workflows & data
- **F1 [V]** 20 core workflows documented end-to-end (member registration → share capital → cash/bank receipt & payment → purchase/sales → inventory → procurement → godown → asset → payroll → loan → dividend → AGM → board meeting → audit prep → year-end closing → statement preparation), each with roles, registers, entries, approvals and compliance checkpoints (TASK2.5).
- **F2 [V, architecture]** The eight types share ~70–80% of functionality (members, capital, GL, compliance); differences isolate into type-specific modules — "one core, many verticals."
- **F3 [V]** The two highest-impact correctness risks are **transaction-layer data integrity** (local-vs-cloud divergence/rollback) and **reporting formula consistency** (report vs source drift).

---

## 2. Contradictions identified
| # | Contradiction | Resolution |
|---|---|---|
| C1 | PACS outlay **₹2,516 cr vs ₹2,925.39 cr**; count 63,000 vs 79,630 | **Supersession, not conflict** — first is original 2022 approval, second the revised/expanded figure. One verification vote correctly flagged ₹2,516 cr as stale. Use revised as current. |
| C2 | PACS live counts vary (40,050 → 50,455 → 63,428) | **Date-drift** across PIB releases; use latest (~63,428 live, mid-2026). |
| C3 | NDDB AMCS "**26,000+ societies / 54 unions**" vs "**25+ milk unions**" on the same source | Genuine internal inconsistency in the source → **[U]**, needs verification. |
| C4 | Genius Technology **₹90k–₹1.5L** (early directory snippet) vs verified "**no pricing on page**" (3-0) | Resolved in favour of "no published price"; the ₹90k–1.5L figure downgraded to **[U]**. |
| C5 | Statutory reserve "**25%**" vs "**25–30%**" across sources | Minor; **25% is the common baseline**, exact % is state-variant **[U per state]**. |
| C6 | ApnaComplex "**₹8/flat/mo**" vs "**$40/user/mo**"; SocietyRun "**₹25k/community/month**" | Inconsistent third-party listings → **[U]**, single-listing/needs verification. |

---

## 3. Missing information (gaps)
| # | Gap |
|---|---|
| M1 | Real customer counts / churn for private vendors (Websoftex, Genius, Fin Superb, Co-FiM, MSCS Software) — none disclose. |
| M2 | State-by-state legal variation — only **Maharashtra + central acts + NABARD** were primary-sourced; ~28 state acts not individually mapped. |
| M3 | Full **NABARD CAS specification** (complete subsidiary-register list, GL heads, statement formats) — worked from secondary summaries. |
| M4 | Apex-federation IT stacks (GCMMF/Amul, IFFCO, NAFED) — not identified. |
| M5 | Sugar cooperatives, fisheries, handloom deep-dive; FPO segment (touched only in Phase-1). |
| M6 | Play Store / app-store review mining (Phase-1 Step-4 source left untouched). |
| M7 | Actual statutory financial-statement formats (R&P, DCB, CAS) — described structurally, not reproduced. |
| M8 | Cooperative-bank (UCB/DCCB/StCB) RBI/CBS-grade accounting detail — overview only. |
| M9 | Current-year tax figures — change each Finance Act. |
| M10 | Field validation — all desk research; no practitioner interviews or live society-book samples. |

---

## 4. Unanswered questions
| # | Question |
|---|---|
| Q1 | What are the post-2027 PACS **pay-per-use** terms, and who bears them? |
| Q2 | What is per-state **NLPS deployment maturity** vs the guideline spec (which modules actually work)? |
| Q3 | Will NLPS expand beyond PACS to other cooperative types? |
| Q4 | Identity/procurement route of the **uniteerp.in** agriculture-cooperative ERP (AP/Maharashtra). |
| Q5 | **New Labour Codes** rollout timing and which registers/returns supersede Contract Labour (R&A). |
| Q6 | **RBI regulatory perimeter** for credit and multi-state credit societies. |
| Q7 | Exact **A/B/C/D audit-classification criteria** and audit-report part-structure per state. |
| Q8 | Internal-audit and concurrent-audit **compulsory thresholds** for non-bank societies. |

---

## 5. Assumptions (made in the research; carry forward with care)
| # | Assumption |
|---|---|
| AS1 | **Maharashtra (MCS Act 1960 & Rules 1961)** is used as a representative proxy for "typical" state requirements (forms, Rule 65, funds, sections). |
| AS2 | **25% statutory reserve** is the common baseline across states. |
| AS3 | Cooperative financial year is **April–March** for all types. |
| AS4 | "**Functional PACS**" (~63k–80k) approximates the commercially addressable segment (not all ~1.05 lakh registered). |
| AS5 | **Vendor self-descriptions** (feature lists, "AI" claims) reflect *stated* functionality, not independently field-verified shipped behaviour. |
| AS6 | Absent state-specific evidence, **domain-standard accounting practice** applies uniformly. |
| AS7 | Tax figures are **point-in-time (AY 2025-26)** and must be re-verified each year. |

---

## 6. Verified / Likely / Unknown — separation summary
| Tier | What sits here |
|---|---|
| **Verified** | Government/PACS structural facts (A1–A5, B1–B3); the legal spine, appropriation order, audit/governance calendar, register core, control architecture, workflow set (B1–B2, C1–C5, D1–D2, E1–E4, F1–F3); "no multi-type Cooperative OS exists" (A10). Grounded in acts/NABARD or 3-0 verification. |
| **Likely** | Dairy/housing/generic-incumbent market reads (A6–A9); type income/expense profiles (C6); tax overlay & calendar (D3–D4, point-in-time); PACS workforce constraint (B4). Single/secondary-source or Maharashtra-anchored. |
| **Unknown** | All state-by-state numeric specifics (reserve %, dividend cap, forms, deadlines, thresholds — U/M2); full CAS spec (M3); current-year tax exactness (M9); vendor customer counts (M1); NDDB union count (C3); Genius pricing (C4); housing third-party prices (C6); A/B/C/D criteria (Q7); and all §4 questions. |

---

## 7. How to use this Knowledge Base
Treat **Verified** as a dependable national baseline usable for strategy now. Treat **Likely** as directionally sound but requiring a source-check before a decision hinges on it. Treat **Unknown** as the explicit backlog — resolving the §3 gaps and §4 questions (especially state-by-state legal variation, full CAS spec, and current-year tax figures) is the natural scope of the next research phase. Every state-specific or tax-year-specific application must first clear the relevant Unknown item.

*End of Master Knowledge Base. Knowledge consolidation only — no implementation, no software design. STOP.*
