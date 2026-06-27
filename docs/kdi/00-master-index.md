# KDI — Master Index

# SahakarLekha Knowledge Delivery & Integration

> **Turn Knowledge into Product.** Every **active** Knowledge Item (the 50 Wave-1A KIs,
> [KPP wave-1-active](../kpp/wave-1-active/00-index.md)) must become *discoverable, reusable,
> searchable, and valuable inside SahakarLekha* — not stranded in `/docs`.
>
> **This is integration, not architecture.** The four foundation layers are **READ-ONLY**:
> [SCOS](../scos/00-master-index.md) · [SMRD](../smrd/00-master-research-index.md) ·
> [KAE](../kae/00-master-index.md) · [KPP](../kpp/00-master-index.md). KDI never redesigns or duplicates
> them — it only **connects** them to real product surfaces. Every recommendation cites existing ids
> (`KI-…`, `C###`, `EV-…`, real routes).

**Version:** v1.0 · **Created:** 2026-06-27 · **Owner:** Product Architect / UX Integration
**Scope:** the 50 `active` KIs. (`planned` KIs are out of scope until activated.)

---

## The delivery pipeline (one KI → many surfaces)

```
Active Knowledge Item (KI-…, evidence EV-…, topic C…)
        │
        ├─ Glossary term          (/search, /guide glossary)
        ├─ FAQ entry              (/faq)
        ├─ Guide / Blog link      (/guide/:slug, /blog/:slug)
        ├─ Help task              (/help/:slug)
        ├─ Context help           (in-module tooltip / empty state)
        ├─ Ask-AI grounding       (/ask — cited answer)
        ├─ Search suggestion      (/search autocomplete, synonyms)
        ├─ Internal links         (cross-surface, from graph)
        ├─ Navigation / footer    (discoverability)
        └─ Software module CTA    (the route that performs the concept)
```

## The KDI files (the 8 phases + dashboard)

| Phase | File | Delivers |
| --- | --- | --- |
| 1 | [knowledge-coverage-audit.md](knowledge-coverage-audit.md) | where each active KI is used / missing, priority, impact, difficulty |
| 2 | [knowledge-delivery-map.md](knowledge-delivery-map.md) | per-KI delivery across 13 destinations (glossary→navigation) |
| 3 | [product-integration.md](product-integration.md) | KI → module/menu/button/screen/form/wizard/journey |
| 4 | [ask-ai-map.md](ask-ai-map.md) | trigger questions, answer/refuse/recommend rules, escalation |
| 5 | [search-experience.md](search-experience.md) | suggestions, synonyms, Hindi/English/mixed, did-you-mean |
| 6 | [knowledge-user-journeys.md](knowledge-user-journeys.md) | 9 persona/task journeys mapped to KIs + surfaces |
| 7 | [content-gap-audit.md](content-gap-audit.md) | isolated KIs, pages without knowledge, missing links/CTAs/help |
| 8 | [implementation-roadmap.md](implementation-roadmap.md) | Week1–Month6 tasks, each linked to KI+SCOS+SMRD+KAE |
| ★ | [knowledge-delivery-dashboard.md](knowledge-delivery-dashboard.md) | coverage/utilization/reuse %, ROI, what's still isolated |

## How KDI uses the foundations (read-only)
- **KPP** supplies the active KIs (titles, definitions, suggested surfaces, related ids).
- **SCOS** supplies the surfaces (guide/blog/help/cookbook/faq/search/ask/software/state) + Module Index + internal-link rules.
- **KAE** supplies the evidence (`EV-`) for citations, the jurisdiction rule, and the AI-API contract.
- **SMRD** supplies the research/readiness backing each KI.

> KDI adds **no** new ids and **no** new docs schema — it produces *integration maps* that point existing
> KIs at existing product surfaces.

## Success metric
Not documentation. The metric is: **"Every active Knowledge Item is discoverable, reusable, searchable,
and valuable inside SahakarLekha."** Tracked in the [dashboard](knowledge-delivery-dashboard.md).

---

*Start with [knowledge-coverage-audit.md](knowledge-coverage-audit.md), or jump to the
[dashboard](knowledge-delivery-dashboard.md) for the current integration scorecard.*
