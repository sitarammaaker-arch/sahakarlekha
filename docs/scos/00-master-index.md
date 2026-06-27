# SCOS — Master Index

# SahakarLekha Content Operating System

> The operating system behind the next 10 years of SahakarLekha content. Not a blog plan — an
> enterprise content engine that turns a **knowledge graph** into **topical authority**, **leads**,
> and **product activation**, in a Hindi-first, expert-validated way.
>
> **Version:** Foundation v1.0 · **Created:** 2026-06-27 · **Owner:** Chief Knowledge Architect
> **Prime directives:** *Authority over speed. Systems over pages. Never guess — `⚠️ NEV` until a
> CA/auditor validates.*

---

## How to read this (the 4 layers)

```
WHY/WHAT   →  01 Overview · 02 Knowledge Architecture
INVENTORY  →  03 Topic Registry (386 clusters) · 09 Templates · 10 Calculators
TARGETING  →  04 Search Intent · 05 Personas · 06 Knowledge Graph
EXECUTION  →  07 SEO · 08 Lead Engine · 11 Content Engine · 12 Blueprint · 13 Authority · 14 Roadmap
```

## The files

| # | File | What it gives you |
| --- | --- | --- |
| 00 | **[Master Index](00-master-index.md)** | this map |
| 01 | [Project Overview](01-project-overview.md) | mission, vision, goals, all 11 strategies |
| 02 | [Knowledge Architecture](02-knowledge-architecture.md) | 16 pillars, 3-plane model, **Module Index** (content↔product) |
| 03 | [Topic Registry](03-topic-registry.md) | **386 content clusters** (C001–C386) across 26 domains |
| 04 | [Search Intent Engine](04-search-intent.md) | 12 intent lenses, intent→surface routing, query patterns |
| 05 | [Persona Engine](05-personas.md) | 8 personas (SEC/ACC/AUD/CHR/MGR/MEM/EMP/BUY) |
| 06 | [Knowledge Graph](06-knowledge-graph.md) | node/edge model, the accounting spine, linking rules |
| 07 | [SEO Engine](07-seo-engine.md) | clusters, internal links, URLs, schema, canonical, freshness |
| 08 | [Lead Engine](08-lead-engine.md) | magnets, funnels, tools, newsletter, measurement |
| 09 | [Template Library](09-template-library.md) | every downloadable, mapped to its module |
| 10 | [Calculator Library](10-calculators.md) | every calculator, mapped to formula + module |
| 11 | [Content Engine](11-content-engine.md) | 9-stage pipeline + gates + cluster-spec |
| 12 | [Article Blueprint](12-article-blueprint.md) | standard structures per asset type |
| 13 | [Authority Engine](13-authority-engine.md) | source categories + citation discipline |
| 14 | [Roadmap](14-roadmap.md) | 30d / 90d / 6m / 1y / 2y |

## How the system fits together (data flow)

```
02 Architecture defines pillars & surfaces
   └─ 03 Registry enumerates clusters (the inventory)
        ├─ 04 Intent says which assets/surfaces each cluster needs
        ├─ 05 Personas say who & what depth
        ├─ 06 Graph says how everything links (SSOT for relationships)
        │     ├─ 07 SEO renders graph → links/breadcrumbs/schema/canonical
        │     ├─ 08 Leads attach magnets per cluster
        │     ├─ 09/10 Templates & Calculators per cluster
        │     └─ 13 Authority validates every ⚠️ claim
        └─ 11 Content Engine runs each cluster through gates → 12 Blueprint structures it
             └─ 14 Roadmap sequences what gets built when
```
**One object threads it all:** the **cluster-spec front-matter** ([11 §2](11-content-engine.md)) — written once,
read by the graph, SEO, lead, and authority engines. *One source, many renderings.*

## Grounded in the real product (anti-duplication)

The SCOS is built **on top of** what already ships — it orchestrates, never duplicates:
- **Content surfaces:** `/guide` (47 chapters), `/blog` (~30, drip), `/help`, `/cookbook`, `/faq`, `/search`, `/ask`.
- **~95 app modules** = the action endpoints every knowledge node converts to ([02 §Module Index](02-knowledge-architecture.md)).
- **Live growth stack:** auto-drip + daily rebuild + auto sitemap; 3 lead magnets + EmailCapture + Resend + GA4 + leads/reviews.
- **Programmatic SEO scaffolding:** `/software/:type`, `/cooperative-software/:state`.

> Before creating any asset: **search existing surfaces first**; extend the canonical or build a
> different-intent supporting page — never a duplicate ([11 §6](11-content-engine.md), [07 §8](07-seo-engine.md)).

## Operating rules (the SCOS constitution)

1. **Never guess; never fabricate** treatments/provisions/rates. `⚠️ NEV` until validated.
2. **Hindi-first, everyday Hinglish** (लाभ, not मुनाफ़ा). English fallback.
3. **Every node links** up/down/sideways + to its **module** + to its **authority**. No orphans, ≤3 hops.
4. **One canonical per concept;** supporting pages target different intent.
5. **Authority over speed; cluster-complete over scattered; reuse over rebuild.**
6. **Freshness is publishing:** statutory pages carry `review_due` + a "validated by/on" stamp.
7. **Content proves the product; the product fulfills the content.**

## Immediate next actions (from [14](14-roadmap.md) · 30-day)

1. Ratify SCOS; add cluster-spec fields to the index registries.
2. Assign the CA/auditor validator (unblocks all statutory content).
3. Complete & link the **accounting spine** + 6 pillar hubs (upgrade existing guide chapters).
4. Add the link-validator to `prerender-guide.mjs`; ship the Vercel Deploy-Hook setup.

---

*This index links every file. Each file ends with its own cross-references. Start at
[01-project-overview.md](01-project-overview.md), or jump to [03-topic-registry.md](03-topic-registry.md)
to see the 386 clusters this system will build.*
