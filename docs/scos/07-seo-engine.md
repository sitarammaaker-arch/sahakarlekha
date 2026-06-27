# 07 — SEO Engine

> How SCOS converts the knowledge graph into **topical authority** and durable rankings.
> Builds on the live stack: Vite SPA + `prerender-guide.mjs` (static HTML + auto sitemap),
> per-surface index registries, and existing JSON-LD.

---

## 1. Topic clusters (hub-and-spoke)

- **Pillar page** per major pillar/domain (16 pillars / 26 domains in [02](02-knowledge-architecture.md)/[03](03-topic-registry.md)): broad, authoritative, links to all spokes.
- **Spoke pages**: each cluster's canonical asset; links back to pillar + sideways to siblings.
- **Spoke → pillar** link is mandatory (up-link rule, [06 §6](06-knowledge-graph.md)). Pillar links to every spoke.
- Map: 1 pillar : N spokes : the graph edges supply the linking.

## 2. Topical authority strategy

1. **Complete a cluster before widening.** Ship the canonical + all firing intents ([04](04-search-intent.md)) + magnet for a pillar's P0/P1 nodes first.
2. **Query-pattern saturation** ([04 §4](04-search-intent.md)): cover info/how/formula/format/due-date/type variants per cluster.
3. **Entity coverage:** name and define every entity (society types, registers, reports, regulators, acts) → builds an entity graph Google can trust.
4. **Author authority:** CA/auditor bylines + validation badges (E-E-A-T, [01 §6](01-project-overview.md)).
5. **Internal links > backlinks** in the early phase: the graph density is the moat.

## 3. Internal linking (rules engine)

Derived mechanically from [06](06-knowledge-graph.md):
- Mandatory up-link (pillar + prerequisites), module link, authority link (if `⚠️ NEV`).
- 2–4 down-links, 3–6 related, 0 orphans, ≤3 hops from a pillar.
- Anchor text = target `title` (descriptive, Hindi-first). No "click here".
- **Validation in build:** extend `prerender-guide.mjs` to fail the build if any published node has <2 inbound links or is >3 hops from a pillar.

## 4. Breadcrumb structure

```
Home › {Pillar} › {Cluster} › {Asset}
Home › सहकारी लेखांकन › डेप्रिसिएशन › SLM बनाम WDV
```
- Emit `BreadcrumbList` JSON-LD on every content page.
- Surface-specific roots: `/guide`, `/blog`, `/help`, `/cookbook`, `/software`, `/cooperative-software`.
- Breadcrumb hierarchy = `part_of` edges from the graph.

## 5. URL structure (rules)

| Surface | Pattern | Rule |
| --- | --- | --- |
| Guide | `/guide/:slug` | English slug, concept canonical |
| Blog | `/blog/:slug` | English slug (house rule), dated |
| Help | `/help/:slug` | task verb slug (`add-member`) |
| Cookbook | `/cookbook/:slug` | recipe slug |
| Software | `/software/:type` | type slug (`pacs`, `dairy`) |
| State | `/cooperative-software/:state` | state slug |
| Tools | `/tools/:calc` *(new)* | calculator slug |
| Downloads | `/downloads/:resource` *(new)* | template slug |

Rules: **English slugs only** (established house rule); lowercase-kebab; stable (never change a live slug — 301 if you must); no dates/IDs in path except blog; short, keyword-bearing.

## 6. Schema strategy (JSON-LD)

| Page type | Schema | Notes |
| --- | --- | --- |
| Concept / blog article | `Article` / `BlogPosting` | author, datePublished, dateModified |
| How-to (help) | `HowTo` | steps, tools |
| FAQ / Q&A sections | `FAQPage` | PAA targeting |
| Software pages | `SoftwareApplication` | offers (free), category |
| Comparison | `Product` + `Review`/`AggregateRating` | only if real ratings (no fabrication) |
| Course/training | `Course` | guide + quizzes |
| All content | `BreadcrumbList` + `Organization` | sitewide |
| Calculators | `WebApplication` | — |

Rules: one primary type per page; `about`/`mentions`/`isPartOf` from graph edges; **never fabricate
ratings/reviews** — only emit `AggregateRating` from real feedback data (reviews table exists).

## 7. Metadata strategy

- **Title:** `{Primary keyword} — {benefit/qualifier} | SahakarLekha` (≤60 chars target). Hindi-first.
- **Meta description:** 140–160 chars, Hindi-first, includes the query + outcome (pattern already used in blog `metaDescription`).
- **No apostrophes** in single-quoted metadata strings (prerender-regex constraint — house rule).
- **OG/Twitter:** title, description, image (per-cluster social card), `summary_large_image`.
- **One H1** = the cluster title; logical H2/H3 = the query patterns.
- Field order in blog index entries: `slug, metaTitle, metaDescription, date` first (prerender regex requirement — keep it).

## 8. Canonical rules (critical — guide/blog/help/cookbook overlap)

A concept may render on several surfaces. To avoid self-cannibalization:
1. **One canonical owner per concept** = its `surface_canonical` in the graph (usually `/guide` for evergreen concepts; `/blog` for timely/opinion).
2. Supporting renderings (`/blog` explainer, `/help` task, `/cookbook` recipe) **link to** the canonical and target a *different intent* (do, recipe, news) — not the same query.
3. Self-referencing `<link rel=canonical>` on the owner; supporting pages canonical to **themselves** only if they hold distinct intent/value; otherwise canonical to the owner.
4. Programmatic `:state` / `:type` matrix pages: each must add a unique state/type fact or be `noindex` (thin-content guard).
5. Pagination/filtered blog views: canonical to the unfiltered index.

## 9. Content freshness strategy

| Content class | Review cadence | Trigger |
| --- | --- | --- |
| Statutory (GST/TDS/IT/returns) `⚠️` | each FY + on rule change | Budget, GST council, state act amend |
| Rates/deadlines | quarterly | due-date cycles |
| Compliance/seasonal | annual pre-season | drip calendar (live) |
| Evergreen concepts | 12–18 months | link rot, product change |
| Software/feature pages | on release | module changes |

- Show **"Last reviewed / validated by"** stamp (trust + freshness signal); update `dateModified`.
- **Auto-drip + daily rebuild already live** (blog `isPublished()` + GitHub Action → Vercel hook) — extend the same rebuild to refresh `dateModified` on reviewed pages.
- Maintain a **review queue** (front-matter `review_due` date) surfaced in the content engine ([11](11-content-engine.md)).

## 10. Technical SEO (already strong — keep)

- Prerendered static HTML for crawlers/social (`prerender-guide.mjs`), auto-generated `sitemap.xml` (147 URLs currently), `robots.txt`, SPA fallback excludes `/api`.
- Core Web Vitals: keep bundle lean, lazy-load, image dimensions set.
- Mobile-first (hero overflow fix already done); Hindi font rendering verified.
- `hreflang` only if/when an English locale ships (guide already has `/en`).

---

### Cross-references
[Knowledge Graph](06-knowledge-graph.md) · [Search Intent](04-search-intent.md) · [Content Engine](11-content-engine.md) · [Roadmap](14-roadmap.md)
