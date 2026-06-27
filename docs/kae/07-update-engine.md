# 07 — Update Engine

> The continuous process that keeps knowledge **current**: detects new/changed regulations, records
> updates, marks affected topics, schedules reviews, tracks outdated content, and maintains the
> **update queues**. This is what makes KAE an *engine* rather than a static database.

---

## 1. Update loop (the heartbeat)

```
DETECT → CAPTURE → CLASSIFY → IMPACT-MAP → QUEUE → REVIEW(SME/QA) → VERSION → CASCADE → STAMP
   ↑                                                                                      │
   └──────────────────── scheduled by next_review_date / source cadence ─────────────────┘
```

## 2. Detection (how new regulations are found)

| Channel | Watches | Cadence (from [02](02-source-catalog.md) `update_frequency`) |
| --- | --- | --- |
| **Source polling** | official portals/gazettes (GST, IT, RCS, NABARD, RBI, ICAI) | per-source (tax=frequent, acts=on-amendment) |
| **Calendar triggers** | Budget, GST council, FY rollover, audit season | fixed dates |
| **`next_review_date` sweep** | KIs whose review date passed → auto-`stale` | daily |
| **Manual report** | SME/staff spots a change | ad-hoc |
| **Signal mining** | `/ask` logs, support inbox surfacing "the rule changed" | continuous |

> Detection records a **candidate** (pointer + what seems to have changed). It never auto-updates a
> fact — every change goes through review. *No fabrication, no auto-inference.*

## 3. Capture & classify

- Capture the change as a **discovered KI/version candidate** (source ref + date + the specific new claim).
- Classify the **change class** ([06 §2](06-version-control.md)): legal / circular / tax / accounting / editorial.
- Tag **jurisdiction** ([05](05-jurisdiction-engine.md)) and the affected `concept_key`(s).

## 4. Impact mapping (what this update touches)

For each captured change, compute the blast radius:
1. The target KI(s) (by `concept_key` + jurisdiction).
2. Their **dependents** (`derived_from`/`requires`) via [09](09-cross-reference-engine.md).
3. The **SCOS clusters / templates / calculators / SaaS modules** consuming those KIs.
4. **AI cache** entries to invalidate.

Output: an **impact set** attached to the update record.

## 5. Update queues

| Queue | Holds | SLA target (policy) |
| --- | --- | --- |
| **Detection inbox** | unclassified candidates | triage within cadence |
| **SME review** | E2 KIs needing sign-off; legal/accounting changes | by criticality (tax/legal first) |
| **Re-verify (stale)** | KIs past `next_review_date` | before content using them re-publishes |
| **Cascade** | dependents flagged by a MAJOR change | alongside the source change |
| **Content rebuild** | SCOS assets to refresh | feeds [SCOS freshness](../scos/07-seo-engine.md) |

Priority order: **tax & legal changes with near effective dates** > broad-impact accounting standards >
single-topic editorial. Criticality = `affected_KIs × authority × user-exposure`.

## 6. Scheduling reviews

- Each KI's `next_review_date` is set from its source cadence + change class ([03 §5](03-evidence-model.md)).
- The daily sweep moves due KIs into **Re-verify**; reused live infra: the existing **daily GitHub
  Action → Vercel rebuild** ([SCOS roadmap](../scos/14-roadmap.md)) is the natural carrier for surfacing
  due reviews and refreshing dependent content.
- Seasonal/statutory calendar (FY close, GST cycles, AGM, audit) pre-schedules review spikes
  (mirrors [SMRD 04 seasonality](../smrd/04-search-intelligence.md)).

## 7. Tracking outdated content

A KI is **outdated** when: `now > next_review_date` **or** a detected change supersedes its active
version **or** its source's `effective_to` has passed. Outdated KIs:
- are **down-ranked** in [AI retrieval](11-ai-knowledge-api.md) (confidence decays, [03 §3](03-evidence-model.md)),
- block re-publish of dependent content until re-verified,
- appear on the **freshness dashboard** (an operational view rolling up KI staleness by domain/state).

## 8. Recording updates (provenance)

Every update writes an immutable record: `{detected_on, source_ref, change_class, concept_key,
jurisdiction, impact_set, decision (accepted/rejected/NEV), reviewer, new_version}`. This + git history
= a complete "why did this fact change and when" trail.

## 9. Engine guarantees
1. **Detection ≠ mutation** — a fact only changes after review/version, never automatically.
2. **No silent staleness** — outdated KIs are flagged and down-ranked, never served as current.
3. **Cascade is mandatory** on MAJOR changes — dependents cannot be missed.
4. **Tax/legal first** — the queue prioritizes high-exposure, time-sensitive changes.
5. **NEV on uncertainty** — an ambiguous detected change parks at NEV, not a guess.

---

### Cross-references
[Source Catalog](02-source-catalog.md) · [Version Control](06-version-control.md) · [Cross-Reference Engine](09-cross-reference-engine.md) · [Quality Assurance](08-quality-assurance.md) · [SCOS Freshness Strategy](../scos/07-seo-engine.md)
