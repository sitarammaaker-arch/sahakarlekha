# 14 — Roadmap

> A realistic build sequence for the SCOS. Sequenced by **authority leverage**: complete the
> money-path clusters and the infrastructure that compounds, before breadth. Reuses everything
> already live (47 guide chapters, ~30 blog posts, help/cookbook, drip + rebuild, 3 magnets, ~95 modules).

**Principle:** *cluster-complete before broad; validated before published; infrastructure before scale.*

---

## Now (baseline — already shipped)
- 47 guide chapters, ~30 blog articles (12 live + 18 scheduled drip), help tasks, cookbook, FAQ, `/ask`, `/search`.
- Auto-drip (`isPublished`) + daily GitHub Action → Vercel rebuild; auto sitemap.
- 3 lead magnets + EmailCapture + Resend welcome + GA4 + leads table; feedback/reviews system.
- ~95 app modules; software/state landing scaffolding.
- **Pending one-time:** Vercel Deploy Hook → GitHub secret `VERCEL_DEPLOY_HOOK` (drip SEO refresh).

## 30 Days — Foundation & spine
**Goal: SCOS adopted as the operating system; money-path clusters complete.**
- [ ] Ratify SCOS; wire cluster-spec front-matter into the existing index registries.
- [ ] Stand up the **review queue** + content board (Select→Draft→NEV→SEO→Published→Review-due).
- [ ] Recruit/assign the **CA/auditor validator** (gate 5) — without this, statutory content stalls.
- [ ] Complete the **accounting spine** as cluster-complete canonicals ([06 §3](06-knowledge-graph.md)): COA, opening balances, voucher types, trial balance, final accounts ×4, depreciation, year-end. (Most exist in `/guide` — upgrade to blueprint + links + magnet, don't duplicate.)
- [ ] Pillar pages for the top 6 domains (D01–D06) as hubs.
- [ ] Internal-link validator in `prerender-guide.mjs` (no-orphan, ≤3-hop).
- [ ] Ship the Deploy-Hook setup.
**KPIs:** spine 100% linked & validated; 6 pillar hubs live; 0 orphan published nodes.

## 90 Days — Authority in core pillars
**Goal: topical authority in Accounting, Audit, Tax, Compliance, Loans.**
- [ ] Complete P0/P1 clusters in D03–D08, D14–D17 (validated).
- [ ] Launch **calculators v1** (depreciation, GST, TDS, interest/EMI, NPA) at `/tools/:calc` — wrap existing module logic.
- [ ] Launch **`/downloads` hub** + 8–10 templates (gated) from [09](09-template-library.md) (validated formats).
- [ ] Society-type overlays (D27) for the top 4 types (PACS, dairy, consumer, credit).
- [ ] Schema rollout: Article/HowTo/FAQ/Breadcrumb/SoftwareApplication across surfaces.
- [ ] Nurture email tracks v1 (SEC, ACC).
**KPIs:** 60+ validated clusters live; 5 calculators; 10 templates; rising impressions on core queries.

## 6 Months — Breadth, programmatic SEO, lead engine
**Goal: cover the long tail; turn traffic into registrations.**
- [ ] Clusters across all 26 domains' P0/P1 (target ~150 published).
- [ ] **Programmatic landings** (D28): 8 priority states × top 3 society types — each with a real state/type fact (thin-content guard).
- [ ] Calculators v2 + 20+ templates; society-type COA packs (×12).
- [ ] Full lead funnels (all persona tracks) + newsletter ("सहकारी अपडेट").
- [ ] `/ask` upgraded to graph-aware retrieval over published nodes.
- [ ] First **case studies** (full-year, per society type) — reuse `case-study-full-year`.
- [ ] Author bios + validation badges sitewide (E-E-A-T).
**KPIs:** 150 clusters; 20 states/type pages indexed; lead capture rate target; registrations trending up.

## 1 Year — #1 knowledge platform (core)
**Goal: rank top-3 for cooperative-accounting head + long-tail; become a citation source.**
- [ ] Registry ~250 clusters published & validated; freshness queue running.
- [ ] All 12 society types + 15+ states covered; full template/calculator libraries.
- [ ] Video tutorials per core module (D26 C230); training paths + certification promoted.
- [ ] Backlink/authority push: glossary, templates, and calculators marketed as reference assets.
- [ ] Quarterly statutory re-validation cycle institutionalized.
**KPIs:** top-3 for primary head terms; meaningful share of organic registrations; external citations to SCOS assets.

## 2 Years — Moat & expansion
**Goal: unassailable authority + new surfaces.**
- [ ] Full ~386-cluster registry (incl. D27–D30 matrices) — published or generated.
- [ ] English locale (reuse `/guide/en`) for broader reach; consider regional languages.
- [ ] AI layer matured (D23): assistant, anomaly flags, document capture — each `⚠️ NEV` for compliance claims.
- [ ] Community/UGC (member Q&A) with moderation; expert webinars.
- [ ] SCOS as a **content data platform**: the graph powers app help, `/ask`, and partner/federation portals.
**KPIs:** category-defining authority; SCOS cited by federations/training institutes; durable organic moat.

---

## Sequencing rules (apply throughout)
1. **Validated > fast.** Never publish unvalidated statutory specifics to hit a date.
2. **Cluster-complete > scattered.** Finish a pillar's spine before its tail.
3. **Reuse > rebuild.** Upgrade existing guide/blog/help assets into the blueprint; wrap module logic into tools.
4. **Generate the matrices, guard the thin content.** D27–D30 are generated from the spine, each with a real delta.
5. **Measure → refresh.** Decaying/outdated pages re-enter the pipeline at stage 9.

---

### Cross-references
[Project Overview](01-project-overview.md) · [Topic Registry](03-topic-registry.md) · [Content Engine](11-content-engine.md) · [Master Index](00-master-index.md)
