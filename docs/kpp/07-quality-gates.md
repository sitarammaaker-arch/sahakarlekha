# 07 — Quality Gates

> A Knowledge Item moves from `planned` → `active` (generation-ready) **only** when it passes every
> applicable gate. These gates are the KPP-level enforcement of the foundation rules; they reuse the
> [KAE QA gates](../kae/08-quality-assurance.md) and add the population-specific completeness checks.

---

## 1. The eight activation gates

A KI becomes **ACTIVE** only when:

| # | Gate | Pass condition | Source |
| --- | --- | --- | --- |
| 1 | **Definition completed** | `definition` + `purpose` written (structured, Hinglish, not an article) | [03 §6](03-population-rules.md) |
| 2 | **Relationships linked** | ≥1 `prerequisite`/`related`; all targets resolve; no orphan/cycle | [04](04-knowledge-relationships.md) |
| 3 | **Evidence linked** | `evidence_id` (`EV-`) present; level meets the readiness minimum | [KAE 03](../kae/03-evidence-model.md) |
| 4 | **SMRD linked** | `research_id` resolves to a real research record | [SMRD 03](../smrd/03-topic-research-registry.md) |
| 5 | **SCOS linked** | `topic_id` resolves to a real cluster | [SCOS 03](../scos/03-topic-registry.md) |
| 6 | **Search intent linked** | mapped to ≥1 intent + query pattern | [SCOS 04](../scos/04-search-intent.md) |
| 7 | **Related modules linked** | module route attached where one performs the concept | [SCOS 02](../scos/02-knowledge-architecture.md) |
| 8 | **No duplication** | unique `concept_key`; no unmerged near-duplicate | [03 §2](03-population-rules.md) / [KAE 08 Q5](../kae/08-quality-assurance.md) |

> Plus the **readiness gate** ([KAE 10](../kae/10-content-readiness-engine.md)): Level **A** needs gates 1–8;
> Levels **B/C/D** additionally need **E3 + SME sign-off** (gate 3 raised) before `active`.

## 2. Gate-to-readiness matrix

| Readiness | Gates 1–8 | Evidence min | SME (gate 3+) | Can be `active` without SME? |
| --- | :-: | :-: | :-: | :-: |
| **A** educational/product | ✓ | E1/E2† | — | **Yes** |
| **B** accounting | ✓ | **E3** | required | No |
| **C** compliance | ✓ | **E3** | required | No |
| **D** legal | ✓ | **E3/E4** + exact jurisdiction | required | No |

**Implication for Wave 1:** the ~210 Level-A KIs can reach `active` now (definitions + links); the
~146 B/C/D KIs sit at `in-review` until the SME clears them. *Gate law, free education.*

## 3. Gate detail

1. **Definition** — present, atomic, consistent with evidence; for NEV items, states the concept
   generally and defers the specific ("verify with CA/RCS"). No fabrication.
2. **Relationships** — graph integrity ([04 §6](04-knowledge-relationships.md)): no orphan, acyclic, all ids resolve, `implemented_by` → real route.
3. **Evidence** — `EV-` record complete; `evidence_level ≥` the readiness minimum; `nev_status:false` required for B/C/D `active`.
4–5. **SMRD/SCOS links** — both ids resolve (a KI with no foundation link is rejected — [03 §3](03-population-rules.md)).
6. **Search intent** — at least one intent lens + query pattern, so the KI is *findable* and the right asset type is known when rendered.
7. **Modules** — conversion bridge + SaaS-doc source; mandatory where applicable.
8. **No duplication** — `concept_key` unique; merges from [06 §2](06-gap-analysis.md) applied.

## 4. Lifecycle through the gates

```
planned ──(gates 1,4,5,8 + relationships drafted)──▶ drafting
drafting ──(definition written, gates 1–2,6–7)─────▶ in-review
in-review ──A: gates 1–8 pass───────────────────────▶ active
in-review ──B/C/D: + E3 + SME sign-off──────────────▶ active
active ──(KAE update/version change)────────────────▶ superseded / re-review
```

## 5. Automated vs human gates

| Gate | Automatable | Human |
| --- | --- | --- |
| 2,4,5,7,8 (link/dup integrity) | ✅ validator over the KI store | — |
| 1,6 (definition/intent present) | presence-check ✅; quality 👤 | editor |
| 3 evidence completeness | ✅ schema; **level/SME** 👤 | SME |

Implementable as a CI-style pass over the KI data store (analogous to the SCOS link-validator). The
**build/promotion fails** if any KI marked `active` violates a gate.

## 6. Generation eligibility (what `active` unlocks)

Only an `active` KI may be used to **generate** downstream assets ([00 §generation map](00-master-index.md)).
- **AI generation** ([KAE 11](../kae/11-ai-knowledge-api.md)): allowed for `active` Level-A/B KIs; C/D require
  human authorship + SME in the loop even when `active`.
- A generated asset **inherits the KI's max readiness level** and **cites its evidence**.

## 7. Integrity guarantees
1. No `active` KI without all eight gates (+ readiness gate) passed.
2. B/C/D never bypass SME — no "temporary publish".
3. Duplicates merged before activation.
4. Every activation logged (who/when) — audit trail via git.
5. A KI that fails a gate names the failed gate (actionable), and stays pre-active.
6. *Knowledge first:* no asset is generated from a non-`active` KI.

---

### Cross-references
[Population Rules](03-population-rules.md) · [Wave-1 Registry](05-wave-1-registry.md) · [Knowledge Relationships](04-knowledge-relationships.md) · [Gap Analysis](06-gap-analysis.md) · [KAE Quality Assurance](../kae/08-quality-assurance.md) · [KAE Content Readiness](../kae/10-content-readiness-engine.md)
