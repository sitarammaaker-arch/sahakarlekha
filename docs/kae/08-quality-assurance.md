# 08 — Quality Assurance

> The runtime gates every Knowledge Item must pass before it can be served (to content, AI, or
> features). QA is **automated where possible, SME where required**. A KI that fails any gate cannot be
> `active`. These gates operationalize the principles: *evidence before opinion, primary before
> secondary, never fabricate.*

---

## 1. The seven gates

| # | Gate | Checks | Automatable? |
| --- | --- | --- | --- |
| Q1 | **Source validation** | ≥1 source id resolves to [02](02-source-catalog.md); tier recorded; `official` flag correct for Tier-1 | mostly auto |
| Q2 | **Evidence validation** | evidence record complete ([03](03-evidence-model.md)); level ≥ required; NEV honored | auto |
| Q3 | **Jurisdiction validation** | `applies_to` present; matches evidence jurisdiction; no unscoped legal/compliance KI | auto |
| Q4 | **Cross-reference validation** | dependencies resolve; no dangling/circular refs; supersession links valid ([09](09-cross-reference-engine.md)) | auto |
| Q5 | **Duplicate detection** | no existing KI with same `concept_key + jurisdiction + effective window` | auto |
| Q6 | **Completeness check** | all required schema fields present for the `knowledge_type` | auto |
| Q7 | **Expert review** | SME sign-off where the type/readiness demands ([10](10-content-readiness-engine.md)) | human |

A KI is **servable** only when all gates applicable to its readiness level pass.

## 2. Gate detail

**Q1 Source** — reject E0 (no source). Tier-1 claims need an `official` primary issuer; commentary
(Tier 3–4) cannot alone support legal/accounting KIs. Conflicts across sources → resolve by tier, log.

**Q2 Evidence** — level meets the minimum for the content class (legal/accounting → E3; educational →
E1+ ok, see [10](10-content-readiness-engine.md)). `nev_status:true` blocks `active` for legal/accounting.

**Q3 Jurisdiction** — every legal/compliance KI scoped; the **no-silent-generalization** rule ([05 §4](05-jurisdiction-engine.md))
is enforced here (a central fact may not masquerade as a state's).

**Q4 Cross-reference** — `dependencies`, `supersedes`, `derived_from` all resolve to real KIs; detect
cycles; ensure a superseded KI isn't still referenced as active.

**Q5 Duplicate** — atomicity ([04 §4](04-knowledge-registry.md)): same fact must not exist twice. Near-duplicates
(same concept_key, overlapping window) flagged for merge. Reuse over re-create (mirrors SMRD/SCOS dedup).

**Q6 Completeness** — required-field matrix per `knowledge_type` (e.g. legal KI must have jurisdiction,
effective_date, section ref, reviewer).

**Q7 Expert review** — the SME gate. Required for `legal`, `compliance`, `accounting` types and any KI
at readiness **C/D**. Records `reviewer` + date. This is the same SME gate as SMRD/SCOS — one validation
clears all three layers.

## 3. Validation matrix (which gates per knowledge type)

| Type | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 (SME) |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| definitional | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| product | ✓ | ✓ | — | ✓ | ✓ | ✓ | — |
| computational | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | light |
| accounting | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **required** |
| compliance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **required** |
| legal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **required** |
| procedural | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | varies |

## 4. Automated QA (CI-style)

Implementable as a validation pass over the KI store (analogous to extending `prerender-guide.mjs` for
link rules in SCOS):
- schema/required-field lint (Q6), source-id resolution (Q1), evidence-completeness (Q2),
  jurisdiction-presence (Q3), ref-graph integrity + cycle detection (Q4), duplicate scan (Q5).
- **Fails the build/promotion** if any active KI violates a gate. Q7 remains human, tracked as a flag.

## 5. Failure handling
- A failing KI is held in its pre-active state with the **failed gate(s) named** (actionable).
- Legal/accounting KIs failing Q7 stay **NEV** — content may use the *concept* generally, never the *specific*.
- QA outcomes are logged; repeated source conflicts escalate to SME.

## 6. QA invariants
1. No KI is `active` with an unresolved gate applicable to its level.
2. SME-required types cannot bypass Q7 — no exceptions, no "temporary publish."
3. Duplicates are merged, not coexisted.
4. Every QA decision is logged (audit trail).
5. Educational content is **not** over-gated (Q7 not required at level A — see [10](10-content-readiness-engine.md)).

---

### Cross-references
[Evidence Model](03-evidence-model.md) · [Jurisdiction Engine](05-jurisdiction-engine.md) · [Cross-Reference Engine](09-cross-reference-engine.md) · [Content Readiness Engine](10-content-readiness-engine.md) · [SMRD Content Readiness](../smrd/10-content-readiness.md)
