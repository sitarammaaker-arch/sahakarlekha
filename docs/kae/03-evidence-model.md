# 03 — Evidence Model

> The data structure that makes every Knowledge Item **defensible**. Each KI carries exactly one
> **evidence record**. KAE **reuses SMRD's evidence levels** (E0–E4 / NEV,
> [SMRD 01 §3](../smrd/01-research-methodology.md)) and adds the runtime **evidence object schema**, a
> **confidence model**, and the **review lifecycle dates**.

---

## 1. Evidence record schema (one per Knowledge Item)

```yaml
evidence_id: EV-000412
knowledge_id: KI-00731            # the claim this evidence backs (→ 04)
source_ids: [SRC-ST-ACT-RJ, SRC-PRO-CA]     # → 02 / SMRD 02 (reuse ids)
evidence_level: E0..E4 | NEV     # SMRD scale (below)
confidence: 0.0–1.0              # KAE confidence model (§3)
jurisdiction: STATE:RJ           # → 05 (must match the KI)
effective_date: 2024-04-01       # when the fact took effect
effective_to: null | 2026-03-31  # null = currently in force
last_verified: 2026-06-27
next_review_date: 2027-03-01     # → 07 update engine schedules this
reviewer: ""                     # SME / role who validated (empty until done)
nev_status: true|false           # true until E3 reached for legal/accounting
conflict: null | {with, resolved_by, note}
provenance: {captured_on, captured_by, source_ref, source_url}
```

> **The captured claim is stored, not the bulk source text** — only the specific assertion + an exact
> citation pointer (section/clause + date + URL). Protects IP and keeps freshness precise.

## 2. Evidence levels (reused from SMRD — single source of truth)

| Level | Meaning | Servable? |
| --- | --- | --- |
| E0 | asserted, no source | ❌ |
| E1 | one secondary source (Tier 3–4) | ❌ |
| E2 | primary/authoritative source captured (Tier 1–2) | ⚠️ pending review |
| E3 | primary + **SME sign-off** | ✅ |
| E4 | multiple primaries cross-confirmed + SME | ✅ canonical/citable |
| **NEV** | needs expert validation (uncertain / variable) | ❌ until raised to E3 |

*KAE does not invent a parallel scale — it points to SMRD's. This prevents drift between the two layers.*

## 3. Confidence model (KAE addition — a graded signal within a level)

`confidence ∈ [0,1]` is a **secondary** signal used for ranking/triage and AI retrieval; it never
overrides the hard E-level gate. Computed from:

| Factor | Effect |
| --- | --- |
| Source authority (Tier 1 > 5) | + |
| Number of independent confirming sources | + |
| Recency vs `update_frequency` (fresh) | + |
| Jurisdiction exactness (exact-match > inherited) | + |
| Internal corroboration (T5 module/guide agrees) | + |
| Open conflict between sources | − |
| Age past `next_review_date` | − (decays) |

Bands: `≥0.85 high · 0.6–0.85 medium · <0.6 low`. **A high-confidence E2 is still not publishable**
for legal/accounting content — confidence informs *priority*, the E-level governs *permission*.

## 4. Confidence ≠ permission (critical separation)

```
PERMISSION to serve  ← evidence_level (+ readiness level, 10) + nev_status
PRIORITY / ranking   ← confidence (+ business value from SMRD 04)
```
This keeps us honest: a popular, high-confidence-looking claim with no primary source is still **E1 →
not servable** for compliance/legal. *Authority before popularity.*

## 5. Effective-dating & verification lifecycle

- `effective_date` / `effective_to` define the **validity window** — enables historical queries
  ("the rule that applied in FY2024-25") via the [AI API](11-ai-knowledge-api.md) `as_of` filter.
- `last_verified` + `next_review_date` drive the [update engine](07-update-engine.md): when "now" passes
  `next_review_date`, the KI is auto-flagged `stale` and re-enters review.
- `next_review_date` defaults from the source's `update_frequency` ([02](02-source-catalog.md)):
  tax/circulars → short; standards/acts → longer; structural/product → longest.

## 6. NEV handling (the non-fabrication guarantee)

- Any legal provision or accounting treatment is born `nev_status: true`, `evidence_level ≤ E2`.
- It can be **described generally** (concept exists, purpose) but its **specific value** (section, rate,
  %, format, deadline) **must not be served as fact** until E3.
- Clearing NEV requires: Tier-1/2 source + `reviewer` (SME) recorded → level becomes E3, `nev_status:false`.
- **Never infer** a provision from a related one; **never fabricate** a citation to clear NEV.

## 7. Evidence integrity rules
1. One evidence record per KI; multiple `source_ids` allowed.
2. `jurisdiction` on evidence **must equal** the KI's jurisdiction.
3. A KI cannot be `active` ([01 lifecycle](01-knowledge-architecture.md)) with `evidence_level < E2`.
4. Legal/accounting KIs cannot be `active` with `nev_status: true`.
5. Conflicts are **recorded, not hidden**; resolution cites the deciding tier.
6. Every advance in level is logged (audit trail) with `who/when/why`.

---

### Cross-references
[Source Catalog](02-source-catalog.md) · [Knowledge Registry](04-knowledge-registry.md) · [Update Engine](07-update-engine.md) · [Quality Assurance](08-quality-assurance.md) · [SMRD Methodology](../smrd/01-research-methodology.md)
