# 05 — Jurisdiction Engine

> Cooperative knowledge is **context-dependent**: the right answer changes by state, society type,
> sector, and language. The jurisdiction engine makes every Knowledge Item **context-scoped** and
> resolves *"which KI applies to this society?"* deterministically. Extends SMRD's jurisdiction tags
> ([SMRD 06](../smrd/06-law-and-compliance.md)) into a full dimensional + resolution model.

---

## 1. Jurisdiction dimensions

A KI's applicability is a vector across these axes:

| Axis | Values | Source of truth |
| --- | --- | --- |
| **Central** | CENTRAL (applies nationwide) | MSCS, GST, IT, ICAI |
| **State** | STATE:{XX} (28 states + 8 UTs) | [SMRD 07](../smrd/07-state-wise-registry.md) |
| **District** | DIST:{state}:{code} | state notifications (rare; e.g. DCCB areas) |
| **Society Type** | TYPE:{pacs\|dairy\|consumer\|marketing\|credit\|housing\|labour\|processing\|weavers\|fisheries\|federation\|mpacs} | SCOS D02/D27 |
| **Sector** | SECTOR:{agri-credit\|banking\|procurement\|...} | NABARD/RBI scope |
| **Language** | LANG:{hi\|en\|mr\|gu\|...} | [SMRD 07](../smrd/07-state-wise-registry.md) |

> A KI may scope multiple axes: e.g. `{STATE:MH, TYPE:credit, SECTOR:banking}` for a Maharashtra urban
> coop-bank rule. Unscoped axes = "any".

## 2. Scope expression

```yaml
applies_to:
  central: false
  states: [RJ]              # or "all"
  districts: []             # empty = all districts in scope states
  types: [pacs, mpacs]      # empty = all types
  sectors: [agri-credit]
  languages: [hi]           # presentation language(s) available
```

## 3. Resolution algorithm (context → the right KI)

Given a **query context** (the society's profile) and a `concept_key`:

```
INPUT context = {state, district, type, sector, language}
1. Collect all KIs with this concept_key whose evidence_status is servable (E3/E4, or A-level).
2. Score each by SPECIFICITY MATCH (most specific wins):
     exact state+type+district  >  state+type  >  state  >  central fallback
3. If a STATE-specific KI exists for the context → use it.
4. Else if a CENTRAL/model KI exists → use it BUT flag "state-specific not yet researched"
     (a known GAP, never a fabricated state answer).
5. If none servable → return NEV: "verify with your RCS/CA" (never guess).
6. Resolve language: serve LANG:{context} if available, else fall back to hi→en with a note.
```

**Specificity precedence:** `district > state > central`, and within a tier `type-specific > type-agnostic`.

## 4. The "no silent generalization" rule (critical)

- If only a CENTRAL/model KI exists and the user is in a state we **haven't** researched, the engine
  **must not present the central fact as that state's law.** It serves the general concept + an explicit
  *"state-specific provision not yet validated — confirm with RCS/CA"* and logs a **coverage gap**
  ([12](12-gap-analysis.md)).
- This is the runtime enforcement of *never infer legal provisions*.

## 5. Conflict across jurisdictions

When two KIs could match (e.g. state rule vs sectoral RBI rule for a coop **bank**):
- Apply the **domain precedence**: for coop banks, RBI/sectoral may override state on banking matters;
  for non-bank societies, state law governs. The precedence itself is a **researched KI** (`NEV` until
  confirmed) — the engine does not assume it.
- Unresolved conflicts → surface both with a flag, never auto-pick.

## 6. Society profile (the context object)

Every SahakarLekha society already has a profile (state, type, etc. in `society-setup`). KAE consumes
that as the **query context** so the [AI API](11-ai-knowledge-api.md) and in-app help return the
*jurisdiction-correct* answer automatically — a major product advantage over generic content.

```yaml
society_context:
  state: RJ
  district: Jaipur
  type: pacs
  sector: agri-credit
  language: hi
```

## 7. Jurisdiction integrity rules
1. Every KI **must** declare `applies_to` (no unscoped legal/compliance KIs).
2. A KI's jurisdiction must equal its evidence record's jurisdiction ([03](03-evidence-model.md)).
3. CENTRAL facts are reusable across all states; STATE facts never leak to another state.
4. A `concept_key` should aim for **coverage of all in-scope states**; missing states are tracked gaps.
5. Resolution is **deterministic and logged** (which KI served, why) — auditable.
6. Language is a *presentation* axis: translating a KI does **not** change its evidence or jurisdiction.

---

### Cross-references
[Knowledge Registry](04-knowledge-registry.md) · [Evidence Model](03-evidence-model.md) · [AI Knowledge API](11-ai-knowledge-api.md) · [Gap Analysis](12-gap-analysis.md) · [SMRD State-wise Registry](../smrd/07-state-wise-registry.md) · [SMRD Law & Compliance](../smrd/06-law-and-compliance.md)
