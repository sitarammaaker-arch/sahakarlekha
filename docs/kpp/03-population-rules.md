# 03 — Population Rules

> Strict, non-negotiable rules for adding Knowledge Items. These keep the database **atomic,
> non-duplicated, and fully traceable** to the three foundation layers. Violating any rule = the KI is
> rejected at the [quality gate](07-quality-gates.md).

---

## 1. The atomicity rule — **one concept = one KI**

- A KI captures exactly **one concept / one claim**. "Cash Book" is one KI; "Cash Book vs Bank Book" is
  **not** a KI (it's a comparison asset generated later from two KIs).
- A rule that **varies by state** = **N KIs** (one per `STATE:{XX}`), grouped by a shared `concept_key`
  ([KAE 04 §6](../kae/04-knowledge-registry.md)). Never one KI claiming to cover all states.
- A concept with multiple facets → split (e.g. "depreciation" → concept KI + "SLM method" KI + "WDV
  method" KI + "depreciation rate (jurisdiction X)" KI).

## 2. The no-duplication rule

- Before creating a KI, **search the existing registry** ([05](05-wave-1-registry.md)) by `concept_key`,
  title, and keywords. If it exists → **link/extend**, never re-create.
- Concepts already encoded in `/guide`, `/cookbook`, `/help`, `/faq`, or a module are **referenced**
  (as related_* + Tier-5 corroboration), **not** re-defined as new knowledge.
- Near-duplicates (same concept, different wording) are **merged**, not coexisted (QA Q5, [KAE 08](../kae/08-quality-assurance.md)).

## 3. The traceability rule — **every KI references all three layers**

A KI is **invalid** unless it carries:
1. `topic_id` → a real **SCOS** cluster (`C001–C386`, [SCOS 03](../scos/03-topic-registry.md)).
2. `research_id` → the matching **SMRD** research record (`SMRD:C###`, [SMRD 03](../smrd/03-topic-research-registry.md)).
3. `evidence_id` → a **KAE** evidence record (`EV-######`, [KAE 03](../kae/03-evidence-model.md)) carrying its level + sources.

> If no SCOS cluster fits, the concept is **out of scope** — do not invent a topic (that would be
> redesigning SCOS, which is forbidden). Flag it as a SCOS gap instead ([06](06-gap-analysis.md)).

## 4. ID rules

- KPP mints only `KI-######` (and its paired `EV-######`) — **sequential, never reused**, even after retirement.
- All other ids (`C###`, `SMRD:*`, `SRC-*`, module routes, template/calc ids) are **reused** from the foundations.
- Reserve blocks per group for readability ([02](02-wave-1-plan.md)) but ids remain globally unique.

## 5. Evidence & NEV rules (inherited, not re-invented)

- `evidence_level` and `nev_status` come from the **KAE/SMRD scale** (E0–E4/NEV) — KPP never defines a new scale.
- **Definitional / product / glossary** KIs (Level A) may be `active` with ordinary sourcing (incl. Tier-5 internal).
- **Accounting / compliance / legal** KIs (Level B/C/D) **cannot be `active`** until **E3** (primary source + SME). Until then `nev_status: true`; the concept may be *named and scoped* but its specific value is not asserted.
- **Never fabricate** a definition, citation, rate, section, or treatment to fill a field.

## 6. Definition-writing rules (when population reaches it — not in Wave-1 registry)

- A KI `definition` is a **short, structured statement** (1–3 sentences), not an article, not SEO copy.
- Hindi-first, everyday Hinglish (लाभ not मुनाफ़ा — house style).
- Must be consistent with the cited evidence; for NEV items, the definition states the concept
  generally and defers the specific to "verify with CA/RCS".
- **This phase does not write definitions** — the registry is built first ([05](05-wave-1-registry.md)).

## 7. Relationship rules

- Every KI declares `prerequisites` and `related_concepts` (≥1 each where one exists) → builds the graph ([04](04-knowledge-relationships.md)).
- `related_modules` mandatory where a module performs the concept (conversion bridge + SaaS doc source).
- No orphan KIs: a KI must connect to ≥1 other KI or a pillar concept.
- Relationship targets must **resolve** (no dangling ids — QA Q4).

## 8. Jurisdiction rules

- Every legal/compliance KI carries a `jurisdiction` ([KAE 05](../kae/05-jurisdiction-engine.md)).
- Central facts: one KI, `CENTRAL`. State facts: one KI per state under a shared `concept_key`.
- **No silent generalization**: a `CENTRAL` KI must never be presented as a specific state's law.

## 9. Scope guardrails (what KPP must NOT do)
- ❌ Do not write articles, FAQs, SEO pages, templates, videos, or calculators — **only KI records**.
- ❌ Do not redesign or modify SCOS / SMRD / KAE files.
- ❌ Do not invent topics, sources, treatments, or provisions.
- ✅ Do reuse, link, and populate. *Knowledge first, content later.*

## 10. Acceptance (a KI enters the registry as `planned` when)
- atomic concept · unique `concept_key` · SCOS+SMRD+KAE refs present · category/persona/jurisdiction
  assigned · evidence level + readiness set · ≥1 relationship. (Advancement to `active` = [07](07-quality-gates.md).)

---

### Cross-references
[KI Schema](01-knowledge-item-schema.md) · [Wave-1 Plan](02-wave-1-plan.md) · [Knowledge Relationships](04-knowledge-relationships.md) · [Quality Gates](07-quality-gates.md) · [KAE Quality Assurance](../kae/08-quality-assurance.md)
