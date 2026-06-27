# Phase 8 — Implementation Roadmap

> The sequenced plan to connect the 50 **active** KIs to the product. **Implementation only — no new
> architecture.** Every task links to an existing **KI**, **SCOS** surface, **SMRD** research, and **KAE**
> mechanism. Ordered by ROI ([content-gap-audit §rollup](content-gap-audit.md)).

**Each task cites:** KI ids · SCOS surface/route · SMRD research · KAE mechanism. **Effort:** S/M/L.

---

## Week 1 — Glossary (highest leverage)
**Goal: one build surfaces ~42 KIs + powers search synonyms + tooltips.**
- [ ] Build a **KI-driven glossary** page/section rendering active term KIs. **Effort:** M
  - KI: all glossary-eligible (KI-000001,004,025–040,055,079,080,099–101,113,114,131,153,157,158, …)
  - SCOS: `/guide` glossary surface + [04 search-intent](../scos/04-search-intent.md); KAE: definitions from KI (single source) + `EV-` citation; SMRD: C-cluster backing.
- [ ] Canonicalize: point guide `glossary.md` / `account-name-glossary.md` at the KI glossary ([SCOS 07 canonical](../scos/07-seo-engine.md)). **Effort:** S
- [ ] Emit glossary terms into `siteSearch` synonym index ([search-experience §8](search-experience.md)). **Effort:** S

## Week 2 — In-module context help (daily-use moments)
**Goal: knowledge at point of need on the most-used screens.**
- [ ] /vouchers: empty-state + Dr/Cr tooltips → KI-000055, 000026, 000027, 000028, 000047. **Effort:** M
- [ ] /ledger-heads + /ledger: account/ledger help → KI-000033, 000079, 000080. **Effort:** S
- [ ] /cash-book + /bank-book: empty-state explainers → KI-000101, 000099, 000113, 000114. **Effort:** S
- [ ] /reports + /balance-sheet + /profit-loss: "read this report" popover + report-notes → KI-000212, 000034/35/36, 000040, 000037/38. **Effort:** M
  - KAE: context-help text generated from KI ([KAE 11](../kae/11-ai-knowledge-api.md)); no module redesign (help slots only).

## Week 3 — FAQ + CTAs (conversion)
**Goal: answer top questions from KIs and route to register/module.**
- [ ] Generate **~19 FAQ entries** from KIs into `/faq` → KI-000001,002,021,029,040,055,079,101,116,118,131,153,303,305,306,322,325,341,212. **Effort:** M
- [ ] Add **register/module CTA** to FAQ answers (free/backup/digital → /register) → KI-000341,000306,000322,000303. **Effort:** S
- [ ] Append KI `related_module` CTA to Ask-AI answers. **Effort:** S
  - SCOS: `/faq` FAQPage schema ([07](../scos/07-seo-engine.md)); SMRD: C190/C193/C184 research.

## Week 4 — Onboarding + Ask-AI grounding
**Goal: new-user journey + grounded assistant.**
- [ ] Society-setup wizard per-step help → KI-000305, 000009, 000050. **Effort:** M
- [ ] Onboarding checklist/email from KI-000325 (reuse Resend) → KI-000325, 000305. **Effort:** S
- [ ] Wire the **50 active KIs as the `/ask` corpus** ([ask-ai-map](ask-ai-map.md)); answer Level-A, hedge B/C/D. **Effort:** M
  - KAE: AI API contract ([11](../kae/11-ai-knowledge-api.md)) + jurisdiction rule ([05](../kae/05-jurisdiction-engine.md)).

## Month 2 — Search experience + internal links
- [ ] Full search: autocomplete, related searches, filters, did-you-mean, mixed-script ([search-experience](search-experience.md)). **Effort:** M
- [ ] Internal links: guide chapters → glossary KIs; modules → concept KI/guide; cookbook → concept KI. **Effort:** M
- [ ] Homepage/landing knowledge sections → KI-000303, 000322, 000341, 000001. **Effort:** S

## Month 3 — Downloads + journeys + measurement
- [ ] Produce Level-A 1-pager downloads (Dr-Cr cheat sheet, equation, society-types, getting-started) → gated capture ([SCOS 08](../scos/08-lead-engine.md)). **Effort:** M
- [ ] Wire persona journeys ([knowledge-user-journeys](knowledge-user-journeys.md)) into nav/help. **Effort:** M
- [ ] Add GA4 events: glossary view, tooltip open, FAQ→register, ask-answer-cited, search-suggest. **Effort:** S
  - Feeds the [dashboard](knowledge-delivery-dashboard.md) utilization metrics.

## Month 6 — Scale & next activation
- [ ] Measure utilization; refresh popular-searches with real GA/Search-Console data (replace "Research Required").
- [ ] **Activate next Level-A wave** (remaining ~160 KIs) and repeat KDI mapping for them (separate KPP step — not done here).
- [ ] On SME engagement: activate Wave-1 **B** KIs → unlock calculators/treatment context help (new destinations open).

---

## Roadmap principles
1. **Glossary first** — one build, ~42 KIs surfaced; everything else compounds on it.
2. **Reuse, never rebuild** — glossary/search/FAQ/help slots already exist; we feed them KIs.
3. **One source of truth** — every surfaced definition is generated from the KI ([KAE 11](../kae/11-ai-knowledge-api.md)).
4. **No new architecture** — no new docs layer, schema, or framework; only wiring.
5. **Stay in scope** — only the 50 active KIs; B/C/D wait for activation/SME.

### Cross-references
[Content Gap Audit](content-gap-audit.md) · [Product Integration](product-integration.md) · [Dashboard](knowledge-delivery-dashboard.md) · [SCOS Roadmap](../scos/14-roadmap.md) · [KPP active KIs](../kpp/wave-1-active/00-index.md)
