# 03 — Topic Research Registry

> Expands **every SCOS cluster** (C001–C386, [SCOS 03](../scos/03-topic-registry.md)) into a **research
> record**. SMRD does **not** restate the topic, persona, or deliverables — those live in SCOS and are
> referenced by id (anti-duplication). SMRD adds the *research* fields: status, gaps, required sources,
> evidence level, and the NEV flag.

**Record schema (per cluster id):**
```yaml
topic_id: C112                       # = SCOS cluster id (topic, persona, deliverables → SCOS 03)
cluster: depreciation
research_status: open|sourcing|sourced(E2)|sme-review|validated(E3/E4)
evidence_level: E0..E4 | NEV         # from 01 §3
priority: P0..P3                     # inherits SCOS priority
knowledge_gaps: [ ... ]              # what we still need to know
required_sources: [SRC-STD-ICAI-GN, SRC-TAX-IT-ACT, SRC-INT-MODULES]   # ids from 02
target_persona: [ACC, AUD]           # ref SCOS 05 (not re-derived)
possible_deliverables: → SCOS 03 row + 08/09 SMRD
nev: true|false
recheck_on: <date or trigger>
```

**Status legend (foundation v1.0 baseline):**
`open` = no source attached yet · `E2†` = internal corroboration exists (`/guide`,`/cookbook`,module)
but statutory parts pending primary+SME · `NEV` = blocked on expert validation.
At v1.0, **most records are `open` or `E2†`; none are `validated(E3)` until an SME is engaged.**

> The tables below give each cluster's **research_status · key knowledge gap · required source ids ·
> NEV**. Persona & deliverables: see the matching SCOS C-id. (`†` = internal source already exists.)

---

## D01 · Cooperative Sector & Foundations
*Profile:* low statutory risk for concept records; registration/byelaws are state-variable → NEV. Sources: SRC-GOV-MOC, SRC-GOV-MSCS, SRC-ST-ACT-{XX}, SRC-EDU-*, SRC-INT-GUIDE.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C001 | E2† | none major (definitional) | SRC-EDU-VAMNICOM, SRC-INT-GUIDE | no |
| C002 | E2† | Indian-context phrasing of ICA principles | SRC-REG-NCUI, SRC-EDU-* | no |
| C003 | open | dates/milestones accuracy | SRC-GOV-MOC, SRC-EDU-UNIV | no |
| C004 | E2† | precise legal definition per type | SRC-ST-ACT-{XX}, SRC-INT-GUIDE | yes |
| C005 | open | per-state registration steps/forms | SRC-ST-ACT-{XX}, SRC-ST-RCS-{XX} | yes |
| C006 | open | dissolution/liquidation procedure | SRC-ST-ACT-{XX} | yes |
| C007 | open | current mandates of each body | SRC-REG-NABARD, SRC-REG-NCDC, SRC-REG-NCUI | no |
| C008 | open | federation tier rules | SRC-ST-ACT-{XX}, SRC-REG-NAFSCOB | yes |
| C009 | E2† | member rights per state act | SRC-ST-ACT-{XX} | yes |
| C010 | open | model byelaw clauses | SRC-ST-BYELAW-{XX} | yes |
| C011 | open | FPO/SHG structural/legal contrast | SRC-GOV-MOC, SRC-EDU-* | yes |
| C012 | open | policy specifics | SRC-GOV-NCP | no |

## D02 · Society-Type Accounting
*Profile:* sector-specific treatments → high NEV. Sources: SRC-OPS-*, SRC-ST-AUDITMAN-{XX}, SRC-STD-ICAI-*, SRC-INT-COOKBOOK/MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C013 PACS | open | CAS-aligned COA + crop-loan ledgers | SRC-OPS-PACSCAS, SRC-OPS-PACS-COA, SRC-REG-NABARD | yes |
| C014 MPACS | open | multi-activity segregation | SRC-OPS-PACSCAS | yes |
| C015 Dairy | E2† | fat/SNF payment ledger treatment | SRC-OPS-DAIRY | yes |
| C016 Consumer | E2† | retail+GST stock treatment | SRC-TAX-GST-ACT, SRC-INT-COOKBOOK | yes |
| C017 Marketing/MSP | E2† | MSP+kachi-aarat commission accounting | SRC-OPS-MARKETING, SRC-INT-GUIDE | yes |
| C018 Credit | open | deposit/loan/interest + NPA | SRC-REG-NABARD, SRC-REG-RBI | yes |
| C019 Housing | open | sinking/maintenance fund treatment | SRC-ST-ACT-{XX} | yes |
| C020 Labour | open | wage/contract distribution | SRC-ST-ACT-{XX} | yes |
| C021 Processing | open | WIP/finished-goods costing | SRC-STD-ICMAI | yes |
| C022 Weavers | open | yarn/production ledgers | SRC-OPS-* | yes |
| C023 Fisheries | open | catch/cold-storage treatment | SRC-OPS-* | yes |
| C024 Federation | E2† | consolidation + member-society dues | SRC-INT-MODULES | yes |

