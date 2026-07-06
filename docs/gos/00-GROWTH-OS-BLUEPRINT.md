# GOS — Growth Operating System Blueprint v1.0

**Date:** 2026-07-06 · **Status:** AWAITING APPROVAL — no implementation yet
**Scope:** sahakarlekha.com organic growth — indexability, authority, conversion, measurement
**Relates to:** SCOS (content OS), SMRD (research), KAE/KPP (knowledge), KDI (delivery), CONSTITUTION.md

This document is the SSOT for growth work. Nothing in it is implemented until the
owner approves the specific workstream. Every item follows the mandatory workflow:
inspect → explain → evidence → impact → plan → approval → implement → test → verify
→ before/after report.

---

## PART A — DIAGNOSIS: WHY 197 PAGES ARE "DISCOVERED — NOT INDEXED"

### The numbers line up exactly

| GSC bucket | Count | Our inventory |
|---|---|---|
| Indexed | ~77 | ≈ the pre-June-27 site (guide 29+quizzes, blog ~30 early, software 9, states 1, meta pages) |
| Discovered, not indexed | ~197 | ≈ the June-27 content explosion: 100 glossary + 10 calculators + 20 help + 45 cookbook + 20 authority articles — all shipped **in one week** |
| Crawled, not indexed | ~6 | quality-judgment rejects (likely thinnest glossary/hub pages) |
| **Total known** | **~280** | ≈ 258 prerendered pages + non-prerendered publics (/pricing, /faq, /ask, /search) |

**Conclusion: this is not a technical error. Google discovered everything (the
sitemap works). It is choosing not to crawl/index ~70% of the site.** For a
~3-month-old domain, "Discovered — currently not indexed" means Google's quality
predictor says: *"new domain, sudden 4× content spike, pages whose HTML body is
empty until I spend render budget, every URL claims it changed today, and I have
few external signals that this site matters — I'll wait."*

### Root causes (ranked by contribution)

