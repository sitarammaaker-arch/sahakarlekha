# 01 — Knowledge Architecture

> **KAE = Knowledge Acquisition Engine.** The permanent, *runtime* knowledge backbone that
> continuously **collects, organizes, validates, versions, and maintains** authoritative knowledge —
> and serves it to every article, calculator, template, AI response, software feature, and compliance
> workflow.
>
> KAE is the **third layer**, built on two stable foundations (do not modify):
> [SMRD](../smrd/00-master-research-index.md) (research database) and [SCOS](../scos/00-master-index.md)
> (content operating system). **KAE does not write content.** It maintains *truth as living data*.

**Status:** Foundation v1.0 · **Created:** 2026-06-27 · **Owner:** Chief Knowledge Architect / Evidence Systems
**Principles:** *Truth before SEO. Authority before popularity. Evidence before opinion. Primary before
secondary. Never fabricate. Never infer legal provisions. Never invent accounting treatments. `NEV` when uncertain.*

---

## 1. Where KAE sits (the three layers)

```
KAE  (engine / runtime)   →  atomic knowledge items + evidence + jurisdiction + versions + API
  │   feeds & is fed by
SMRD (research database)   →  per-cluster research records, source registry, readiness gates
  │   feeds
SCOS (content OS)          →  clusters, surfaces, SEO, internal links, lead funnels, blueprints
  │   renders into
Articles · Templates · Calculators · AI answers · SaaS modules · Compliance workflows
```

| Layer | Unit of work | Owns |
| --- | --- | --- |
| **KAE** | **Knowledge Item (atomic claim)** | truth-as-data: evidence, jurisdiction, version, lifecycle, retrieval API |
| SMRD | Research Record (per SCOS cluster) | what to research, sources, readiness |
| SCOS | Cluster / Asset | what to build, how to render |

> **Granularity is the key distinction.** SMRD researches a *cluster* (e.g. C173 reserve fund). KAE
> stores each *atomic fact* inside it as a separate, independently-versioned, independently-cited
> **Knowledge Item** (e.g. "statutory minimum reserve transfer % in State RJ" = one KI). A cluster has
> many KIs. ([04 — Knowledge Registry](04-knowledge-registry.md).)

## 2. Knowledge lifecycle (the core state machine)

```
DISCOVERED → INGESTED → NORMALIZED → SOURCED → VALIDATED → PUBLISHED(active)
     → MONITORED → (on change) SUPERSEDED → ARCHIVED
                 ↘ (on doubt) FLAGGED → re-VALIDATED
                 ↘ (no longer applicable) RETIRED
```

| State | Meaning | Gate to advance |
| --- | --- | --- |
| Discovered | a source/claim spotted by the [update engine](07-update-engine.md) | dedup check ([08](08-quality-assurance.md)) |
| Ingested | captured as a draft KI with source pointer | schema valid |
| Normalized | structured: claim, jurisdiction, dates, type | jurisdiction tagged ([05](05-jurisdiction-engine.md)) |
| Sourced | ≥1 primary/authoritative source attached | evidence ≥ E2 ([03](03-evidence-model.md)) |
| Validated | reviewer/SME sign-off where required | passes QA gates ([08](08-quality-assurance.md)) |
| Published (active) | usable by content/AI/features | readiness level met ([10](10-content-readiness-engine.md)) |
| Monitored | live, watched for change | `next_review` set |
| Superseded | replaced by a newer version | new version active ([06](06-version-control.md)) |
| Archived | kept for history, not served | — |
| Retired | no longer applicable (law repealed, scheme ended) | reason recorded |

## 3. Knowledge ingestion

Inputs the engine acquires from (all classified in [02 — Source Catalog](02-source-catalog.md)):
- **Primary law/standards** (Acts, Rules, notifications, ICAI standards) — Tier 1.
- **Regulator/official issuances** (NABARD/RBI/RCS circulars, portal updates) — Tier 1–2.
- **Institutional/academic** — Tier 3–4.
- **Internal** (SahakarLekha modules, `/guide`, `/help`, `/cookbook`, `/faq`) — Tier 5 corroboration.
- **Signals** (`/ask` logs, support inbox, Search Console) — *demand*, not truth.

Ingestion pipeline: `detect → capture (pointer + metadata, never copy bulk text) → normalize to KI
schema → assign Knowledge ID → route to validation`. Detail in [07](07-update-engine.md).

## 4. Knowledge validation

Every KI carries an **evidence record** ([03](03-evidence-model.md)) and must clear the **QA gates**
([08](08-quality-assurance.md)) at the readiness level its content class requires ([10](10-content-readiness-engine.md)).
Legal/accounting claims require **primary source + SME** (E3) — same gate as SMRD/SCOS. `NEV` until then.

## 5. Knowledge versioning

KIs are **append-only versioned** ([06](06-version-control.md)): a fact never silently changes — a new
version supersedes the old, the old is archived with its effective window. This preserves the **audit
trail** ("what was the rule in FY2025-26?") essential for compliance and historical reports.

## 6. Knowledge retirement

When a law is repealed, a scheme ends, or a treatment is withdrawn, the KI is **RETIRED** (not deleted):
served only in historical context, with a successor pointer if one exists. Retirement reasons are
recorded. Retired KIs remain queryable via the [AI Knowledge API](11-ai-knowledge-api.md) with an
`as_of` filter.

## 7. Knowledge dependencies

A KI may **depend on** other KIs (a derived fact depends on its inputs). Dependencies are typed:
`derived_from`, `requires`, `amends`, `supersedes`, `applies_to`. When a KI changes version, the
[update engine](07-update-engine.md) walks the dependency graph and **flags every dependent** for
re-review (cascade). Example: a depreciation-rate KI changes → every calculator/template/cluster KI
that `derived_from` it is flagged.

## 8. Knowledge relationships

Beyond dependencies, KIs relate via the [cross-reference engine](09-cross-reference-engine.md):
`act ↔ rule ↔ circular ↔ accounting-topic ↔ template ↔ calculator ↔ module ↔ article ↔ FAQ`. This is
the legal/operational knowledge graph (distinct from SCOS's content graph, which links *pages*). KAE's
graph links *evidence and entities*.

## 9. Design invariants
1. **Atomic** — one KI = one claim. No compound facts.
2. **Sourced or NEV** — no KI is "active" without evidence or an explicit NEV flag.
3. **Jurisdiction-scoped** — every KI states where it applies ([05](05-jurisdiction-engine.md)).
4. **Time-bounded** — every KI has `effective_from`/`effective_to`; nothing is timeless.
5. **Append-only** — facts are versioned, never overwritten.
6. **Reuse, don't duplicate** — KIs key to SMRD `SRC-`/research ids and SCOS cluster ids; KAE never re-defines a topic or re-lists a source.
7. **Engine, not document** — KAE is designed to be implemented as data (tables/JSON) + processes; these markdown files are its **specification**.

---

### Cross-references
[Source Catalog](02-source-catalog.md) · [Evidence Model](03-evidence-model.md) · [Knowledge Registry](04-knowledge-registry.md) · [Update Engine](07-update-engine.md) · [AI Knowledge API](11-ai-knowledge-api.md) · [SMRD Methodology](../smrd/01-research-methodology.md)
