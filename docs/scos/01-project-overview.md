# 01 — Project Overview

> **SCOS = SahakarLekha Content Operating System.**
> The operating system behind thousands of future knowledge assets. Not a blog plan —
> an enterprise content engine engineered for 10 years of topical authority.

**Status:** Foundation v1.0 · **Owner:** Chief Knowledge Architect · **Last reviewed:** 2026-06-27
**Validation rule:** Every accounting/legal claim is marked `⚠️ NEV` (Needs Expert Validation) until a CA / cooperative auditor signs it off. We never guess, never fabricate treatments or provisions. See [13-authority-engine.md](13-authority-engine.md).

---

## 1. Mission

Make SahakarLekha **India's #1 knowledge platform for cooperative accounting** — the single place a PACS secretary, a society accountant, an auditor, or a chairman goes to *understand*, *do*, and *comply* — in their own language (Hindi-first), for free.

## 2. Vision

A living **knowledge graph** covering every accounting, audit, tax, compliance, governance, and digital-transformation question a cooperative society in India can have — each node connected to the **software module** that lets the user act on that knowledge immediately. Knowledge → Action → Compliance, in one loop.

## 3. Goals (measurable)

| Horizon | Goal |
| --- | --- |
| Authority | Rank top-3 for "सहकारी समिति लेखांकन / cooperative society accounting" and the long tail of how-to + compliance queries |
| Coverage | Every cluster in [03-topic-registry.md](03-topic-registry.md) has at least one canonical asset (article / tool / template) |
| Trust | 100% of accounting/legal assets carry source citations + an "expert-validated" badge |
| Conversion | Each cluster routes to a relevant **app module**, **lead magnet**, or **register CTA** |
| Freshness | Statutory content reviewed on the cadence in [07-seo-engine.md](07-seo-engine.md) (FY changes, GST/TDS, state acts) |
| Moat | Become the **citation source** others link to (templates, calculators, glossaries) |

## 4. Content Philosophy

1. **Hindi-first, plain Hinglish.** Everyday language, not "kitabi" Hindi (लाभ, not मुनाफ़ा). English fallback. (Governs all surfaces — ref. `writing-style-hinglish` house style.)
2. **Teach the job, not the jargon.** Every asset answers "what do I actually do?"
3. **Show, don't tell.** Dr/Cr tables, worked examples, real society scenarios.
4. **Action-linked.** Every concept links to the module that performs it (e.g. depreciation → `/depreciation-schedule`).
5. **Truthful or flagged.** Rates, sections, deadlines vary by state/year → cite the portal/act and mark `⚠️ NEV`; never invent.
6. **Systemic, not one-off.** Every page is a node in a cluster, not an orphan.

## 5. Publishing Philosophy

- **Authority over speed.** A validated, well-linked, evergreen page beats ten rushed ones.
- **Cluster-complete before breadth.** Finish a pillar's core nodes (the "10x" pages) before sprawling.
- **Seasonal drip for time-sensitive content** (FY close, AGM, GST/TDS due dates) — already live via the blog's `isPublished()` auto-drip + daily rebuild (see `marketing-growth-push` + [14-roadmap.md](14-roadmap.md)).
- **Update is publishing.** Refreshing a statutory page = a publishing event with its own QA.

## 6. Authority Strategy (E-E-A-T)

| Lever | How SCOS delivers it |
| --- | --- |
| **Experience** | Real society case studies, full-year worked examples (reuse `case-study-full-year` guide chapter) |
| **Expertise** | CA / cooperative-auditor validation badges; author bios; `⚠️ NEV` discipline |
| **Authoritativeness** | Cite Acts, Rules, NABARD, RBI, ICAI, Ministry of Cooperation; become the template/calculator source others link to |
| **Trust** | Transparent "last reviewed / validated by" stamps; no fabricated numbers; privacy-respecting lead capture |

## 7. Knowledge Graph Strategy

- Model the domain as **entities** (concepts, documents, registers, reports, society types, regulators) and **relations** (prerequisite-of, computed-from, reported-on, governed-by, performed-in-module). See [06-knowledge-graph.md](06-knowledge-graph.md).
- Every asset declares its **upstream prerequisites** and **downstream dependents** → powers internal linking, breadcrumbs, "related", and the `/ask` assistant's retrieval.
- The graph is the SSOT; pages are renderings of nodes.

## 8. Search Strategy

- Own the **3 intent layers**: learn (informational) → do (problem-solving / how-to) → comply (deadline/return) → adopt (software/commercial). See [04-search-intent.md](04-search-intent.md).
- **Surface routing:** match intent to the right existing surface —
  - *Concept/learning* → `/guide` (47 chapters) & `/blog`
  - *"How do I X in the app"* → `/help` task pages
  - *"Recipe / which voucher for Y"* → `/cookbook`
  - *Quick answers* → `/faq` + `/search` + `/ask`
  - *Buying / category* → `/software/:type`, `/cooperative-software/:state`
- Programmatic SEO via `:state` and `:type` landing pages, fed by the topic registry.

## 9. SEO Strategy (summary; full spec in [07-seo-engine.md](07-seo-engine.md))

Topic clusters → pillar pages → topical authority; disciplined internal linking; breadcrumb + URL hygiene; schema (Article, FAQ, HowTo, SoftwareApplication, BreadcrumbList); canonical rules across guide/blog/help/cookbook overlap; freshness cadence on statutory nodes.

## 10. Lead Generation Strategy (full spec in [08-lead-engine.md](08-lead-engine.md))

- **Lead magnets** (live: audit / GST / inventory checklists) → expand into the [09-template-library.md](09-template-library.md) and [10-calculators.md](10-calculators.md).
- **Topic-matched offers** (category → magnet mapping already in `leadMagnets.ts`).
- **Funnels:** magnet → welcome email (Resend) → nurture → demo/register.
- **Free tools/calculators** as top-of-funnel link magnets.

## 11. Product Strategy (content ↔ software loop)

The unfair advantage: **SahakarLekha already ships ~95 modules** (full accounting suite, members/shares, loans/KCC, inventory/MSP, GST/TDS, audit, governance/elections, NABARD/federation reports, multi-society). Every knowledge node maps to a module → content isn't marketing fluff, it's **documentation of a real product** that converts readers into users. Content proves the software; the software fulfills the content. See module map in [02-knowledge-architecture.md](02-knowledge-architecture.md) §Module Index.

---

### Cross-references
[Master Index](00-master-index.md) · [Knowledge Architecture](02-knowledge-architecture.md) · [Topic Registry](03-topic-registry.md) · [Personas](05-personas.md) · [Roadmap](14-roadmap.md)
