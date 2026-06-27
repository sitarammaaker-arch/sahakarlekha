# 11 — AI Knowledge API

> How future AI systems (the `/ask` assistant, in-app copilots, automated drafting) **consume** KAE
> knowledge — safely, with citations, jurisdiction-awareness, and version control. This is the
> contract that turns the knowledge backbone into grounded, non-hallucinating answers.

**Design goal:** an AI answer is only as trustworthy as its retrieval. KAE serves **evidence-gated,
jurisdiction-resolved, cited** knowledge so the model **grounds** rather than guesses. *Never fabricate*
becomes an architectural guarantee, not a prompt instruction.

---

## 1. Retrieval interfaces (logical API)

| Endpoint (logical) | Returns | Key params |
| --- | --- | --- |
| `getKnowledge(query, context)` | servable KIs matching query, jurisdiction-resolved | query, society_context, level≤ |
| `getEvidence(knowledge_id)` | the KI's evidence record + level + confidence | knowledge_id |
| `getCitations(knowledge_id\|answer_id)` | source list + exact refs for a claim/answer | id |
| `getRelated(knowledge_id)` | `requires`/`derived_from`/sibling KIs + SCOS `related_topics` | id, depth |
| `getVersion(knowledge_id, as_of?)` | active or historical version for a date | id, as_of |
| `getJurisdiction(concept_key, context)` | the KI that applies to this society | concept_key, context |

All read-only. Writes go through the [update engine](07-update-engine.md), never the AI.

## 2. The grounded-answer contract

```
1. RESOLVE context (society_context: state/type/sector/language) → 05 jurisdiction engine
2. RETRIEVE candidate KIs (servable only: level meets content class, non-NEV for B/C/D) → 04/10
3. RANK by confidence (03 §3) × jurisdiction specificity × recency
4. GROUND the answer ONLY in retrieved KIs; attach getCitations() for every claim
5. GUARD:
     - if best KI is NEV / below required level → DO NOT assert; return the general concept +
       "verify with your CA/RCS" + offer the source pointer
     - if no state-specific KI and context is a state → no silent generalization (05 §4)
6. STAMP answer with as_of (version date) + jurisdiction served
```

> **Hard rule:** the AI may only state a regulated specific (rate/section/%/deadline/format) if a
> **servable E3 KI** backs it, with a citation. Otherwise it explains generally and routes to the source
> or a human. This is enforced by *what retrieval returns*, not by trusting the model.

## 3. Servability filter (what the API will/won't return as fact)

| KI state | Returned as… |
| --- | --- |
| level A, sourced | factual (with cite) |
| B/C/D, E3/E4, non-NEV | factual (with cite + jurisdiction + as_of) |
| E2 / NEV | **context only** — "general concept; specific needs verification" + source pointer |
| superseded (with as_of) | historical, labelled |
| outdated/stale | down-ranked; flagged "verify — may have changed" |
| retired | "repealed/withdrawn" + successor if any |

## 4. Citation retrieval (provenance for every statement)

- Each served KI carries `backed_by`/`governed_by` edges ([09](09-cross-reference-engine.md)) → resolve to
  source name + exact ref + date + URL.
- AI answers store an `answer_id` with `cites: [KI…, SRC…]` so any statement is **auditable** after the
  fact (and re-checkable when a cited KI versions).
- No citation → the statement cannot be presented as fact. *Authority before popularity.*

## 5. Jurisdiction retrieval

- The API **requires** a `society_context` for any legal/compliance query; without it, it serves only
  CENTRAL facts and clearly says "state-specific rules depend on your state."
- With context, it returns the **most specific servable KI** (district > state > central) per [05](05-jurisdiction-engine.md).
- Language: returns the KI in `context.language` if available, else falls back with a note (translation
  doesn't alter evidence/jurisdiction).

## 6. Version retrieval

- Default: the **active** version (`effective_to: null`).
- `as_of: <date>` → the version in force on that date (for prior-year reports/audits) — [06](06-version-control.md).
- The answer states which version/date it used, so a user knows "this was the rule as of FY___".

## 7. Caching & invalidation

- AI answers/embeddings may be cached, keyed by `(query, context, cited_KI_versions)`.
- A MAJOR version bump or retirement **invalidates** every cached answer citing the changed KI (cascade
  from [07](07-update-engine.md)/[09](09-cross-reference-engine.md)). No stale cached fact survives a rule change.

## 8. Retrieval ranking signals

`score = jurisdiction_specificity × evidence_level_weight × confidence × recency × source_authority`.
Educational (A) queries rank by relevance + clarity; regulated (B/C/D) queries **hard-filter** to E3+
first, then rank. *Permission (level) gates; confidence only ranks* ([03 §4](03-evidence-model.md)).

## 9. Safety guarantees (architectural)
1. **Grounded-only:** AI cannot assert a regulated specific without a servable cited KI.
2. **No silent generalization** across jurisdictions.
3. **Cited-or-hedged:** every factual statement has provenance, or is framed as "verify".
4. **Version-honest:** answers carry an `as_of`; cache invalidates on change.
5. **Read-only:** AI never writes knowledge; updates are human/SME-gated.
6. **Demand ≠ truth:** popular queries don't lower the evidence bar.

## 10. Reuse note
The existing `/ask` (AskAssistant) and `siteSearch` become the **first consumers** of this API:
graph-aware, citation-bearing retrieval over the KI store (an upgrade already anticipated in
[SCOS 06 §7](../scos/06-knowledge-graph.md)). In-app contextual help can call `getJurisdiction()` with the
logged-in society's profile to give *state-correct* answers automatically.

---

### Cross-references
[Knowledge Registry](04-knowledge-registry.md) · [Jurisdiction Engine](05-jurisdiction-engine.md) · [Version Control](06-version-control.md) · [Cross-Reference Engine](09-cross-reference-engine.md) · [Content Readiness Engine](10-content-readiness-engine.md)
