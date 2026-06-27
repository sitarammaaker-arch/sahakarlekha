# 06 — Version Control

> Facts change — laws amend, circulars supersede, tax rates revise, accounting standards update. KAE
> treats knowledge as **append-only, time-versioned data** so nothing is ever silently overwritten and
> the **historical record is always recoverable** (essential for compliance and prior-year reports).

---

## 1. Versioning model (append-only)

- A Knowledge Item has an **immutable identity** (`knowledge_id`) and a chain of **versions**.
- Editing a fact = creating a **new version** that *supersedes* the prior; the prior is **archived**, not deleted.
- Each version has its own **evidence record** and **validity window**.

```yaml
knowledge_id: KI-00731
versions:
  - v1: {claim, evidence_id: EV-000300, effective: 2023-04-01..2024-03-31, state: superseded}
  - v2: {claim, evidence_id: EV-000412, effective: 2024-04-01..null,        state: active}
active_version: v2
```

**SemVer-style semantics for KIs:**
| Bump | Trigger | Downstream effect |
| --- | --- | --- |
| **MAJOR** | the fact changed (rate/section/%/format) | supersede; flag all dependents for re-review |
| **MINOR** | new corroborating source / scope clarified | re-stamp; no content rebuild needed |
| **PATCH** | typo/citation fix, language | no downstream effect |

## 2. Change classes (what kind of update)

| Class | Example | Versioning action |
| --- | --- | --- |
| **Legal update** | act/rule amended, new section | MAJOR; jurisdiction-scoped; new effective window |
| **Circular update** | RCS/NABARD/RBI circular changes a norm | MAJOR/MINOR per impact |
| **Tax change** | Budget/GST-council rate/threshold change | MAJOR; tight effective dating; cascade to calculators |
| **Accounting change** | ICAI standard revision | MAJOR; cascade to treatments/templates |
| **Editorial** | wording/citation fix | PATCH |

## 3. Effective dating & historical versions

- Every version stores `effective_from` / `effective_to`. The **active** version has `effective_to: null`.
- **Historical queries** (`as_of: 2024-12-31`) resolve to whichever version was active then — so a
  prior-year report or audit can cite *the rule that applied at the time*. ([AI API](11-ai-knowledge-api.md))
- Overlapping effective windows for the same `(concept_key, jurisdiction)` = an integrity error (QA gate).

## 4. Supersession & deprecation

```
v2 supersedes v1:  v1.state → superseded,  v1.effective_to = (v2.effective_from − 1 day)
deprecation:       mark a version "deprecated" (discouraged but still valid in its window)
```
- Supersession sets a `supersedes`/`superseded_by` link ([09](09-cross-reference-engine.md)).
- Deprecation warns content/AI to prefer the successor while keeping the old servable for history.

## 5. Retirement (fact no longer applicable)

When a law is repealed or a scheme/treatment is withdrawn entirely:
- KI → `retired`, `effective_to` set, **reason recorded**, optional `successor` pointer.
- Retired KIs are **served only with an `as_of` in their window**, or as "repealed — see successor".
- Never deleted (audit trail).

## 6. Rollback

- Because versions are append-only, **rollback = re-activate a prior version** (creates a new version
  that restores the prior claim), with a logged reason. No data is lost.
- Rollback is itself a versioned event (who/when/why) — used when a bad update is detected by QA or an SME.

## 7. Cascade on version change (dependency propagation)

On a MAJOR bump, the [update engine](07-update-engine.md) walks `dependencies`/cross-refs ([09](09-cross-reference-engine.md)) and:
1. Flags every dependent KI `needs-recheck`.
2. Flags every **SCOS cluster** / template / calculator that consumed the KI → enters the content
   review queue ([SMRD 10 handoff](../smrd/10-content-readiness.md), [SCOS 07 §9](../scos/07-seo-engine.md)).
3. Notifies the [AI API](11-ai-knowledge-api.md) cache to invalidate affected answers.

> Example: GST rate KI v2 (MAJOR) → GST calculator KI, GST cluster C124, gst-checklist template all
> auto-flagged. Nothing stale ships silently.

## 8. Audit trail

Every version transition records `{from_version, to_version, change_class, who, when, why,
source_ids, affected_dependents}`. The markdown/data store lives in **git**, so history + blame are
intrinsic. This trail is what lets an auditor trust SahakarLekha's knowledge.

## 9. Integrity rules
1. Append-only — never mutate a published version in place.
2. One `active` version per `(concept_key, jurisdiction)` at any instant.
3. No effective-window overlaps within a `(concept_key, jurisdiction)`.
4. MAJOR bump **must** trigger cascade flags before going active.
5. Retirement/rollback require a recorded reason.
6. Historical versions remain queryable forever.

---

### Cross-references
[Evidence Model](03-evidence-model.md) · [Update Engine](07-update-engine.md) · [Cross-Reference Engine](09-cross-reference-engine.md) · [AI Knowledge API](11-ai-knowledge-api.md) · [SCOS Freshness](../scos/07-seo-engine.md)