## D03 · Accounting Foundations
*Profile:* mostly principle-level (lower NEV) but COA/opening tie to statutory formats. Sources: SRC-STD-ICAI-*, SRC-INT-GUIDE/COA.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C025 | E2† | none (principle) | SRC-INT-GUIDE | no |
| C026 | E2† | none (principle) | SRC-INT-GUIDE | no |
| C027 | E2† | statutory books required per state | SRC-ST-ACT-{XX} | yes |
| C028 | E2† | none | SRC-INT-GUIDE | no |
| C029 | open | basis prescribed for societies | SRC-ST-ACT-{XX}, SRC-STD-ICAI-AS | yes |
| C030 | E2† | none (principle) | SRC-STD-ICAI-AS | no |
| C031 | E2† | type-wise standard COA | SRC-OPS-PACS-COA, SRC-INT-COA | yes |
| C032 | E2† | grouping conventions | SRC-INT-COA | no |
| C033 | E2† | migration correctness | SRC-INT-MODULES | no |
| C034 | E2† | none (glossary) | SRC-INT-GUIDE | no |
| C035 | E2† | none (dictionary) | SRC-INT-GUIDE | no |
| C036 | E2† | error-types coverage | SRC-INT-GUIDE | no |

## D04 · Vouchers & Transactions
*Profile:* entries corroborated by `/cookbook` (T5) but Dr/Cr must reach E3. Sources: SRC-INT-COOKBOOK/MODULES, SRC-STD-ICAI-AS.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C037 | E2† | none (mechanics) | SRC-INT-COOKBOOK | no |
| C038–C042 | E2† | exact Dr/Cr per scenario (SME) | SRC-INT-COOKBOOK | yes |
| C043 | E2† | maker-checker control norms | SRC-ST-AUDITMAN-{XX} | no |
| C044 | E2† | none | SRC-INT-GUIDE | no |
| C045 | open | numbering/audit-trail norms | SRC-ST-AUDITMAN-{XX} | no |
| C046 | E2† | cancel/soft-delete audit rules | SRC-ST-AUDITMAN-{XX} | yes |
| C047 | E2† | none (quick ref) | SRC-INT-GUIDE | no |
| C048 | open | backdated/FY-lock legal limits | SRC-ST-ACT-{XX} | yes |

## D05 · Final Accounts & Reports
*Profile:* statutory formats vary; report→form mapping is NEV. Sources: SRC-ST-ACT-{XX}, SRC-STD-ICAI-AS, SRC-INT-MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C049–C053 | E2† | prescribed statutory format per state | SRC-ST-ACT-{XX}, SRC-INT-MODULES | yes |
| C054 | E2† | none (interpretation) | SRC-INT-GUIDE | no |
| C055 | open | exact report→statutory-form map | SRC-ST-ACT-{XX}, SRC-INT-GUIDE | yes |
| C056 | E2† | sector-standard ratio benchmarks | SRC-REG-NABARD | yes |
| C057 | open | required schedules list | SRC-ST-AUDITMAN-{XX} | yes |
| C058–C060 | E2† | none (computation) | SRC-INT-MODULES | no |

## D06 · Members, Shares & Capital
*Profile:* share/nomination/Form-1 governed by state act → NEV. Sources: SRC-ST-ACT-{XX}, SRC-INT-MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C061 | E2† | admission/exit legal steps | SRC-ST-ACT-{XX} | yes |
| C062 | open | share issue/transfer/refund rules | SRC-ST-ACT-{XX} | yes |
| C063 | E2† | none (sub-ledger) | SRC-INT-MODULES | no |
| C064 | open | nomination/transmission law | SRC-ST-ACT-{XX} | yes |
| C065 | open | Form-1 format per state | SRC-ST-RCS-{XX} | yes |
| C066–C068 | open | fees/dormancy rules | SRC-ST-ACT-{XX} | yes |

