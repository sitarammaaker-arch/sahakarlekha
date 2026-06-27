# SMRD — Master Research Index

# SahakarLekha Master Research Database

> The **truth-and-source layer** beneath the [SCOS](../scos/00-master-index.md). SCOS decides what to
> build and how to render it; **SMRD decides what is verified, where it came from, and whether it may be
> written yet.** Research infrastructure only — no articles, no SEO, no publishing.
>
> **Version:** Foundation v1.0 · **Created:** 2026-06-27 · **Owner:** Lead Research Architect
> **Prime directives:** *Never invent treatments or provisions. Primary source + SME before publish.
> Jurisdiction on every legal fact. `NEV` until E3.*

---

## The two-layer model

```
SMRD (truth)                          SCOS (rendering)
─────────────                         ────────────────
sources, evidence levels,    ──E3──▶  clusters, surfaces, SEO,
validation, jurisdiction,             internal links, lead funnels,
gaps, readiness gates                 article blueprints, roadmap
        │                                     │
        └──────── keyed by cluster id (C001–C386) ───────┘
SMRD owns TRUTH · SCOS owns RENDERING
```

## The files

| # | File | Purpose |
| --- | --- | --- |
| 00 | **[Master Research Index](00-master-research-index.md)** | this map + **Gap Analysis** (below) |
| 01 | [Research Methodology](01-research-methodology.md) | philosophy, source hierarchy, evidence levels (E0–E4/NEV), validation workflow, dedup, versioning, updates |
| 02 | [Source Registry](02-source-registry.md) | master source list (10 groups, `SRC-` ids, tiers, cadence) |
| 03 | [Topic Research Registry](03-topic-research-registry.md) | every SCOS cluster → research record (status, gaps, sources, NEV) |
| 04 | [Search Intelligence](04-search-intelligence.md) | per-topic question inventory + demand signals (no fabricated metrics) |
| 05 | [Accounting Research](05-accounting-research.md) | accounting research **framework** (questions, not answers) |
| 06 | [Law & Compliance](06-law-and-compliance.md) | legal research map with mandatory jurisdiction tags |
| 07 | [State-wise Registry](07-state-wise-registry.md) | 28 states + 8 UTs research stubs |
| 08 | [Template Opportunities](08-template-opportunities.md) | every topic → template + format-validation status |
| 09 | [Tool Opportunities](09-tool-opportunities.md) | every topic → calculator/generator/wizard/checker/… |
| 10 | [Content Readiness](10-content-readiness.md) | the 6 flags + **Quality Gates** (writable gate) |

## How a fact moves through SMRD

```
02 Source found → 03 Research record opened (keyed to SCOS id)
   → 05/06 framework says what to verify → 04 demand intelligence gathered
   → primary source attached (E2) → SME sign-off (E3)  ⟵ blocking gate
   → 08/09 template & tool opportunities linked
   → 10 readiness flags flip → WRITABLE → handoff to SCOS 11
```
**One record, many uses:** the same validated fact powers an article, a calculator, a template, an
`/ask` answer, and a SaaS feature.

## Grounded in the repo (reuse, never duplicate)
- Topics: **referenced** by SCOS id — SMRD never re-defines a topic.
- Internal corroboration (T5): `/guide` (47 ch.), `/cookbook` (~40 recipes), `/help`, `/faq`, and ~95
  module formulas are cited as evidence, **not re-derived**.
- Live infra reused: drip + daily rebuild for re-validation scheduling; feedback inbox + `/ask` logs as
  question sources; existing 3 magnets as validated-template seeds.

---

# GAP ANALYSIS REPORT (v1.0)

> What the database does **not** yet have. This is the research backlog. Honest baseline: the
> *framework* is complete; the *verified content* is mostly pending the SME gate.

## 0. The one blocking gap (everything hinges on this)
- **No SME engaged.** A CA / cooperative auditor is required to clear gates G2/G3 (E3). Until then **0
  topics are `ready_for_writing`** ([10](10-content-readiness.md)). *Single highest-leverage action.*

