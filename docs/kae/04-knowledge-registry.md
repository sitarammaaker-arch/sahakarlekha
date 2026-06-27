# 04 — Knowledge Registry

> The registry of **Knowledge Items (KIs)** — the atomic unit of KAE. One KI = **one verifiable
> claim**. KIs key upward to a SMRD research record and a SCOS cluster (reuse, never re-define).
> The registry is designed to be implemented as a **table/JSON store**; this file is its schema +
> conventions + seed taxonomy.

---

## 1. Knowledge Item schema

```yaml
knowledge_id: KI-00731                  # stable, unique, never reused
topic_id: C173                          # SCOS cluster (→ scos/03)
research_id: SMRD:C173                   # SMRD research record (→ smrd/03)
title: "Statutory minimum reserve-fund transfer % (State RJ)"
claim: "<the single atomic assertion>"   # the fact itself (NEV until E3)
domain: Profit-Reserves                  # → SCOS domain (D19)
subdomain: Reserve Fund
knowledge_type: legal | accounting | compliance | procedural | definitional | computational | product
evidence_id: EV-000412                   # → 03 (1:1)
evidence_status: E2 | E3 | NEV ...       # mirror of evidence_level
source_count: 2
jurisdiction: STATE:RJ                    # → 05
version: 2                                # → 06
lifecycle_state: active | draft | superseded | retired ...   # → 01 §2
dependencies: [KI-00120]                  # derived_from / requires (→ 01 §7, 09)
related_topics: [C172, C174]              # SCOS ids (content graph)
related_kis: [KI-00732, KI-00733]         # cross-refs (→ 09)
readiness_level: A|B|C|D                   # → 10
last_verified: 2026-06-27
next_review_date: 2027-03-01
```

## 2. Knowledge types (the `knowledge_type` vocabulary)

| Type | Example claim | Default readiness ([10](10-content-readiness-engine.md)) | SME? |
| --- | --- | --- | --- |
| **definitional** | "A PACS is a primary agricultural credit society" | A | no |
| **product** | "The depreciation module uses SLM/WDV per asset" | A | no |
| **computational** | "Closing stock = opening + purchases − issues" | A/B | light |
| **accounting** | "<treatment / Dr-Cr for scenario X>" | B | yes |
| **compliance** | "<which return, what frequency>" | C | yes |
| **legal** | "<provision / section / statutory %>" | D | yes |
| **procedural** | "<steps to file/register>" | B/C | varies |

## 3. ID conventions
- `KI-#####` global sequential, **never reused** (retired ids stay retired).
- `EV-######` evidence ids 1:1 with KIs.
- **Reuse** `C###` (SCOS), `SMRD:*`, `SRC-*` ids — KAE mints only `KI-`/`EV-` ids.

## 4. Atomicity rule (what counts as one KI)
- ✅ "Reserve fund minimum transfer % — State RJ" (one claim, one jurisdiction).
- ❌ "Reserve fund rules across India" (compound — split into per-state KIs).
- A statutory **% that differs by state** = N KIs (one per state), each separately evidenced/versioned.
- A treatment that is **identical nationally** = 1 KI with jurisdiction CENTRAL.

> Atomicity is what lets KAE version, cite, and serve precisely — and lets the jurisdiction engine pick
> the right fact for a given society without ambiguity.

## 5. Relationship fields
- `dependencies` — typed in [09](09-cross-reference-engine.md) (`derived_from`, `requires`, `amends`, `supersedes`, `applies_to`). Drives cascade re-review ([07](07-update-engine.md)).
- `related_topics` — SCOS cluster ids (for content linking).
- `related_kis` — sibling facts (e.g. all per-state variants of the same rule) via a shared `concept_key`.

## 6. Concept keys (grouping per-jurisdiction variants)
A `concept_key` groups KIs that are the *same rule across jurisdictions*:
```
concept_key: reserve-fund-min-pct
  ├─ KI-00731 (STATE:RJ)
  ├─ KI-00744 (STATE:MH)
  └─ KI-00802 (CENTRAL fallback / model byelaw)   # used when state unknown, flagged
```
The [jurisdiction engine](05-jurisdiction-engine.md) resolves `concept_key + context → the right KI`.

## 7. Registry → SMRD/SCOS rollup
- Each SMRD research record (per cluster) rolls up the **status of its child KIs**: a cluster is
  "research_complete" only when all its required KIs reach E3/NEV-cleared.
- Each SCOS cluster's **readiness** ([SMRD 10](../smrd/10-content-readiness.md)) is computed from its KIs'
  evidence + readiness levels. KAE is the source of those rollups.

## 8. Seed registry structure (illustrative — not populated content)

| KI band | Concept area | SCOS domain | Typical type | Typical readiness |
| --- | --- | --- | --- | --- |
| KI-001xx | double-entry, golden rules, books | D03 | definitional/computational | A |
| KI-002xx | voucher scenarios (Dr/Cr) | D04 | accounting | B |
| KI-003xx | final-account formats | D05 | legal/accounting | C/D |
| KI-004xx | members/shares law | D06 | legal | D |
| KI-005xx | loans/KCC/NPA | D07 | accounting/compliance | B/C |
| KI-006xx | GST | D14 | compliance | C |
| KI-007xx | TDS/IT/80P | D15 | legal/compliance | C/D |
| KI-008xx | audit grading/objections | D16 | compliance/legal | C/D |
| KI-009xx | reserves/dividend/appropriation | D19 | legal | D |
| KI-010xx | state-law variants (per `concept_key`) | D24 | legal | D |
| KI-011xx | product/module facts | D22/D26 | product | A |

> Population is the ongoing acquisition work, gated by the [update engine](07-update-engine.md) +
> [QA](08-quality-assurance.md). **No KI is fabricated** to fill the table.

---

### Cross-references
[Knowledge Architecture](01-knowledge-architecture.md) · [Evidence Model](03-evidence-model.md) · [Jurisdiction Engine](05-jurisdiction-engine.md) · [Cross-Reference Engine](09-cross-reference-engine.md) · [Content Readiness Engine](10-content-readiness-engine.md) · [SMRD Topic Research Registry](../smrd/03-topic-research-registry.md)