**RC-1 — Empty-body prerendering.** `scripts/prerender-guide.mjs` writes perfect
`<head>` tags (title/description/canonical/OG/JSON-LD) but the `<body>` is
`<div id="root"></div>`. Google must schedule a JS render to see ANY content.
For low-authority domains, render-queue priority is exactly what gets rationed.
The 77 indexed pages are the ones Google bothered to render. *(Evidence:
prerender-guide.mjs transform() — head-only substitution; dist/*/index.html
bodies are empty.)*

**RC-2 — lastmod churn destroys freshness trust.** `buildSitemap()` stamps
**every URL** with the build date (`prerender-guide.mjs:340`), and
`.github/workflows/scheduled-rebuild.yml` rebuilds **daily** at 03:30 UTC. So all
~280 URLs claim "modified today", every day. Google learns the lastmod is noise
and discounts the entire sitemap's crawl hints.

**RC-3 — Content velocity vs. domain authority.** ~200 pages shipped within days
(June 27 sprints) on a domain with near-zero backlinks. Google throttles
indexation of sudden spikes on unproven domains regardless of on-page quality.
No on-site fix removes this constraint — only external authority signals
(links, brand searches, engagement) and time do.

**RC-4 — Thin-page cohort.** ~100 glossary terms render 50–200 words of the KI
file. The KI files contain far more (misconceptions, FAQs, learning objectives,
related concepts) but not all of it reaches the page/prerender. 100 similar-
template short pages = a "low value-add" cohort in Google's eyes that drags the
whole domain's quality prior down.

**RC-5 — Soft 404s.** The SPA fallback rewrite (`vercel.json:289-294`) returns
HTTP 200 + homepage head for ANY unknown URL. NotFound renders visually but the
status is 200 and there is no `noindex`. This pollutes crawl signals.

**RC-6 — Single flat sitemap.** One sitemap.xml means GSC coverage problems can't
be localized per content type — we're flying blind on WHICH surface is being
refused.

### What is already excellent (do not touch)

- Prerender pipeline architecture (single-source-of-truth registries → static head + sitemap).
- Clean URLs, 57 permanent 301s, apex canonicalization, robots.txt hygiene.
- Schema coverage breadth (SoftwareApplication, Organization, FAQPage, Article,
  BlogPosting, DefinedTerm, WebApplication, HowTo, Course, BreadcrumbList).
- Route-level code splitting (148 lazy routes), vendor chunking, font strategy.
- Fat footer, hub pages linking all children, visible breadcrumbs everywhere.
- SCOS/SMRD/KPP: the topical-authority map (Phase 10 of the mission) already
  exists as 386 registered clusters — it needs execution, not re-planning.

---

## PART B — THE WORKSTREAMS

Priority scale: **P0** = unblocks indexation (this is THE problem) · **P1** =
authority & conversion · **P2** = measurement & automation · **P3** = expansion.
Effort in focused dev-days. Traffic estimates are directional, not promises.

---

### P0 — INDEXATION UNBLOCK (target: week 1–2)

#### GOS-01 · Full-body prerendering ⭐ highest-leverage single change
- **Problem:** Crawlers see an empty `<div id="root">` (RC-1).
- **Root cause:** prerender script substitutes head tags only.
- **Business impact:** ~200 pages stuck pre-render-queue; the entire knowledge
  moat is invisible without JS execution.
- **Solution:** Extend `prerender-guide.mjs` to inject a static HTML body
  (rendered from the same markdown/registry sources it already reads: blog .md,
  guide .md via manifest, KI .md, cookbook/help/calculator registries) inside
  `#root`. Semantic HTML: `<h1>`, article body, breadcrumb nav, internal links,
  footer links. React replaces it on load (no hydration — `createRoot` render,
  brief repaint acceptable; content identical so no UX/SEO mismatch). Fail-soft
  like today.
- **Expected SEO gain:** Indexable content without render budget → the single
  biggest driver to move the 197. Also fixes WhatsApp/social preview body text.
- **Expected traffic gain:** Indexed pages 77 → 200+ over 4–8 weeks (combined
  with GOS-02/03); impressions 2–4×.
- **Risk:** MEDIUM — markdown→HTML rendering at build must match live render
  closely enough (Google tolerates differences; identical text is what matters).
  Content flash on slow connections. Mitigation: reuse the same marked/remark
  pipeline the app uses; verify 5 page types in preview + Rich Results Test.
- **Effort:** 1.5–2 days.

#### GOS-02 · Honest lastmod + sitemap index (8 segmented sitemaps)
- **Problem:** RC-2 (lastmod = build date daily) + RC-6 (flat sitemap).
- **Solution:** (a) lastmod from real content dates — blog `date`/updated field,
  guide manifest date, KI file git-mtime, registry-declared `updated` for
  help/cookbook/calculators; hub pages = max(children). (b) Replace flat
  sitemap with `sitemap.xml` (index) → `sitemap-pages.xml`, `-blog.xml`,
  `-guide.xml`, `-glossary.xml`, `-tools.xml`, `-help.xml`, `-cookbook.xml`,
  `-software.xml` (software+states). Same generator, same sources. Resubmit the
  index in GSC; old sitemap URL 301s or stays as the index file itself.
- **Impact:** Restores freshness trust; per-surface index coverage becomes
  visible in GSC (we finally learn WHICH surface Google is refusing).
- **SEO gain:** Crawl-efficiency + diagnostic capability. **Risk:** LOW.
- **Effort:** 0.5–1 day.

#### GOS-03 · Glossary enrichment (fix the thin cohort)
- **Problem:** RC-4 — ~100 pages at 50–200 visible words.
- **Solution:** No new content fabrication. Surface EVERYTHING already in the KI
  files onto the page + prerender: plain-Hindi explanation, why-it-matters,
  misconceptions, FAQ (with FAQPage JSON-LD where genuine), learning objectives,
  related concepts, module links — target 350–600 words of real content per
  term. Add the missing glossary→blog edge (GOS-11). Terms that still end up
  <150 words: keep live but move to a "definitions" section of sitemap-glossary
  with lower priority (do NOT noindex yet — re-evaluate after 8 weeks).
- **Impact:** Removes the low-quality cohort dragging the domain prior.
- **Risk:** LOW (content already exists in KI files; KI = SSOT preserved).
- **Effort:** 1 day (adapter + page template + prerender body).

#### GOS-04 · Soft-404 + noindex hardening
- **Problem:** RC-5 — unknown URLs return 200; app routes have no noindex.
- **Solution:** (a) `<meta name="robots" content="noindex">` set at runtime by
  NotFound and by ProtectedRoute wrapper. (b) `X-Robots-Tag: noindex` headers in
  vercel.json for `/dashboard`, `/vouchers`, `/members`, `/reports`, and other
  app prefixes. (c) Investigate scoping the SPA fallback so unknown paths hit a
  real 404 (Vercel serves prerendered static files first; only app-route
  prefixes need the rewrite) — implement only if the prefix list is provably
  complete, else keep (a)+(b).
- **Impact:** Stops crawl-signal pollution; defense-in-depth for app routes.
- **Risk:** LOW for (a)/(b); MEDIUM for (c) — a missed prefix would 404 a real
  app route (test:nav must cover it).
- **Effort:** 0.5 day for (a)+(b); +0.5 day if (c) proves safe.

#### GOS-05 · Prerender the last static publics + daily-rebuild guard
- **Problem:** `/pricing` and `/faq` are static but not prerendered; the daily
  scheduled rebuild redeploys even when nothing changed (contributes to RC-2).
- **Solution:** Add pricing/faq to the prerenderer. Change scheduled-rebuild to
  skip deploy when no scheduled post crosses its publish date that day (the
  workflow can check the blog registry before firing the hook).
- **Risk:** LOW. **Effort:** 0.5 day.

#### GOS-06 · Manual GSC sprint (owner + assisted)
- Submit the new sitemap index; Request Indexing for the ~30 highest-value URLs
  (money pages: /, /software/*, top blog, /tools/*, /guide hubs); run Rich
  Results Test on one page per schema type; verify Vercel primary-domain is set
  so www→apex is 308 (pending item from 2026-06-20).
- **Effort:** 2–3 hours, mostly owner-side clicks. **Risk:** none.

**P0 total: ~4–5 dev days. Success metric: GSC "Discovered — not indexed" trending
down and Indexed >150 within 6–8 weeks. (Indexation latency is Google-side; the
on-site causes are fully removed by P0.)**

---

### P1 — AUTHORITY, KNOWLEDGE GRAPH & CONVERSION (weeks 2–4)

#### GOS-10 · Entity & trust schema
- Organization schema upgraded sitewide: `sameAs` [X, YouTube, WhatsApp channel],
  `logo`, `contactPoint`; `WebSite` + `SearchAction` (real /search exists);
  `Course` schema on /guide hub. Effort: 0.5 day. Risk: LOW.

#### GOS-11 · Close the knowledge-graph edges (Phase 3 of mission)
- **Missing edges found:** blog→help, glossary→blog, help↔cookbook,
  calculator→cookbook, software/state→guide/blog/help, features page not public.
- **Solution:** ONE central related-content resolver (`src/content/relatedContent.ts`)
  extending the existing `crossLinks.ts` pattern — declarative pairs, rendered by
  each surface's existing "related" section. Public `/features` page (SEO-visible
  product-module descriptions, deep-linking to help tasks + register). No page is
  a silo; every page ≤3 hops from every other (SCOS rule 3).
- **SEO gain:** Internal PageRank flow to the not-indexed cohort — directly
  supports P0. **Conversion gain:** blog readers reach task-level pages (help)
  that carry `/register?next=` deep links.
- **Risk:** LOW. **Effort:** 1.5–2 days.

#### GOS-12 · CTA coverage completion
- Add register CTAs where missing: glossary term pages, FAQ, blog index, guide
  hub ("certificate" framing), calculator hub. Reuse one CTA component; all
  clicks tracked (`cta_click` exists). Effort: 0.5 day. Risk: LOW.

#### GOS-13 · E-E-A-T program (partly owner-dependent)
- Author entity: an /about page team section + `author` Person/Organization with
  consistent identity on every article. "समीक्षा: CA द्वारा" (reviewed-by) marker
  ONLY when a real SME signs off — this is the same SME gap SMRD flagged; do NOT
  fabricate (NEV rule). Testimonials: component exists, array is EMPTY — needs
  3–5 real consented quotes from users (owner asset). Real quotes get Review
  schema.
- **Impact:** E-E-A-T is a direct input to Google's quality prior (RC-3).
- **Effort:** 0.5 day code; testimonials/SME = owner outreach.

#### GOS-14 · Off-site authority sprint (owner-led, assisted with targets/copy)
- The honest constraint: **RC-3 cannot be fixed on-site.** Needed: listings and
  links from cooperative-sector surfaces (state RCS resource pages, federation
  sites, NABARD-adjacent directories, software directories — G2/Capterra/
  SoftwareSuggest/AlternativeTo), YouTube channel activation (assets exist),
  X drip, WhatsApp channel growth, guest posts in Hindi finance/co-op media.
  Deliverable from me: a target list + outreach copy + trackable UTM scheme.
- **Impact:** This is the rate-limiter on everything else. **Effort:** 0.5 day
  to produce the kit; execution is ongoing owner work.

**P1 total: ~4–5 dev days + owner outreach.**

---

### P2 — MEASUREMENT, INTELLIGENCE & AUTOMATION (weeks 3–5)

#### GOS-20 · Complete the GA4 funnel (Phase 8 of mission)
- **Missing critical events (evidence: zero trackEvent in these paths):**
  `sign_up` (Register.tsx success), `login` (Login.tsx), `certificate_earned`,
  `quiz_passed`, `calculator_used` (CalculatorShell submit), `pdf_download`
  (all app report exports + sample report), `whatsapp_click` (socials.tsx),
  `guide_chapter_read`, `sample_report_generated`. Mark `sign_up` +
  `lead_magnet_download` + `email_signup` as GA4 key events (conversions).
- **Impact:** Without `sign_up` tracking we literally cannot measure the
  mission's #1 KPI (organic → signup). **Risk:** LOW. **Effort:** 1 day.

#### GOS-21 · Web Vitals + error visibility
- `web-vitals` package → GA4 events (LCP/CLS/INP with page_path); global
  `error`/`unhandledrejection` listeners → GA4 exception events (Sentry optional
  later — start free). Convert hero-dashboard.png (275KB) + guide-shots to WebP
  with `fetchpriority="high"` on the LCP image. Effort: 1 day. Risk: LOW.

#### GOS-22 · Search Console intelligence loop (Phase 2+5 of mission)
- **Pragmatic version, no over-build:** a `scripts/seo-report.mjs` that ingests
  GSC bulk-export CSVs (or API with a service account when owner sets one up)
  + the build's own page inventory + internal-link graph → outputs an
  **Indexability Priority Queue** (per page: GSC status, clicks, impressions,
  position, CTR vs. expected, internal links in/out, word count, lastmod) as a
  markdown report in `docs/gos/reports/`. Weekly cadence via the existing
  GitHub Action. Flags: pages to Request-Indexing, titles/CTR underperformers,
  orphan-ish pages, decaying content.
- **Impact:** Turns GSC from a dashboard you look at into a queue you act on.
- **Risk:** LOW (read-only). **Effort:** 1.5 days (CSV mode) — API mode +0.5.

#### GOS-23 · Indexing pings + CI guards
- IndexNow ping on deploy (Bing/Yandex — honest note: Google ignores IndexNow;
  for Google the segmented sitemaps + GSC are the channel). CI additions:
  internal-link checker over prerendered dist (all `<a href>` resolve to a
  prerendered page or known route), JSON-LD validation (structured-data lint)
  — extends the existing test:nav/validate:glossary pattern. Fail-soft warnings.
- **Effort:** 1 day. **Risk:** LOW.

**P2 total: ~4–5 dev days.**

---

### P3 — TOPICAL EXPANSION (months 2–6, gated on P0 results)

#### GOS-30 · State-page rollout (35 remaining states/UTs)
- The pattern is proven (Haryana). Verified-facts-only per SMRD file 07 (all 36
  jurisdictions have research stubs, all `open`). Batch of 5–8 states/month, each
  needing verified Act/Registrar/apex-body facts. **Do not fabricate** state law
  — this is the NEV rule. Each state page links to relevant guide/blog (GOS-11
  edges). Expansion waits until P0 shows Google is indexing what we already have
  (publishing 35 more pages into a throttled domain repeats RC-3).

#### GOS-31 · Cluster execution from SCOS registry
- Phase 10 of the mission ("top 500 keywords → cluster → map → prioritize") is
  ALREADY BUILT: SCOS 03-topic-registry has 386 clusters with priority/persona/
  module columns; SMRD 04 holds the honest "search metrics = Research Required"
  rule. Execution = pick clusters by SCOS priority, publish via the existing
  blog/guide/calculator machinery, at a SUSTAINABLE cadence (1–2/week, the drip
  system already does this). Level-A (educational) proceeds now; B/C/D remain
  SME-gated.

#### GOS-32 · Language strategy decision (needs owner call, no code yet)
- Guide has en/ variants at the same URL (runtime toggle) — no hreflang, no
  separate URLs. Options: (a) stay Hindi-first single-index (fine, current), or
  (b) real `/en/` URLs + hreflang pairs for high-intent pages (doubles surface,
  doubles maintenance). Recommendation: defer until Hindi indexation is healthy;
  then pilot English on /software/* only (highest commercial intent).

#### GOS-33 · New lead magnets + video
- Chart-of-Accounts XLSX + Demo-Society PDF (already produced as files in repo
  root!) become gated downloads via the existing EmailCapture; YouTube embeds on
  guide/software pages when videos exist (owner asset).

---

## PART C — WHAT I WILL *NOT* DO (guardrails)

1. No content fabrication — legal/tax/state facts stay NEV-gated (SMRD).
2. No fake E-E-A-T — no invented testimonials, authors, or "CA reviewed" badges.
3. No doorway-page spam — state/type pages only with genuinely unique verified content.
4. No Google Indexing API misuse (it is officially only for JobPosting/
   BroadcastEvent; using it for regular pages violates guidelines).
5. No mass Request-Indexing scripts against private GSC endpoints.
6. No architecture rewrites (SSR/Next migration NOT needed — the prerender
   pipeline + body injection achieves the crawler outcome at ~2% of the cost).
7. Nothing ships without: build passing, preview verification, before/after
   evidence, and explicit approval per workstream.

## PART D — MEASUREMENT PLAN (before/after per phase)

| Metric | Baseline (2026-07-06) | P0 target (8 wks) | 6-mo target |
|---|---|---|---|
| GSC Indexed pages | ~77 | 150–220 | 280+ (incl. new states) |
| Discovered-not-indexed | ~197 | <80 | <30 |
| Organic clicks/mo | (record from GSC at kickoff) | 2–3× | 8–15× |
| Organic → sign_up | unmeasurable today | measured + baseline | 3–5% of organic sessions |
| Avg position (money queries) | ~page 1 partial | top-5 for brand+niche | #1–3 for "सहकारी समिति लेखा सॉफ्टवेयर" family |
| CWV (LCP mobile) | unmeasured | measured, LCP <2.5s | maintained |

Weekly artifact: `docs/gos/reports/YYYY-WW.md` from GOS-22.

## PART E — SEQUENCE & APPROVAL CHECKPOINTS

```
Week 1-2  P0  GOS-01..06   → checkpoint: GSC resubmitted, evidence report
Week 2-4  P1  GOS-10..14   → checkpoint: linking matrix complete, CTA report
Week 3-5  P2  GOS-20..23   → checkpoint: funnel dashboard live in GA4
Month 2+  P3  GOS-30..33   → gated on P0 indexation evidence
```

Each GOS item gets its own mini-plan + approval before code is touched.
