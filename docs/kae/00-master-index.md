# KAE — Master Index

# SahakarLekha Knowledge Acquisition Engine

> The permanent **knowledge backbone**: a runtime engine that continuously **collects, organizes,
> validates, versions, and serves** authoritative cooperative-accounting knowledge as atomic,
> evidence-backed, jurisdiction-scoped, version-controlled **Knowledge Items** — feeding every article,
> template, calculator, AI response, software feature, and compliance workflow.
>
> **Version:** Foundation v1.0 · **Created:** 2026-06-27 · **Owner:** Chief Knowledge Architect / Evidence Systems
> **Principles:** *Truth before SEO. Authority before popularity. Evidence before opinion. Primary before
> secondary. Never fabricate. Never infer legal provisions. Never invent accounting treatments. `NEV` when uncertain.*

KAE is built on two **stable, unmodified** foundations: [SMRD](../smrd/00-master-research-index.md) and
[SCOS](../scos/00-master-index.md).

---

## The integrated knowledge system

```
            ┌──────────────────────── KAE (engine / runtime) ────────────────────────┐
            │ Knowledge Items (atomic claims) · Evidence · Jurisdiction · Versions     │
SOURCES ───▶│ ingest → validate → version → cross-reference → serve (AI Knowledge API) │
(Tier 1–5)  └───────────────▲──────────────────────────────────────────┬──────────────┘
                            │ rolls up status to                        │ serves cited, jurisdiction-
                            │                                           │ resolved, versioned knowledge
            ┌───────────────┴───────────────┐                          ▼
            │ SMRD (research database)       │            ┌──────────── consumers ─────────────┐
            │ per-cluster research records,  │            │ Articles · Templates · Calculators  │
            │ sources, readiness gates       │            │ AI answers (/ask) · SaaS modules    │
            └───────────────▲───────────────┘            │ Compliance workflows                │
                            │ gates writing                └─────────────────────────────────────┘
            ┌───────────────┴───────────────┐                          ▲
            │ SCOS (content operating system)│──────── renders ─────────┘
            │ clusters, surfaces, SEO, links │
            └────────────────────────────────┘

FLOW:  KAE → SMRD → SCOS → Articles → Templates → Calculators → SaaS Modules
TRUTH flows up (KAE validates), STRUCTURE flows down (SCOS renders), CITATIONS flow back to KAE.
```

| Layer | Unit | Owns | Key id |
| --- | --- | --- | --- |
| **KAE** | Knowledge Item | truth-as-data: evidence, jurisdiction, version, serving | `KI-#####` / `EV-######` |
| SMRD | Research Record | sources, research status, readiness | `SRC-*`, keyed to `C###` |
| SCOS | Cluster / Asset | what to build, how to render, SEO | `C001–C386` |

**One SME validation at the KI level clears all three layers.** **One Knowledge Item powers many
outputs** (article + calculator + template + AI answer + module behaviour) — research once, render many.

## The files

| # | File | Purpose |
| --- | --- | --- |
| 00 | **[Master Index](00-master-index.md)** | this map + integrated-system view |
| 01 | [Knowledge Architecture](01-knowledge-architecture.md) | lifecycle, ingestion, validation, versioning, retirement, dependencies, relationships |
| 02 | [Source Catalog](02-source-catalog.md) | Tier 1–5 authority overlay on SMRD's `SRC-` registry |
| 03 | [Evidence Model](03-evidence-model.md) | evidence record schema, E0–E4/NEV, confidence model |
| 04 | [Knowledge Registry](04-knowledge-registry.md) | the atomic Knowledge Item (KI) schema + taxonomy |
| 05 | [Jurisdiction Engine](05-jurisdiction-engine.md) | central/state/district/type/sector/language + resolution |
| 06 | [Version Control](06-version-control.md) | append-only versions, effective-dating, supersede, rollback, cascade |
| 07 | [Update Engine](07-update-engine.md) | detect → impact-map → queue → review → version → cascade |
| 08 | [Quality Assurance](08-quality-assurance.md) | seven gates; automated + SME |
| 09 | [Cross-Reference Engine](09-cross-reference-engine.md) | entity graph: law↔topic↔template↔calc↔module↔article; citations & cascade |
| 10 | [Content Readiness Engine](10-content-readiness-engine.md) | levels A–D; gate law, don't over-block education |
| 11 | [AI Knowledge API](11-ai-knowledge-api.md) | grounded, cited, jurisdiction- & version-aware retrieval |
| 12 | [Gap Analysis](12-gap-analysis.md) | prioritized backlog (knowledge, laws, states, tools, integrations) |

## How a fact lives in KAE (end to end)

```
Source (Tier 1–5) detected by Update Engine
  → ingested as a Knowledge Item (atomic claim), keyed to SMRD research + SCOS cluster
  → Evidence record attached (level, jurisdiction, dates, confidence)
  → Jurisdiction scoped (central/state/type/…)
  → QA gates (source, evidence, jurisdiction, cross-ref, duplicate, completeness, SME)
  → Readiness level set (A educational … D legal)
  → PUBLISHED active version
  → served via AI Knowledge API (cited, jurisdiction-resolved, version-stamped)
  → MONITORED; on change → new version → cascade flags dependents → content refreshed
  → on repeal → RETIRED (kept for history)
```

## Reuse, never duplicate (relationship to the foundations)
- **KAE mints only `KI-`/`EV-` ids.** It reuses SCOS `C###`, SMRD `SRC-`/research ids, product routes.
- **Source catalog** = an authority overlay on SMRD's registry, not a re-listing.
- **Evidence levels** = SMRD's E0–E4/NEV scale (single source of truth), plus a confidence model.
- **KAE graph** (entity/evidence/cascade) **joins** the SCOS graph (page links) at `cites`/`explained_by`
  edges — no overlap.
- **The SMRD readiness scoreboard is computed by KAE** (KAE is its live source).

## Operating rules (the KAE constitution)
1. **Atomic** — one Knowledge Item = one claim.
2. **Sourced or NEV** — nothing active without evidence; legal/accounting need primary + SME (E3).
3. **Jurisdiction-scoped** — every KI says where it applies; no silent generalization across states.
4. **Append-only versioned** — facts never overwritten; history always recoverable; `as_of` queries.
5. **Cascade on change** — a MAJOR update flags every dependent; nothing stale ships silently.
6. **Grounded AI** — the API serves only cited, servable knowledge; *retrieval* enforces "never fabricate".
7. **Gate law, free education** — A-level ships without SME; B/C/D require it.
8. **Engine, not document** — these files specify a data store + processes to implement.

## Immediate next actions (from [12 Gap Analysis](12-gap-analysis.md))
1. 🔴 **Engage an SME** (CA/cooperative auditor) — unblocks all regulated knowledge.
2. 🔴 **Stand up the KI data store** (`KI-`/`EV-` tables) — turn spec into engine.
3. 🔴 Capture **PACS CAS + COA + statutory statement formats**; snapshot **current tax** KIs.
4. 🟠 Build the **automated QA pass** + **update engine**; implement the **AI Knowledge API** to ground `/ask`.
5. 🟢 In parallel (no SME needed): acquire & serve **Level-A** educational/product KIs now.

---

*KAE → SMRD → SCOS → Articles → Templates → Calculators → SaaS Modules — one integrated knowledge
system. Start at [01-knowledge-architecture.md](01-knowledge-architecture.md), or jump to
[12-gap-analysis.md](12-gap-analysis.md) for the prioritized backlog. No content is written here; KAE
keeps the knowledge true so everything built on top can be trusted.*