## D07 · Loans, Advances & Recovery
*Profile:* NABARD/RBI + state act; NPA norms NEV. Sources: SRC-REG-NABARD, SRC-REG-RBI, SRC-INT-MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C069 | E2† | disbursement/repayment treatment | SRC-INT-COOKBOOK | yes |
| C070 | E2† | penal/reducing method norms | SRC-REG-NABARD, SRC-INT-MODULES | yes |
| C071 KCC | open | scale-of-finance, subvention, drawing power | SRC-REG-NABARD | yes |
| C072 | open | demand/recovery legal process | SRC-ST-ACT-{XX} | yes |
| C073 NPA | open | classification + provisioning norms | SRC-REG-NABARD, SRC-REG-RBI | yes |
| C074 | E2† | bucketing convention | SRC-INT-MODULES | no |
| C075 | open | product/scheme definitions | SRC-REG-NABARD | yes |
| C076 | open | OTS policy/accounting | SRC-ST-ACT-{XX} | yes |
| C077 | E2† | none (amortization) | SRC-INT-MODULES | no |
| C078 | open | subvention/subsidy accounting | SRC-REG-NABARD | yes |

## D08 · Deposits & Savings
*Profile:* deposit + TDS; coop-bank rules NEV. Sources: SRC-REG-RBI, SRC-TAX-TRACES, SRC-REG-DICGC.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C079 | open | deposit-type treatment + interest accrual | SRC-REG-NABARD | yes |
| C080–C081 | E2† | interest/maturity formula confirm | SRC-INT-MODULES | yes |
| C082 | open | TDS on interest + 15G/15H | SRC-TAX-TRACES | yes |
| C083 | open | pigmy/daily-deposit treatment | SRC-OPS-* | yes |
| C084 | open | DICGC applicability | SRC-REG-DICGC | yes |

## D09 · Inventory, Stock & Procurement
*Profile:* valuation = ICAI AS; MSP/aarat sector. Sources: SRC-STD-ICAI-GN, SRC-OPS-MARKETING, SRC-INT-MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C085 | E2† | none (mechanics) | SRC-INT-MODULES | no |
| C086 | E2† | method choice + NRV per AS | SRC-STD-ICAI-GN | yes |
| C087 | E2† | closing-stock formula (matches CLAUDE.md rule) | SRC-INT-MODULES | no |
| C088 MSP | E2† | procurement accounting + commission | SRC-OPS-MARKETING, SRC-INT-GUIDE | yes |
| C089 Aarat | E2† | kachi-aarat treatment | SRC-INT-MODULES | yes |
| C090 | E2† | HSN→rate mapping | SRC-TAX-GST-PORTAL | yes |
| C091–C094 | open | verification/loss/godown/KPIs | SRC-ST-AUDITMAN-{XX} | yes |

## D10 · Sales, Purchase & Trading
*Profile:* GST-bound; entries in cookbook. Sources: SRC-TAX-GST-*, SRC-INT-COOKBOOK.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C095–C096 | E2† | GST treatment + ITC | SRC-TAX-GST-ACT, SRC-INT-COOKBOOK | yes |
| C097 | E2† | per-item ledger routing (matches RULE 4) | SRC-INT-MODULES | no |
| C098–C100 | E2† | none (mechanics) | SRC-INT-MODULES | no |
| C101 | E2† | matching/partial rules | SRC-INT-GUIDE | no |
| C102 | open | returns/credit-note GST adj | SRC-TAX-GST-ACT | yes |
| C103–C104 | open | discount/margin treatment | SRC-STD-ICAI-AS | yes |

## D11 · Banking & Reconciliation
*Profile:* mechanics (low NEV) + cash-limit rules (state). Sources: SRC-INT-MODULES, SRC-ST-AUDITMAN-{XX}.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C105–C108 | E2† | none (mechanics) | SRC-INT-MODULES | no |
| C109 | open | digital-payment accounting norms | SRC-INT-GUIDE | no |
| C110 | open | statutory cash-in-hand limit | SRC-ST-ACT-{XX} | yes |

## D12 · Assets & Depreciation
*Profile:* AS + Income-tax rates; high NEV on rates. Sources: SRC-STD-ICAI-GN, SRC-TAX-IT-ACT, SRC-INT-MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C111 | E2† | none (register) | SRC-INT-MODULES | no |
| C112 | E2† | SLM/WDV **rates** + method per society | SRC-STD-ICAI-GN, SRC-TAX-IT-ACT | yes |
| C113 | E2† | disposal P/L treatment | SRC-STD-ICAI-AS | yes |
| C114 | open | capital-vs-revenue boundary | SRC-STD-ICAI-AS | yes |
| C115–C116 | open | revaluation/grant treatment | SRC-STD-ICAI-AS | yes |

