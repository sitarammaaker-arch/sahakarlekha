# 01 — Research Methodology

> **SMRD = SahakarLekha Master Research Database.** The verified-fact + source layer that sits
> *beneath* the [SCOS](../scos/00-master-index.md). SCOS decides *what to build and how*; SMRD decides
> *what is true, where it came from, and whether it may be written yet.*
>
> **This is research infrastructure, not content.** No articles, no SEO copy, no publishing.

**Status:** Foundation v1.0 · **Created:** 2026-06-27 · **Owner:** Lead Research Architect
**Relationship:** every SMRD record keys to a SCOS cluster id (C001–C386). SMRD never re-defines a
topic — it *researches* it. (Anti-duplication rule, mirrors [SCOS 11 §6](../scos/11-content-engine.md).)

---

## 1. Research philosophy

1. **Truth before traffic.** A claim enters the database only with a traceable source or an explicit `NEV` flag. We never invent accounting treatments or legal provisions.
2. **Primary over secondary.** Prefer the Act/Rule/portal/standard itself over any commentary about it.
3. **Jurisdiction is a first-class fact.** Cooperative law is largely *state* law — every legal/compliance record names its jurisdiction (central / state / society-type) or is invalid.
4. **Dated, not timeless.** Rates, thresholds, deadlines, and formats carry an `as_of` date and a re-check trigger. Nothing is "permanently true."
5. **Research is reusable.** One verified research record powers many deliverables (article, calculator, template, `/ask` answer, SaaS feature) — research once, render many ([SCOS](../scos/00-master-index.md)).
6. **Gaps are recorded, not hidden.** Unknowns are written down as gaps (see [00 Gap Analysis](00-master-research-index.md)), never silently skipped.

## 2. Source hierarchy (which source wins)

Ordered by authority. A higher tier overrides a lower one on conflict.

| Tier | Source class | Examples | Weight |
| --- | --- | --- | --- |
| **T1 — Primary law/standard** | Acts, Rules, Accounting/Audit Standards, official forms | State Coop Act & Rules, MSCS Act 2002, ICAI AS, CGST/IT Acts | authoritative |
| **T2 — Official issuances** | Govt circulars, portal guidance, regulator manuals | RCS circulars, NABARD/RBI guidelines, PACS CAS manual, GST/TRACES portal | authoritative (dated) |
| **T3 — Institutional** | Promotional bodies, training institutes, universities | NCDC, NCUI, VAMNICOM, ICM, coop universities | strong |
| **T4 — Professional commentary** | CA/ICAI guidance notes, professional articles, textbooks | ICAI technical guides, standard coop-accountancy texts | supporting |
| **T5 — Field/observed** | Real society records, our app's own logic, SME interviews | demo society, module formulas, auditor input | corroborating |
| **T6 — Secondary web** | News, blogs, aggregators | press, explainer sites | lead-only (never sole basis) |

**Rule:** a `NEV` claim cannot be cleared by T6 alone. Statutory/accounting facts require **T1/T2**
confirmation plus **SME sign-off** (T5 expert).

## 3. Evidence levels (per claim)

| Level | Meaning | Can publish? |
| --- | --- | --- |
| **E0 — Unverified** | asserted, no source yet | ❌ (draft only) |
| **E1 — Single secondary** | one T4–T6 source | ❌ research-required |
| **E2 — Primary cited** | T1/T2 source captured (title+ref+date+URL) | ⚠️ pending SME |
| **E3 — Primary + SME** | T1/T2 cited **and** CA/auditor validated | ✅ publishable |
| **E4 — Cross-confirmed** | multiple primaries + SME, no conflict | ✅ canonical/citable |
| **NEV** | needs expert validation (state/year-variable) | ❌ until raised to E3 |

Every research record stores its current evidence level. **Quality gate ([10](10-content-readiness.md)):
nothing accounting/legal is written below E3 / NEV-cleared.**

## 4. Validation workflow

```
CAPTURE      → record claim + candidate source (E0/E1)
SOURCE       → attach primary T1/T2 citation (→ E2)         [Researcher]
JURISDICTION → tag central/state/type; flag variability     [Researcher]
SME REVIEW   → CA / cooperative auditor confirms (→ E3)      [Subject Expert]   ⟵ blocking gate
CROSS-CHECK  → second primary / cross-confirm (→ E4)         [Researcher]
STAMP        → validated_by, validated_on, as_of, recheck_on [Editor]
MONITOR      → re-validate on trigger (see §7)               [Editor]
```
The SME step is the same **gate 5** as [SCOS 11 §3](../scos/11-content-engine.md) — SMRD supplies the
sourced material the SME signs.

## 5. Duplicate detection (do not re-research)

Before opening a new research record:
1. **Check SCOS** — does a cluster id already cover this topic? Key the record to it; never create a parallel topic.
2. **Check existing surfaces** — `/guide` (47 ch.), `/blog`, `/help`, `/cookbook` (~40 recipes), `/faq` already encode verified treatments; cite them as **T5 internal** corroboration and avoid re-deriving.
3. **Check this DB** — search [03](03-topic-research-registry.md) by cluster id and [02](02-source-registry.md) by source id; reuse the captured source, don't re-fetch.
4. **One claim, one record.** If two clusters need the same fact (e.g. a TDS rate), store it **once** with a canonical `claim_id` and reference it.

## 6. Versioning

- Each research record is versioned: `vMAJOR.MINOR` — MINOR = source added / wording; MAJOR = the fact changed (rate/section/format) → triggers downstream content refresh.
- Source records ([02](02-source-registry.md)) carry the source's own edition/amendment + `captured_on`.
- Changes logged with `changed_on`, `changed_by`, `reason`, and the affected SCOS cluster ids (so the content review queue can fire).
- The DB is plain markdown in git → full history/blame is the audit trail.

## 7. Update strategy (re-validation triggers)

| Trigger | Affected | Action |
| --- | --- | --- |
| Union Budget / Finance Act | tax records (GST/TDS/IT) | re-verify rates/sections → bump version, flag content |
| GST Council / CBIC notification | GST records | re-verify, re-stamp |
| State Coop Act/Rules amendment | that state's records ([07](07-state-wise-registry.md)) | re-verify jurisdiction records |
| RCS / NABARD / RBI circular | compliance/loan records | capture new T2, re-validate |
| ICAI standard revision | accounting records ([05](05-accounting-research.md)) | re-verify treatment |
| Form/return format change | template/compliance records | re-validate format |
| `recheck_on` date reached | any dated record | scheduled re-validation |

Re-validation reuses the live **drip + daily rebuild** infra ([SCOS 07 §9](../scos/07-seo-engine.md)) to
surface due records.

## 8. Record states (lifecycle)

`open` → `sourcing` → `sourced(E2)` → `sme-review` → `validated(E3/E4)` → `monitored` → (`stale` on trigger → back to `sme-review`).

---

### Cross-references
[Source Registry](02-source-registry.md) · [Topic Research Registry](03-topic-research-registry.md) · [Content Readiness](10-content-readiness.md) · [SCOS Content Engine](../scos/11-content-engine.md) · [SCOS Authority Engine](../scos/13-authority-engine.md)
