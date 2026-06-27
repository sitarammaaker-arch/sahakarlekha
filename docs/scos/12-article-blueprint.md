# 12 — Article Blueprint

> The standard structure every asset follows. **This file defines structure — it does NOT write
> articles.** Blueprints differ by asset type; all share the non-negotiables in §1.

---

## 1. Non-negotiables (every asset)

1. **One H1** = the cluster title (Hindi-first, keyword-bearing).
2. **Persona-led opener** (1–2 lines): name the reader's job-to-be-done, in everyday Hinglish.
3. **Answer fast** (snippet target): the core definition/answer in the first 2–3 lines.
4. **Worked example + Dr/Cr table** wherever accounting is involved.
5. **Callouts:** 💡 tip · ⚠️ caution / `NEV` · 🔍 deeper note · ✅ CTA.
6. **Internal links:** up (pillar + prerequisite), down (children), sideways (related), **module CTA**, authority (if `⚠️ NEV`).
7. **Lead magnet** block (topic-matched, via `EmailCapture`).
8. **Trust stamp:** "Last reviewed / validated by" when validated.
9. **Schema** per type ([07 §6](07-seo-engine.md)).
10. **House style:** everyday Hinglish (लाभ not मुनाफ़ा), English slug, no apostrophes in metadata.

## 2. Blueprint — Concept / Guide chapter (canonical explainer)

```
H1: {Concept}
- Opener (persona JTBD)
- "एक लाइन में" — fast definition (snippet)
H2: {Concept} क्यों ज़रूरी
H2: मुख्य बातें / प्रकार            (3-tile or table)
H2: उदाहरण से समझें               (worked example + Dr/Cr table)
H2: आम गलतियाँ / ⚠️               (and how to avoid)
H2: डिजिटल सिस्टम में कैसे         (link to module — conversion)
H2: तीन बातें याद रखें            (3 bullets)
H2: आख़िर में                     (summary)
> ✅ CTA (register / module)  +  EmailCapture (end)
FAQ (FAQPage schema, 3–6 Q)
Related (graph)
```

## 3. Blueprint — Blog article (timely / opinion / seasonal)

```
H1: {Hook title}
- Opener (relevance / news / season)
- Fast value
H2..: 3–5 scannable sections (table or callout each)
- Mid-article EmailCapture (topic-matched)
H2: तीन बातें याद रखें
H2: आख़िर में
> ✅ CTA + EmailCapture (end)
```
Carries `date` (drip-aware), `metaTitle/metaDescription` (field order rule), category, accent, tags.

## 4. Blueprint — How-to (Help task, `/help`)

```
H1: {Task} कैसे करें
- Prerequisites (list, with links)
H2: स्टेप-बाय-स्टेप           (numbered, screenshots/alt)
H2: ध्यान दें / ⚠️
H2: हो गया — आगे क्या          (next task links)
HowTo schema. CTA: open the module.
Related help tasks.
```

## 5. Blueprint — Cookbook recipe (`/cookbook`)

```
H1: {Scenario} — कौन सा voucher / entry
- When this happens (1 line)
H2: एंट्री (Dr/Cr table)        ⚠️ NEV
H2: किस module में             (link)
H2: variations / edge cases
Related recipes + concept (guide canonical).
```

## 6. Blueprint — Comparison / "vs" (commercial)

```
H1: {A} vs {B}
- Who should care
H2: तुलना तालिका               (side-by-side table)
H2: कब {A}, कब {B}
H2: सहकारी समिति के लिए सही चुनाव
> CTA (software / demo)
Product schema only if real ratings.
```

## 7. Blueprint — Software / category landing (`/software/:type`, `:state`)

```
H1: {Society type / State} के लिए सहकारी लेखांकन सॉफ्टवेयर
- Pain → promise
H2: ज़रूरतें (type/state-specific — must be a real fact, not a rename)
H2: ज़रूरी features (link modules)
H2: क्यों SahakarLekha (Hindi-first, free, compliant)
H2: FAQ
> CTA register / demo. SoftwareApplication + Breadcrumb schema.
```

## 8. Blueprint — Calculator / Tool (`/tools/:calc`)

```
H1: {Calculator}
- One-line what it does
[ Interactive tool ]
H2: फॉर्मूला (transparent — targets "{X} formula")
H2: उदाहरण
⚠️ "rates/rules vary — verify" disclaimer (if NEV)
> CTA: save to account / open full module + email-result capture
WebApplication schema.
```

## 9. Blueprint — Pillar page (hub)

```
H1: {Pillar}
- What this pillar covers
H2: per sub-area → short intro + link to each spoke (the cluster)
H2: सबसे ज़रूरी (top P0 spokes)
H2: tools & templates for this pillar
> CTA. Strong outbound links to ALL spokes (hub-and-spoke).
```

## 10. Quality checklist (gate 7)

- [ ] H1 + persona opener + fast answer
- [ ] Worked example / Dr/Cr where relevant
- [ ] `⚠️ NEV` items validated or generalized (no fabricated specifics)
- [ ] Up/down/related links + module CTA + authority cite
- [ ] Magnet attached; schema correct; metadata within limits
- [ ] House style (Hinglish, slug, no apostrophes); alt text
- [ ] No orphan; ≤3 hops from pillar; canonical correct
- [ ] Trust stamp + review_due set

---

### Cross-references
[Content Engine](11-content-engine.md) · [SEO Engine](07-seo-engine.md) · [Personas](05-personas.md) · [Knowledge Graph](06-knowledge-graph.md)