## D13 · Payroll & HR
*Profile:* EPF/ESI/PT/TDS statutory. Sources: SRC-TAX-TRACES, SRC-TAX-PT-{XX}, statutory bodies.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C117 | E2† | payslip components | SRC-INT-MODULES | no |
| C118 EPF | open | PF rates/ECR | (EPFO) `⚠️` | yes |
| C119 ESI | open | ESI thresholds/rates | (ESIC) `⚠️` | yes |
| C120 PT | open | state PT slabs | SRC-TAX-PT-{XX} | yes |
| C121 | open | salary TDS (24Q) | SRC-TAX-TRACES | yes |
| C122–C123 | open | gratuity/bonus/honorarium rules | SRC-ST-ACT-{XX} | yes |

## D14 · Taxation — GST
*Profile:* entirely SRC-TAX-GST-*; all NEV, frequently changing.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C124–C133 | open | applicability, ITC, returns, RCM, e-way, member-mutuality, exemptions, rates, 9/9C | SRC-TAX-GST-ACT, SRC-TAX-GST-PORTAL, SRC-FAQ-GST | yes |

## D15 · Taxation — TDS & Income Tax
*Profile:* SRC-TAX-IT-* / TRACES; 80P central to societies; all NEV.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C134–C137 | open | TDS sections/rates, 26Q, 16A | SRC-TAX-TRACES, SRC-TAX-IT-ACT | yes |
| C138 80P | open | deduction scope/conditions | SRC-TAX-IT-ACT, SRC-PRO-CA | yes |
| C139–C142 | open | ITR, advance tax, TCS, audit thresholds | SRC-TAX-IT-PORTAL | yes |

## D16 · Audit
*Profile:* state audit manual + ICAI; classification/grading NEV. Sources: SRC-ST-AUDITMAN-{XX}, SRC-STD-ICAI-AUD.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C143 | E2† | state audit process/scope | SRC-ST-AUDITMAN-{XX} | yes |
| C144 | E2† | none (prep checklist exists) | SRC-INT-GUIDE | no |
| C145 | open | grading criteria (A/B/C/D) | SRC-ST-AUDITMAN-{XX} | yes |
| C146–C147 | open | internal/concurrent scope | SRC-REG-RBI, SRC-ST-AUDITMAN-{XX} | yes |
| C148 | E2† | objection-reply norms | SRC-ST-AUDITMAN-{XX} | yes |
| C149–C150 | open | schedule/certificate formats | SRC-ST-AUDITMAN-{XX} | yes |
| C151 | E2† | trail/maker-checker | SRC-INT-MODULES | no |
| C152 | open | special/cost-audit triggers | SRC-ST-ACT-{XX} | yes |
| C153 | E2† | top-objection catalogue | SRC-PRO-CA | yes |

## D17 · Compliance & Statutory Returns
*Profile:* RCS/NABARD/RBI returns; deadlines state-variable. Sources: SRC-ST-RCS-{XX}, SRC-REG-NABARD, SRC-REG-RBI.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C154 | E2† | per-state return list/forms | SRC-ST-RCS-{XX} | yes |
| C155–C156 | open | NABARD/federation formats | SRC-REG-NABARD | yes |
| C157 | E2† | mandatory register list per state | SRC-ST-ACT-{XX} | yes |
| C158 | open | consolidated due-date calendar | SRC-ST-RCS-{XX}, SRC-TAX-* | yes |
| C159 | open | penalty provisions | SRC-ST-ACT-{XX} | yes |
| C160 | open | RBI coop-bank compliance | SRC-REG-RBI | yes |
| C161–C162 | open | reserve/education-fund % | SRC-ST-ACT-{XX} | yes |

## D18 · Governance & Meetings
*Profile:* AGM/board/election rules per state act. Sources: SRC-ST-ACT-{XX}, SRC-ST-BYELAW-{XX}.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C163 AGM | open | notice/quorum/agenda rules | SRC-ST-ACT-{XX} | yes |
| C164–C165 | E2† | meeting/minutes norms | SRC-ST-ACT-{XX} | yes |
| C166 | open | election procedure/authority | SRC-ST-ACT-{XX} | yes |
| C167 | open | board constitution/tenure | SRC-ST-ACT-{XX} | yes |
| C168 | open | resolution drafting/types | SRC-ST-BYELAW-{XX} | yes |
| C169–C171 | open | grievance/ethics/disclosure | SRC-ST-ACT-{XX} | yes |

