# 01 — Knowledge Item Schema

> **KPP = Knowledge Population Project.** The implementation phase that fills the system with **real
> Knowledge Items (KIs)** — the single source of truth from which every future article, FAQ, AI answer,
> help page, template, checklist, calculator, video, and SaaS doc is generated.
>
> A **KI is not an article.** It is a structured knowledge record. This file defines the production KI
> schema. It **reuses** the KAE Knowledge Item ([KAE 04](../kae/04-knowledge-registry.md)) and enriches it
> with the rendering/relationship fields needed to drive asset generation. It does **not** redesign KAE.

**Layer recap (do not redesign):** SCOS = structure · SMRD = research · KAE = evidence · **KPP = the
actual knowledge.** ([Implementation philosophy — 00](00-master-index.md).)

---

## 1. Production KI schema

```yaml
# ─── Identity (reuse foundation ids; KPP mints only KI-/EV- via KAE) ───
knowledge_id:   KI-000001          # KAE id space; stable, never reused
topic_id:       C105               # SCOS cluster (../scos/03)  — REQUIRED
research_id:    SMRD:C105          # SMRD research record (../smrd/03) — REQUIRED
evidence_id:    EV-000001          # KAE evidence record (../kae/03) — REQUIRED (1:1)

# ─── Naming ───
title:          "Cash Book"
hindi_name:     "रोकड़ बही"
english_name:   "Cash Book"
definition:     ""                 # short structured statement — FILLED during population, gated (07)
purpose:        ""                 # why it exists / what job it does — FILLED later

# ─── Classification ───
category:       Accounting          # top group (→ 02 wave plan)
subcategory:    Books of Account
knowledge_type: definitional|product|computational|accounting|compliance|legal|procedural  # KAE 04
keywords:       [cash book, rokad, रोकड़]
difficulty:     beginner|intermediate|advanced
user_persona:   [EMP, ACC]          # SCOS 05 codes

# ─── Scope (KAE 05 jurisdiction) ───
jurisdiction:   CENTRAL | STATE:{XX} | TYPE:{type} | SECTOR:{x}
society_types:  [all] | [pacs, dairy, ...]
concept_key:    cash-book           # groups per-jurisdiction variants (KAE 04 §6)

# ─── Relationships (graph — 04; ids reused, not duplicated) ───
prerequisites:      [KI-000010]     # must-know-first KIs
related_concepts:   [KI-000002, KI-000020]
related_modules:    [/cash-book]    # SCOS Module Index
related_templates:  [cash-book-xls] # SMRD 08
related_calculators:[]              # SMRD 09
related_faqs:       []              # SCOS /faq
related_articles:   []              # SCOS clusters/assets
related_videos:     []
downloads:          [cash-book-xls]

# ─── Evidence & governance (KAE 03 / 10) ───
evidence_level:   E0..E4 | NEV      # single source of truth = KAE/SMRD scale
nev_status:       true|false
content_readiness:A|B|C|D           # KAE 10 (A=educational … D=legal)
last_updated:     2026-06-27
review_schedule:  2027-03-01 | on-trigger
status:           planned|drafting|in-review|active|superseded|retired   # KAE lifecycle
```

## 2. Field rules

| Field group | Rule |
| --- | --- |
| **Identity** | `topic_id`, `research_id`, `evidence_id` are **mandatory** — a KI with no SCOS/SMRD/KAE link is invalid ([03](03-population-rules.md)). |
| **definition/purpose** | short, structured, **not an article**. Left empty in the Wave-1 registry ([05](05-wave-1-registry.md)); filled later under the [quality gates](07-quality-gates.md). |
| **knowledge_type** | drives default readiness + whether SME is required ([KAE 10](../kae/10-content-readiness-engine.md)). |
| **jurisdiction** | mandatory for legal/compliance; `concept_key` groups state variants. |
| **Relationships** | ids only, reused from foundations — KPP **adds edges, never new nodes** for things that already exist. |
| **evidence_level / nev_status** | mirror the KAE evidence record; never invented here. |
| **status** | a KI is `active` only after [07](07-quality-gates.md) passes. |

## 3. What each field powers (KI → assets)

| KI field(s) | Generates / feeds |
| --- | --- |
| title + definition + purpose | article intro, FAQ answer, AI answer, glossary entry |
| keywords + user_persona + topic_id | SEO targeting, search-intent match ([SCOS 04](../scos/04-search-intent.md)) |
| related_modules | "do it in the app" CTA, SaaS doc |
| related_templates / downloads | Excel/PDF/Word generation ([SMRD 08](../smrd/08-template-opportunities.md)) |
| related_calculators | calculator landing ([SMRD 09](../smrd/09-tool-opportunities.md)) |
| prerequisites / related_concepts | learning path, internal links, "see also" |
| evidence_id + citations | AI citation, trust badge ([KAE 11](../kae/11-ai-knowledge-api.md)) |
| jurisdiction | state-correct answers ([KAE 05](../kae/05-jurisdiction-engine.md)) |
| review_schedule | freshness/update queue ([KAE 07](../kae/07-update-engine.md)) |

> **One KI → many assets.** This mapping is the whole point of KPP: populate the record once, generate
> everything from it later. *Knowledge first, content later.*

## 4. Minimal vs full record

- **Registry stub (Wave-1 [05](05-wave-1-registry.md)):** identity + naming + classification + relationships +
  evidence level + readiness + status. **No definition prose yet.**
- **Full KI (population):** stub + `definition` + `purpose` + filled citations, advanced to `active`
  through [07](07-quality-gates.md). Only then is it generation-ready.

---

### Cross-references
[Population Rules](03-population-rules.md) · [Wave-1 Plan](02-wave-1-plan.md) · [Wave-1 Registry](05-wave-1-registry.md) · [Quality Gates](07-quality-gates.md) · [KAE Knowledge Registry](../kae/04-knowledge-registry.md)
