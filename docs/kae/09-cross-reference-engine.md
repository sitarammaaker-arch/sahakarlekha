# 09 — Cross-Reference Engine

> The relationship graph that connects **evidence and entities** — Acts ↔ Rules ↔ Circulars ↔
> accounting topics ↔ templates ↔ calculators ↔ modules ↔ articles ↔ videos ↔ downloads ↔ FAQs.
>
> This is **distinct from the SCOS content graph** ([SCOS 06](../scos/06-knowledge-graph.md)), which links
> *pages* for SEO/navigation. KAE's graph links *knowledge entities* for **provenance, cascade, and
> retrieval** — it answers "what law backs this calculator?" and "what breaks if this rule changes?"

---

## 1. Entity types (graph nodes)

| Node | Id space | Layer |
| --- | --- | --- |
| Knowledge Item (KI) | KI-##### | KAE |
| Evidence record | EV-###### | KAE |
| Source | SRC-* | SMRD/KAE [02](02-source-catalog.md) |
| Legal entity (Act / Rule / Circular / Notification / Standard) | SRC-* (sub-typed) | source |
| Accounting topic | C### (SCOS cluster) | SCOS |
| Template | template ids ([SMRD 08](../smrd/08-template-opportunities.md)) | SMRD/SCOS |
| Calculator / Tool | tool ids ([SMRD 09](../smrd/09-tool-opportunities.md)) | SMRD/SCOS |
| Software module | route (e.g. `/depreciation-schedule`) | product |
| Article / page | SCOS asset slug | SCOS |
| Video / Download / FAQ | asset ids | SCOS |

## 2. Relationship types (typed edges)

| Edge | From → To | Meaning | Used by |
| --- | --- | --- | --- |
| `backed_by` | KI → Source | the KI's authority | QA Q1, citations |
| `governed_by` | KI/topic → legal entity | the law that rules it | jurisdiction, NEV |
| `amends` / `supersedes` | legal/KI → legal/KI | version chain | [06](06-version-control.md) |
| `derived_from` | KI → KI | computed/depends on | cascade [07](07-update-engine.md) |
| `requires` | KI/topic → KI/topic | prerequisite | readiness, links |
| `implemented_by` | KI/topic → module | where it's done in-app | conversion, product map |
| `computed_by` | KI → calculator | tool that applies it | tool validation |
| `formatted_as` | KI/topic → template | downloadable form | template validation |
| `explained_by` | KI/topic → article/FAQ/video | content rendering | SCOS handoff |
| `applies_to` | KI → jurisdiction/type | scope | [05](05-jurisdiction-engine.md) |
| `cites` | article/answer → KI/Source | provenance of a statement | [AI API](11-ai-knowledge-api.md) |

## 3. Canonical cross-reference chains

**Law → application → product → content (the authority chain):**
```
Act/Rule (SRC) ─governed_by← KI (legal fact) ─derived_from← KI (treatment)
   ─computed_by→ Calculator   ─formatted_as→ Template   ─implemented_by→ Module
   ─explained_by→ Article/FAQ  ─cites→ back to KI & Source
```
> Every public statement (article, AI answer, calculator result) can trace a `cites` path back to a KI
> and its Source. **This is the citation backbone** — no claim without a traceable chain.

**Change → blast radius (the cascade chain):**
```
Source changes → KI (new version, MAJOR) → walk derived_from/requires/computed_by/formatted_as/
   implemented_by/explained_by → flag every dependent (KIs, calculators, templates, modules, articles)
   → update queues ([07]) + AI cache invalidation ([11])
```

## 4. Graph integrity (enforced by QA Q4)
1. No **dangling** edges (every endpoint resolves).
2. No **cycles** in `derived_from`/`requires` (acyclic dependency).
3. `supersedes` chains are linear per `(concept_key, jurisdiction)`.
4. A `cites` edge must point to a **servable** KI (E3/level-A) — you cannot cite an NEV fact as settled.
5. Reuse existing ids (SCOS `C###`, SMRD `SRC-`, product routes) — KAE adds edges, not duplicate nodes.

## 5. Legal entity sub-graph (Acts ↔ Rules ↔ Circulars ↔ Manuals)

Model the legal corpus explicitly so amendments propagate:
```
Act(SRC-ST-ACT-RJ) ─has_rule→ Rules(SRC-ST-RULES-RJ) ─clarified_by→ Circular(SRC-ST-RCS-RJ)
   ─prescribes→ Form/Register(template)   ─interpreted_by→ ICAI GN / SME
Amendment ─amends→ Act ⇒ MAJOR-version all KIs governed_by it (cascade)
```
Each legal node carries jurisdiction; a state amendment never cascades into another state's KIs.

## 6. Retrieval uses of the graph
- **Citations:** given a KI/answer → list its `backed_by`/`governed_by` sources.
- **Related knowledge:** `requires`/`derived_from`/sibling `concept_key` → "see also".
- **Product routing:** `implemented_by` → deep-link the user to the module that acts on the fact.
- **Impact analysis:** reverse-walk dependents for any proposed change ([07](07-update-engine.md)).
- **Coverage gaps:** missing edges (e.g. a KI with no `governed_by`) surface in [12](12-gap-analysis.md).

## 7. Relationship to SCOS graph (no duplication)
- SCOS graph = **page-to-page** (SEO, breadcrumbs, internal links).
- KAE graph = **entity-to-entity** (evidence, law, cascade, citations).
- They **join** at the `explained_by`/`cites` edges: a SCOS article node references the KAE KIs it
  renders. SCOS owns "which pages link"; KAE owns "which facts and laws underlie them."

---

### Cross-references
[Knowledge Registry](04-knowledge-registry.md) · [Version Control](06-version-control.md) · [Update Engine](07-update-engine.md) · [AI Knowledge API](11-ai-knowledge-api.md) · [SCOS Knowledge Graph](../scos/06-knowledge-graph.md)