## D19 · Profit, Reserves & Distribution
*Profile:* appropriation order + reserve % are state-statutory → NEV. Sources: SRC-ST-ACT-{XX}, SRC-INT-MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C172 | E2† | statutory appropriation order | SRC-ST-ACT-{XX} | yes |
| C173 | open | min reserve %, fund types | SRC-ST-ACT-{XX} | yes |
| C174 | open | dividend rate cap rules | SRC-ST-ACT-{XX} | yes |
| C175–C177 | open | bonus/patronage/surplus treatment | SRC-ST-ACT-{XX} | yes |

## D20 · Budgeting & Financial Management
*Profile:* mostly management (low NEV). Sources: SRC-INT-MODULES, SRC-REG-NABARD (benchmarks).

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C178–C183 | E2† | sector benchmarks for ratios/viability | SRC-REG-NABARD | no* |

\*low statutory risk; benchmark figures still need a source.

## D21 · Digital Transformation
*Profile:* scheme facts (PACS computerization). Sources: SRC-GOV-MEITY, SRC-GOV-MOC.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C184–C185 | E2† | none (benefit/process) | SRC-INT-GUIDE | no |
| C186 | open | scheme scope/eligibility | SRC-GOV-MEITY | yes |
| C187–C191 | open | adoption facts; migration accuracy | SRC-INT-MODULES | no |

## D22 · Technology & Data
*Profile:* product-grounded (low NEV). Sources: SRC-INT-MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C192–C198 | E2† | none (product/process) | SRC-INT-MODULES | no |

## D23 · AI in Cooperative Accounting
*Profile:* forward-looking; compliance claims NEV. Sources: SRC-INT-MODULES, SRC-EDU-PAPERS.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C199–C205 | open | evidence for fraud/scoring claims; privacy law | SRC-EDU-PAPERS | yes |

## D24 · State-wise & Regulatory Landscape
*Profile:* fully NEV, per-state. Drives [07](07-state-wise-registry.md). Sources: SRC-ST-ACT-{XX}, SRC-ST-RCS-{XX}, SRC-GOV-MSCS.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C206–C212 | open | per-state act/registrar/types/compliance | SRC-ST-* (per state) | yes |

## D25 · Error Rectification & Troubleshooting
*Profile:* product + accounting; corroborated by guide. Sources: SRC-INT-GUIDE/MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C213–C219 | E2† | rectification-entry correctness (SME) | SRC-INT-GUIDE | partial |

## D26 · Onboarding, Help & Training
*Profile:* product how-tos, mostly internal (low NEV). Sources: SRC-INT-GUIDE/MODULES.

| ID | Status | Key knowledge gap | Req sources | NEV |
|---|---|---|---|---|
| C220–C230 | E2† | none (product-grounded) | SRC-INT-GUIDE, SRC-INT-MODULES | no |

---

## Expansion clusters (D27–D30) — inherited research profiles
- **D27 type×topic (C231–C302):** inherit the *generic* topic's research record **plus** a sector source (SRC-OPS-* / SRC-ST-AUDITMAN-{XX}); NEV = yes wherever the generic is NEV. Do **not** open a record unless a real sector delta exists.
- **D28 state×type (C303–C326):** inherit from [07](07-state-wise-registry.md) per-state record; all NEV.
- **D29 calculator/template landings (C327–C366):** research = the underlying formula/format record ([05](05-accounting-research.md)/[08](08-template-opportunities.md)/[09](09-tool-opportunities.md)); NEV per formula.
- **D30 comparison/"vs" (C367–C386):** research = both compared nodes' records; low incremental NEV.

> **Coverage:** 230 canonical research records (above) + ~156 inherited = **386**, 1:1 with SCOS. Status
> rollup feeds the [Gap Analysis](00-master-research-index.md) and [Content Readiness](10-content-readiness.md).

---

### Cross-references
[Source Registry](02-source-registry.md) · [Search Intelligence](04-search-intelligence.md) · [Accounting Research](05-accounting-research.md) · [Law & Compliance](06-law-and-compliance.md) · [Content Readiness](10-content-readiness.md) · [SCOS Topic Registry](../scos/03-topic-registry.md)
