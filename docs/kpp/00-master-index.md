# KPP — Master Index

# SahakarLekha Knowledge Population Project

> The **implementation phase**: populating the system with real **Knowledge Items (KIs)** — the
> structured, single-source-of-truth records from which every future asset is generated. **A KI is not
> an article; it is a knowledge record.** *Knowledge first, content later.*
>
> **Version:** Production v1.0 (Wave 1) · **Created:** 2026-06-27 · **Owner:** Chief Knowledge Architect
> Built on the **complete, stable, unmodified** foundations: [SCOS](../scos/00-master-index.md) ·
> [SMRD](../smrd/00-master-research-index.md) · [KAE](../kae/00-master-index.md).

---

## Implementation philosophy

```
SCOS defines the STRUCTURE   (clusters, surfaces, SEO)
SMRD defines the RESEARCH    (sources, readiness)
KAE  defines the EVIDENCE     (validation, versioning, jurisdiction, API)
KPP  creates the KNOWLEDGE    (the actual Knowledge Items)  ◀── you are here
        │
        └─▶ only after KPP is mature does ARTICLE GENERATION begin
```

KPP **reuses** all foundation ids (`C###`, `SMRD:C###`, `EV-######`, module routes) and **mints only**
`KI-######`. It does **not** redesign or modify the foundations.

## The files

| # | File | Purpose |
| --- | --- | --- |
| 00 | **[Master Index](00-master-index.md)** | entry point + the KI→assets generation map |
| 01 | [KI Schema](01-knowledge-item-schema.md) | the standard production Knowledge Item record |
| 02 | [Wave Plan](02-wave-1-plan.md) | ~500 KIs grouped into Waves 1–3 (roadmap only) |
| 03 | [Population Rules](03-population-rules.md) | one concept = one KI; no dup; must ref SCOS+SMRD+KAE |
| 04 | [Knowledge Relationships](04-knowledge-relationships.md) | the KI dependency/learning graph |
| 05 | **[Wave-1 Registry](05-wave-1-registry.md)** | **356 production KIs with real ids (KI-000001–KI-000356)** |
| 06 | [Gap Analysis](06-gap-analysis.md) | missing KIs, duplicates to merge, glossary/software gaps |
| 07 | [Quality Gates](07-quality-gates.md) | the eight gates a KI passes to become `active` |

## What was populated (Wave 1)

**356 Knowledge Items** across 17 groups — the foundational spine: cooperative basics, accounting
foundations, vouchers, ledgers/COA, cash, bank, members, share capital, reserves & profit, trial
balance, financial statements, balance sheet, audit basics, **40 glossary terms**, software/SaaS
concepts, help/onboarding tasks, and FAQ concepts. Each is atomic, traced to SCOS+SMRD+KAE, with
evidence level, readiness (A–D), priority, and prerequisites. All `planned`; **0 `active`** until the
[gates](07-quality-gates.md) pass (definitions + SME where required).

---

## The KI → Assets generation map (the whole point)

> Every downstream asset is **generated FROM** an `active` Knowledge Item — never hand-authored in
> isolation, never without a cited evidence trail. One KI feeds many assets.

```
                         ┌──────────────── Knowledge Item (KI) ────────────────┐
                         │ title · definition · purpose · keywords · persona   │
                         │ topic_id(SCOS) · research_id(SMRD) · evidence(KAE)   │
                         │ relationships · modules · templates · jurisdiction   │
                         └───────────────────────┬─────────────────────────────┘
        ┌──────────────┬──────────────┬──────────┼───────────┬──────────────┬──────────────┐
        ▼              ▼              ▼           ▼           ▼              ▼              ▼
  Blog Article      FAQ          Help Guide   AI Answer     PDF /        Excel         Calculator
 (SCOS blueprint) (FAQPage)     (HowTo)      (KAE API,    Checklist    Template       (SMRD 09 +
  from def+purpose  from KI Q   from related  cited+juris) (SMRD 08)    (SMRD 08)      KI formula)
        │              │              │           │           │              │              │
        └──────────────┴──────────────┴────┬──────┴───────────┴──────────────┴──────────────┘
                                            ▼                        ▼
                                  SaaS Module Doc            Video Script
                                  (from related_module +     (from def + purpose +
                                   product KIs)               worked example)
```

| Asset | Generated from KI fields | Governed by |
| --- | --- | --- |
| **Blog article** | title, definition, purpose, keywords, persona, related_* | [SCOS 12 blueprint](../scos/12-article-blueprint.md) |
| **FAQ** | question-concept KI + linked answer KI | FAQPage schema ([SCOS 07](../scos/07-seo-engine.md)) |
| **Help guide** | procedural KI + prerequisites + module | HowTo ([SCOS 02](../scos/02-knowledge-architecture.md)) |
| **AI answer** | definition + evidence + jurisdiction + citations | [KAE 11 API](../kae/11-ai-knowledge-api.md) |
| **PDF / checklist** | KI + related checklist concept | [SMRD 08](../smrd/08-template-opportunities.md) |
| **Excel template** | KI + format (validated) | [SMRD 08](../smrd/08-template-opportunities.md) |
| **Calculator** | KI formula + inputs (validated rates) | [SMRD 09](../smrd/09-tool-opportunities.md) |
| **SaaS module doc** | product KIs + related_module | product |
| **Video script** | definition + purpose + worked example | from KI |

**Guarantees on every generated asset:** it (1) inherits the KI's readiness level, (2) cites the KI's
evidence, (3) is jurisdiction-correct, and (4) carries the KI's version `as_of` — because the KI is the
source of truth, generation cannot fabricate beyond it. *Truth in, truth out.*

## The full stack (one integrated system)

```
KAE (engine) ─ KPP (knowledge) ─ SMRD (research) ─ SCOS (structure)
        │             │
        └──── Knowledge Items ────┘
                  │ generate
                  ▼
  Articles · FAQs · Help · AI Answers · PDFs · Excel · Calculators · SaaS Docs · Videos
```

## Operating rules
1. **One concept = one KI**; no duplicates; merge near-duplicates.
2. **Every KI references SCOS + SMRD + KAE** — no orphan knowledge.
3. **Sourced or NEV**; A-level ships without SME, B/C/D need E3 + SME.
4. **No fabrication** — definitions/rates/provisions only from evidence.
5. **Knowledge first, content later** — assets are generated only from `active` KIs.
6. **Do not redesign the foundations** — KPP populates, it does not re-architect.

## Immediate next actions (from [06 Gap Analysis](06-gap-analysis.md) / [07 Gates](07-quality-gates.md))
1. 🔴 Write **Level-A definitions** for Wave 1 → advance ~210 educational/product KIs to `active` (no SME).
2. 🔴 Instantiate `EV-` evidence records + stand up the **KI data store** (markdown spec → tables/JSON).
3. 🟠 **Engage the SME** → clear Wave-1 **B** accounting KIs (then C/D).
4. 🟠 Populate **Wave 2** (inventory, loans, sales/purchase, assets, payroll, deposits).
5. 🟢 Only after KPP matures → begin **article generation** from `active` KIs.

---

*Start at [01-knowledge-item-schema.md](01-knowledge-item-schema.md), or open
[05-wave-1-registry.md](05-wave-1-registry.md) to see the 356 production Knowledge Items. This database
is the source of truth; every future article, FAQ, template, calculator, AI answer, and SaaS doc is
generated from it. No assets are generated here — only the knowledge that powers them.*
