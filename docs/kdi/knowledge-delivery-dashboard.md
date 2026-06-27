# ★ Knowledge Delivery Dashboard

> The integration scorecard for the 50 **active** KIs (Wave-1A). Snapshot at KDI v1.0 — **current state
> (baseline, before implementation)** vs **target after the [roadmap](implementation-roadmap.md)**.
> Success metric: *every active KI is discoverable, reusable, searchable, and valuable inside SahakarLekha.*

**As of:** 2026-06-27 · **Scope:** 50 active KIs · **Foundations:** read-only (SCOS/SMRD/KAE/KPP).

---

## 1. Headline metrics (current → target)

| Metric | Definition | Current | Target (post-roadmap) |
| --- | --- | --- | --- |
| **Knowledge Coverage %** | active KIs whose *concept* exists somewhere in product content | **~100%** (guide/cookbook/module) | 100% |
| **Knowledge Utilization %** | active KIs **wired into a live product surface as a KI** (glossary/tooltip/FAQ/AI/search) | **0%** | ≥ 90% |
| **Knowledge Reuse %** | active KIs feeding **≥2** surfaces from one record | **0%** | ≥ 80% |
| **Pages Connected** | content pages linking to a KI | 0 (KI-layer) | guide+blog+faq+glossary |
| **Software Connected** | modules with KI-driven context help | **0 / ~24 eligible** | 24 |
| **AI Connected** | active KIs in the `/ask` grounded corpus | **0 / 50** | 50 |
| **Help Connected** | help/onboarding moments backed by a KI | 0 | onboarding + key tasks |
| **Search Connected** | active KIs in search index w/ synonyms | **0 / 50** | 50 |

> **Honest baseline:** the *topics* are well-covered by existing content (Coverage ≈100%), but the **KI
> layer's product utilization is 0%** — the 50 KIs live in `/docs` only. KDI's job is to lift Utilization,
> Reuse, and the "Connected" rows from 0 to near-full by wiring (not rebuilding).

## 2. Utilization by surface (current 0 → target)

| Surface | Eligible KIs | Target |
| --- | --- | --- |
| Glossary | 42 | 42 (Week 1) |
| Search (synonyms, autocomplete) | 50 | 50 (Week 1–Month 2) |
| Ask-AI grounding | 50 | 50 (Week 4) |
| In-module context help | 24 | 24 (Week 2) |
| FAQ | 19 | 19 (Week 3) |
| Onboarding/wizard | 7 | 7 (Week 4) |
| Internal links | 50 | 50 (Month 2) |
| Downloads (Level-A) | ~7 | 7 (Month 3) |
| Navigation/footer/homepage | 9 | 9 (Month 2) |

## 3. Knowledge still isolated
**All 50 active KIs are isolated in `/docs` today** (Utilization 0%). Priority to de-isolate:
- 🔴 **P0 (12):** KI-000001, 000026, 000027, 000028, 000033, 000050, 000055, 000079, 000101, 000303, 000306, 000341.
- 🟠 **P1 (~26)** · 🟡 **P2 (~12).** Full list in [content-gap-audit](content-gap-audit.md).
- **Flagged "no product value": 0** — every active KI maps to a real destination ([delivery-map](knowledge-delivery-map.md)). None need removal.

## 4. Critical missing integrations (blockers to value)
| # | Missing integration | Impact | Fix (roadmap) |
| --- | --- | --- | --- |
| 1 | **KI-driven glossary** not live | ~42 KIs invisible + no search synonyms | Week 1 🔴 |
| 2 | **In-module context help** absent | daily-use screens unexplained | Week 2 🔴 |
| 3 | **`/ask` not grounded** in active KIs | AI can't cite our knowledge | Week 4 🔴 |
| 4 | **FAQ + register CTA** missing | top questions unanswered, low conversion | Week 3 🔴 |
| 5 | **Search synonyms / mixed-script** absent | Hindi/Hinglish users miss results | Week 1–Month 2 🟠 |
| 6 | **Onboarding KI help** absent | new-user drop-off | Week 4 🟠 |

## 5. Highest-ROI improvements (do these first)
1. **KI-driven glossary (Week 1)** — single build surfaces ~42 KIs, powers search synonyms + tooltips. **Effort M, Impact 🔴🔴🔴.**
2. **Context help on /vouchers, /ledger-heads, /cash-book, /reports, /society-setup (Week 2)** — knowledge at point of need on daily screens. **Effort M, Impact 🔴🔴.**
3. **KI-fed FAQ + register/module CTA (Week 3)** — conversion + answers. **Effort M, Impact 🔴🔴.**
4. **`/ask` grounded on 50 KIs (Week 4)** — cited, safe AI answers; refuses NEV specifics. **Effort M, Impact 🔴.**

## 6. Scope & integrity check
- ✅ **No architecture created** — KDI only maps existing KIs → existing surfaces.
- ✅ **SCOS/SMRD/KAE/KPP untouched** (read-only foundations).
- ✅ **Every recommendation cites existing ids** (KI-/C###/EV-/routes).
- ✅ **Scope = 50 active KIs**; B/C/D NEV items explicitly deferred (AI hedges, no fabrication).
- ✅ **0 KIs flagged for removal** — all have product value.

## 7. Definition of done (the success metric, measured)
> "Every active Knowledge Item is **discoverable** (glossary/search/nav), **reusable** (≥2 surfaces from
> one record), **searchable** (synonyms, Hindi/English/mixed), and **valuable** (context help + module CTA)
> inside SahakarLekha."

Tracked as: Utilization ≥90%, Reuse ≥80%, AI/Search Connected = 50/50, isolated KIs → 0. Re-measure after
each roadmap milestone.

---

### Cross-references
[Coverage Audit](knowledge-coverage-audit.md) · [Delivery Map](knowledge-delivery-map.md) · [Product Integration](product-integration.md) · [Ask-AI Map](ask-ai-map.md) · [Search Experience](search-experience.md) · [User Journeys](knowledge-user-journeys.md) · [Content Gap Audit](content-gap-audit.md) · [Implementation Roadmap](implementation-roadmap.md) · [Master Index](00-master-index.md)
