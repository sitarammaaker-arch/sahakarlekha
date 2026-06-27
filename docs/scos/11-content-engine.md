# 11 — Content Production Engine

> The repeatable workflow that turns a registry cluster into a published, validated, linked asset.
> Optimized for **authority and correctness**, not speed. Every accounting/legal asset passes the
> `⚠️ NEV` gate before publish.

---

## 1. Pipeline (stages & gates)

```
0 SELECT  →  1 RESEARCH  →  2 OUTLINE  →  3 REFERENCES  →  4 WRITE
   →  5 FACT-CHECK (NEV gate)  →  6 SEO REVIEW  →  7 EDIT/QA  →  8 PUBLISH  →  9 UPDATE/REVIEW-QUEUE
```
A stage cannot start until the prior gate passes. Gates 5 and 6 are **blocking**.

| # | Stage | Owner | Output | Gate to pass |
| --- | --- | --- | --- | --- |
| 0 | Select | Editor | cluster id + priority | in registry, not duplicate |
| 1 | Research | Writer | source notes | real sources gathered |
| 2 | Outline | Writer | H1/H2/H3 + intents | matches blueprint ([12](12-article-blueprint.md)) |
| 3 | References | Writer/Researcher | citation list | every claim has a source or `⚠️ NEV` |
| 4 | Write | Writer | draft (Hinglish) | house style + blueprint |
| 5 | **Fact-check** | CA/Auditor | validated draft | **no unverified accounting/legal claim** |
| 6 | **SEO review** | SEO | optimized draft | metadata, schema, links, canonical OK |
| 7 | Edit/QA | Editor | final | language, tables, no orphan links |
| 8 | Publish | Editor | live asset | build passes (prerender + link rules) |
| 9 | Update | Editor | review_due set | freshness cadence ([07 §9](07-seo-engine.md)) |

## 2. Cluster spec (front-matter every asset carries)

```yaml
id: C112
cluster: depreciation
title, slug, metaTitle, metaDescription, date     # blog order rule applies
pillar, personas, surface_canonical, surfaces, module
intents: [...]                # from 04
edges: {...}                  # from 06 (powers linking)
magnet: depreciation-template # from 08
validation: NEV | {by, on}    # gate 5
sources: [...]                # from 13
review_due: 2027-03-01        # gate 9
status: select|draft|review|published
```
> This is the single object the pipeline reads/writes. It also feeds the graph, SEO, and lead engines —
> **one source, many renderings** (the SCOS principle).

## 3. The `⚠️ NEV` gate (non-negotiable)

- Any accounting treatment, Dr/Cr entry, tax rate, legal provision, deadline, or statutory format is
  **blocked** until a qualified CA / cooperative auditor validates it.
- Until validated: the asset may exist in **draft**, or publish with the concept *explained generally*
  + an explicit "verify current rate/section with your CA / the portal" note, and **no fabricated
    specifics** (no invented section numbers or rates).
- Validation is **recorded** (`validated-by`, `validated-on`) and shown as a trust badge ([01 §6](01-project-overview.md)).
- Re-validate on the freshness cadence and on any rule change.

## 4. Roles

| Role | Responsibility |
| --- | --- |
| Chief Knowledge Architect | registry, graph, priorities |
| Researcher | sources, references, authority links |
| Writer | outline + draft in house Hinglish |
| Subject Expert (CA/Auditor) | gate 5 validation |
| SEO | gate 6, schema, internal links |
| Editor | QA, publish, review queue |
| Engineer | build pipeline, link-validation, schema emit |

(In a small team one person wears several hats — the **gates** still apply.)

## 5. House style (enforced at gate 7)

- Hindi-first, everyday Hinglish (लाभ not मुनाफ़ा); English fallback; code/comments English.
- Worked examples + Dr/Cr tables; one clear H1; scannable H2/H3 = query patterns.
- English slugs; no apostrophes in single-quoted metadata; blog field order `slug,metaTitle,metaDescription,date`.
- Internal-link rules ([06 §6](06-knowledge-graph.md)); module CTA present; magnet attached.
- Accessibility: alt text (Hindi+English), table headers, readable contrast.

## 6. Reuse & dedup (mandatory pre-write check)

Before writing, search existing surfaces (`/guide` 47 chapters, `/blog`, `/help`, `/cookbook`, `/faq`)
via `siteSearch`/registries. If the concept exists:
- **Extend/upgrade** the canonical instead of creating a duplicate, OR
- create a **different-intent** asset that links to the canonical ([07 §8](07-seo-engine.md)).
Never produce two pages targeting the same query.

## 7. Tooling & automation (build on what exists)

- `prerender-guide.mjs` → extend to validate link rules (no orphan, ≤3 hops), emit breadcrumb/related
  data from `edges`, regenerate sitemap (already does), and bump `dateModified` on reviewed pages.
- Index registries (guide/blog/help/cookbook) → add the cluster-spec fields.
- Seasonal drip (`isPublished()` + daily GitHub Action → Vercel hook) → already live; reuse for timed publishes & scheduled re-reviews.
- `/ask` assistant → graph-aware retrieval over published nodes.
- GA4 + Search Console → feed the review queue (decaying pages → refresh).

## 8. Batch production (scale without losing quality)

- Produce **cluster-complete batches** (pillar's P0/P1 nodes together) so internal links resolve immediately.
- Templates/calculators/state-matrix pages are **generated from the spine** ([03 D27–D30](03-topic-registry.md)),
  each still passing gates 5–7 (no auto-publish of unvalidated statutory content).
- Maintain a visible **content board**: Select → Draft → NEV → SEO → Published → Review-due.

---

### Cross-references
[Article Blueprint](12-article-blueprint.md) · [SEO Engine](07-seo-engine.md) · [Knowledge Graph](06-knowledge-graph.md) · [Authority Engine](13-authority-engine.md) · [Roadmap](14-roadmap.md)