## 1. Missing research areas
| Gap | Where | Severity |
| --- | --- | --- |
| All tax content (GST, TDS, IT/80P) unsourced to primary + dated | D14, D15 | 🔴 high (high demand) |
| Statutory financial-statement formats + report→form map | C050–C055 | 🔴 high |
| Depreciation rates/method authority | C112 | 🔴 high (high demand + magnet) |
| Profit appropriation order + reserve %/dividend cap | D19 | 🔴 high (state) |
| NPA classification/provisioning norms | C073 | 🟠 med |
| Audit grading criteria + objection catalogue | C145, C153 | 🟠 med |
| Sector treatments (PACS CAS, dairy fat-SNF, MSP/aarat, KCC subvention) | D02, C088/C089 | 🟠 med |
| Deposits + interest + TDS (15G/15H) | D08 | 🟠 med |
| Payroll statutory (EPF/ESI/PT/24Q) | D13 | 🟠 med |
| AI claims (fraud/scoring) lack evidence | D23 | 🟡 low |

## 2. Missing government references (sources to instantiate in [02](02-source-registry.md))
- **PACS CAS manual + standard COA** (`SRC-OPS-PACSCAS`, `SRC-OPS-PACS-COA`) — not yet captured.
- **Per-state Acts/Rules/Audit-manuals** (`SRC-ST-*-{XX}`) — **0 of 36** instantiated.
- **Current tax notifications** (CBIC/CBDT) snapshots with `as_of` — none captured.
- **NABARD/RBI** specific circulars for NPA, credit norms, coop-bank prudential — pointers only, no captures.
- **EPFO/ESIC** sources missing entirely from the registry (add for D13).

## 3. Missing accounting references
- **ICAI AS/Guidance Notes** captures for depreciation, inventory (NRV), revenue, provisions — pointers only.
- **Society-specific statement formats** (I&E, appropriation, fund accounts) — no primary capture.
- **Rectification-entry** treatments unvalidated (E2† internal only).
- **Cost-accounting** references for processing societies (`SRC-STD-ICMAI`) — none.

## 4. Missing state coverage
- **36/36 jurisdictions at `open`.** Not one state record validated.
- Act **titles/years unconfirmed** (all leads marked `⚠️ confirm`).
- No state-specific facts captured → **D24/D28 state pages cannot pass the thin-content guard yet.**
- Wave-1 priority (MH, GJ, RJ, UP, MP, PB, HR, KA, KL, TN, AP, TG) is the first target.

## 5. Missing templates ([08](08-template-opportunities.md))
- **Statutory-format templates** (returns checklist, registers pack, Form-1, AGM kit, resolutions,
  objection reply, compliance calendar) — all `open`, format unvalidated.
- **Society-type COA packs (×12)** — not started.
- Even **live magnets** (audit/GST/inventory checklists) lack a primary-source format validation stamp.

## 6. Missing calculators / tools ([09](09-tool-opportunities.md))
- High-value calculators **exist as module logic** ✅ but **rates/methods unvalidated** (depreciation,
  GST, TDS, NPA, dividend, reserve) — cannot ship as authority tools yet.
- **No public `/tools` surface** exists yet (route to be added).
- Generators (notice/minutes/resolution), validators (compliance/audit-readiness), and statutory
  **export** tools — not built.

## 7. Missing downloads / infrastructure
- **No `/downloads` hub** route yet (planned in SCOS).
- **No download manifest** (to power hub + sitemap + lead `source`).
- **No SME-validation badge** component/stamp in the content pipeline.
- **No graph-edge front-matter** populated on existing assets (needed for G5 link-availability at scale).

## 8. Data/measurement gaps (block [04](04-search-intelligence.md))
- **No keyword/volume/KD data** (left "Research Required" — never fabricated).
- **Search Console / GA query data** not yet mined; `/ask` + inbox question logs not yet harvested.

---

## Recommended research sequence (from the gaps)
1. **Engage an SME** (CA/cooperative auditor) — unblocks G2/G3 for everything. 🔴
2. Capture **PACS CAS + standard COA** and **statutory statement formats** (broad unlock).
3. Snapshot **current tax** (GST/TDS/IT-80P) with `as_of` — highest demand.
4. Validate **depreciation, appropriation/reserve, NPA** (high-value + magnets/tools ready).
5. Instantiate **Wave-1 state records** ([07](07-state-wise-registry.md)).
6. Stamp **live magnets** + wrap **existing module calculators** as validated public tools.
7. Wire **graph-edge front-matter** + stand up `/tools` and `/downloads` surfaces (engineering).

> When a topic clears these, it flips to **WRITABLE** in [10](10-content-readiness.md) and hands off to the
> [SCOS content engine](../scos/11-content-engine.md). **No content is written before that.**

---

*This index links every SMRD file; each file ends with its own cross-references. Start at
[01-research-methodology.md](01-research-methodology.md), or jump to
[10-content-readiness.md](10-content-readiness.md) to see exactly what is (not yet) cleared to write.*
