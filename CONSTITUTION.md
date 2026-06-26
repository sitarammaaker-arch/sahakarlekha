# SahakarLekha Product Constitution — Version 1.0

**Status:** Ratified · **Type:** Single Source of Truth (SSOT) · **Supersedes:** nothing (first edition) · **Subordinate to:** nothing · **Governs:** every future feature, page, module, article, AI capability, workflow, API, UI component, data change, and document.

> **How to read this document.** Articles are numbered for citation (e.g. "this violates Article IV.3"). The **Product Laws** (Appendix A) are the hard, non-negotiable rules. The **Decision Framework** (Appendix B) is the gate every proposal passes through. The **Claude Code Operating Rules** (Appendix C) are binding before any code is touched. Where this Constitution and a past design conflict, this Constitution wins, and the conflict is noted in **Article XVII**.
>
> Companion document: `DELIVERY-FRAMEWORK.md` (how features get built). This Constitution defines *what may exist and why*; the Framework defines *how it ships*.

---

## Executive Summary

SahakarLekha exists to give India's cooperative societies **trustworthy accounting and the knowledge to use it — free, in their own language.** Its durable moat is not features (Tally/Marg already have more); it is **a connected, governed, AI-grounded body of cooperative-accounting knowledge** wrapped around a product that **never loses a user's work and never lies to them** — about their numbers or about the law.

Three permanent truths:

1. **Single Source of Truth is the supreme law** — governing *both* data (the cloud is the record; local state must never silently diverge) *and* knowledge (one canonical node per concept; never duplicate).
2. **Maintainability outranks feature count.** For a tiny team running a free product, an unmaintained feature or stale article is a *liability that destroys trust*. Breadth is the primary failure mode. We say **no** by default.
3. **Trust is the product.** Every law ultimately protects verifiability: correct numbers, cited knowledge, honest AI, transparent governance.

The Knowledge Graph, Help Center, AI copilot, PLG deep-links, and SEO are *instruments* of those truths, not ends in themselves.

---

# THE CONSTITUTION

## Article I — Vision

- **Mission.** Make cooperative-society accounting correct, understandable, and self-serviceable for every secretary, accountant, auditor, and board member in India — at no cost.
- **Vision.** Become **the default accounting platform *and* the largest, most trusted knowledge source for the Indian cooperative sector** — where humans *and* AI engines go for the answer.
- **Purpose.** Remove the two things that keep cooperatives on paper and fear: (a) accounting that is wrong or lost, and (b) knowledge locked in auditors' heads and government PDFs.
- **Long-term objectives.** Data integrity by default · self-service that deflects support · knowledge that compounds into topical and AI-citation authority · activation and retention driven by knowledge, not ads.
- **Target users.** Society secretaries, accountants/operators, auditors, managers/board members (primary); cooperative federations and registrars (secondary).
- **Target ecosystem.** PACS, marketing/HAFED societies, credit societies, housing societies, dairy/processing cooperatives, across Indian states with their distinct Acts and Registrars.
- **Core values.** Trust · Simplicity · Truthfulness · Cooperative-first · Hindi-first · Generosity (free).
- **Success metrics (north stars).** Activation (society set up → first real voucher) · Retention (active across an audit cycle) · Self-service rate · Organic + AI-cited reach · Data-loss incidents = **zero**.

## Article II — Product Philosophy

- **Why we exist.** Cooperatives are under-served by global SaaS (wrong language/workflows, paid) and incumbents (Tally/Marg: powerful but generic, badly documented, dealer-gated). We serve the *cooperative-specific* workflow, free, in the user's language.
- **Problems we solve.** Lost/incorrect books; opaque compliance; no trustworthy Hinglish learning source; no software that speaks the cooperative dialect.
- **What SahakarLekha must NEVER become.** A bloated generic ERP · a paywall on essential accounting · a tool that loses or silently corrupts work · a source of unverified legal/financial claims · a feature museum nobody maintains · an AI gimmick that guesses at numbers or law.
- **Simplicity.** The simplest design that fully solves the real problem wins. Complexity must be *earned* by a demonstrated need.
- **Trust.** Every output — balance, report, article, AI answer — must be correct, traceable, and honest about uncertainty.
- **Cooperative-first.** Defaults, vocabulary, ledgers, and workflows assume a cooperative society, not a generic business.

## Article III — Product Principles

1. **Single Source of Truth (supreme).** Exactly one authoritative record per fact — for *data*, the cloud; for *knowledge*, the canonical node. Copies reconcile to it or are corrected.
2. **Knowledge First.** A feature isn't done until a user can find out how to use it.
3. **Product-Led Growth.** The product and its knowledge acquire and activate users; every article can lead into the exact app screen.
4. **AI-Ready by construction.** Content and data are structured for machine consumption and citation.
5. **Search First.** If users can't find it, it doesn't exist.
6. **Documentation First.** New capability ships with its canonical node and contextual help, or it doesn't ship.
7. **Accessibility.** Plain language, readable contrast, keyboard/screen-reader support.
8. **Maintainability (binding constraint).** If we can't keep it correct with near-zero ongoing labor, we don't build it. Outranks feature count.
9. **Security & Privacy.** Least-privilege, no PII leakage, consent-based capture, financial data protected as the user's property.
10. **Performance.** Fast on low-end devices and weak networks.
11. **Scalability of the *system*, not the team.** Automate, generate, reuse.
12. **Resilience over offline-first.** Protect against losing work on a failed save and degrade gracefully — but do **not** pursue full offline-first sync (conflicts with cloud-as-truth; see XVII.3).

## Article IV — Knowledge Principles

1. **One canonical node per concept.** Everything else links to it.
2. **Intent separation, not topic duplication.** The same subject may appear as LEARN (guide), DO (how-to), REFERENCE (cookbook/format/rule) — each a distinct intent, distinct canonical, cross-linked. Never the same body twice.
3. **Short does, long teaches.** A how-to is the task answer (brief); the guide is the depth. Link down, don't absorb.
4. **Knowledge relates, it doesn't repeat** — via typed edges (Article VI), not copy-paste.
5. **AI consumes the same canonical knowledge humans do.** No separate "AI content."
6. **Provenance and freshness are part of the content** — source, owner, last-verified; disclaimers on rate/law-bearing nodes.
7. **Duplication is a defect** — merge or canonicalize before publish.

## Article V — Information Architecture Principles

1. **A new top-level section must justify a new *intent* or *content-type*, not a new topic.** Default answer is **no**; burden on the proposer.
2. **The permanent shape is fixed:** LEARN · DO · REFERENCE (Cookbook/Formats/Compliance/Manual) + the invisible INTELLIGENCE layer + cross-cutting *views* (Society-Type Playbooks, Persona Learning Paths).
3. **URLs are permanent contracts.** English, descriptive, stable; changes require 301 redirects.
4. **Navigation reflects user intent and journeys,** not the org chart or database.
5. **Categories are few and stable; tags are many and cheap.**
6. **Search indexes every Knowledge Object of every type, including product screens.**

## Article VI — Knowledge Graph Principles

1. **The Knowledge Object (KO) is the atom.** Every article, guide chapter, FAQ, entry, format, circular, rule, video, *and product screen* is a typed KO with a common envelope (identity, type, intent, difficulty, society-types, prerequisites, related, last-verified, owner, search-terms, summary).
2. **Meaning lives in typed edges:** explains, teaches, records, requires, governs, templates, next, related, applies-to, supersedes.
3. **One graph, many surfaces.** Related-content, journeys, contextual help, search, and AI retrieval are projections of the one graph.
4. **Extensible by adding node/edge types, never by forking the model.**
5. **The graph is the moat.** Protect its integrity above any single surface.

## Article VII — UX Principles

1. Consistency — one pattern per problem. 2. Minimalism. 3. Progressive disclosure (tooltip → panel → article → copilot → human). 4. Contextual help comes to the screen. 5. Learn while working. 6. Reduce cognitive load (cooperative-native vocabulary, sane defaults). 7. Error prevention over error messages (design out the data-loss and report-mismatch classes). 8. Self-service first; humans last. 9. Accessibility. 10. **Device honesty:** knowledge/marketing/read/approve surfaces are mobile-first; **heavy data entry (vouchers, opening balances, reconciliation) is desktop-respecting** (see XVII.2).

## Article VIII — AI Principles

1. **Grounded only** (RAG over the canonical graph; no free-form facts).
2. **Never fabricates numbers or law.** Never invents a journal entry, balance, rate, circular, or provision; defaults to "verify with your auditor/RCS."
3. **Always cites** source nodes and, where relevant, the app screen.
4. **Transparent** — users know it's AI and can reach a human.
5. **Assists, never authorizes** — must not execute irreversible financial actions.
6. **Context-aware in-app** — knows screen, society type, FY state, and uses that to retrieve, not guess.
7. **One engine** — search and copilot share one retrieval backend over one graph.
8. **Safety = silence over speculation** — insufficient grounding → "I don't have a verified answer" → human.

## Article IX — SEO Principles

1. Evergreen first. 2. Topical authority by clustering. 3. Canonical discipline (one canonical per intent; zero duplicate bodies). 4. Structured data on every node (Breadcrumb, Article, FAQ where honest); never deprecated formats. 5. AI discoverability (atomic TL;DR blocks, stable URLs, freshness, machine-readable relationships, `llms.txt`). 6. Qualified long-tail, not head terms. 7. Search intent governs format. 8. Quality and truth are ranking strategy.

## Article X — Content Standards

Every type = shared envelope (VI.1) + a type body:
- **Guide chapter:** objective · concept · worked example · quiz · next.
- **Help/How-To:** TL;DR · prerequisites · numbered steps (+screenshot) · common mistakes · FAQs · deep-link CTA · next task · guide link. **≤ ~600 words.**
- **Blog:** narrative/why · funnel CTA · links into canonical how-to/guide.
- **FAQ:** one question · ≤80-word answer · link to canonical node.
- **Entry (Cookbook):** scenario · Dr/Cr table · narration · society-type variants · do-in-app link.
- **Format/Template:** purpose · when used · preview · download · governing rule · related task.
- **Circular/Notification/Order:** issuing body · number · date · Hinglish summary · **source link (no unlicensed re-hosting)** · applies-to · **disclaimer + last-verified**.
- **Rule/Act:** section · plain-Hinglish summary · official citation · applies-to · disclaimer.
- **Video:** goal · embed · **transcript** · linked article.
- **Release note:** date · what changed · who it affects · linked feature doc.
- **Case study:** profile · challenge · solution · outcome — **named and consented only**.
- **Troubleshooting:** symptom (user's words) · cause · fix steps · prevention.

**Language law:** everyday Hinglish that cooperative users actually speak — English accounting terms in Devanagari are correct; Sanskritised *shuddh* Hindi is forbidden in user-facing copy.

## Article XI — Governance

1. **Ownership** per node. 2. **Review cycles** — rate/law nodes ≤12 months with staleness alerts. 3. **Approval** — single-author for ordinary content; **formal gate for the Compliance layer only**. 4. **Versioning & change history;** "last verified" shown publicly. 5. **Quality control via automation** — build-time lints: duplicate/overlap, broken-edge/deep-link, missing meta/schema/TL;DR, orphan-node. 6. **Deprecation & archiving — never silent deletion;** superseded content keeps a `supersedes` edge and a working URL. 7. **Duplicate prevention is a publish gate.** 8. **Maintenance policy** — non-compliant content is fixed or archived, never left to rot.

## Article XII — Engineering Principles

1. **Reuse before building.** 2. **Composable & modular** (single responsibility). 3. **One pattern per problem** (the established save-path, report-formula, cascade patterns are *the* patterns). 4. **Backward compatibility** — URLs, APIs, stored data, ledger names are contracts; migrate + redirect + sync, never silent break. 5. **Fail-soft and additive.** 6. **Data integrity is sacred (supreme engineering law):** optimistic local state never silently diverges from cloud; failed saves roll back visibly; reports compute from the same formula as their state; parent deletes cascade to all dependents; financial computations exclude soft-deleted records; mutations respect the audit lock. 7. **Future-proof by principle, not prediction.** 8. **Encoding & language safety** (UTF-8/Devanagari preserved; no unsafe bulk text ops).

## Article XIII — Decision Framework

No proposal is approved until it passes **every gate** in Appendix B. A single hard "no" blocks it pending redesign.

## Article XIV — Anti-Principles

Grounds to reject: feature bloat · duplicate content/workflows/canonicals · confusing/org-chart navigation · weak or monolingual search · unverified knowledge / fabricated testimonials / un-sourced legal claims · AI hallucination / AI inventing numbers or law / AI executing financial actions · unmaintainable features or stale content · technology for its own sake · silent data loss or local↔cloud divergence · paywalling essential accounting · Sanskritised unreadable Hindi.

## Article XV — Long-Term Vision

- **3 years.** Default *self-service* platform in core states: DO + REFERENCE complete, unified search, contextual help, a grounded copilot, measurable deflection and PLG.
- **5 years.** Definitive *knowledge* platform: multi-state compliance, mature copilot, learning paths + recognized certification, routinely cited by AI engines.
- **10 years.** The **knowledge layer of the Indian cooperative sector** — referenced by auditors/registrars, built upon by federations, a graph-shaped moat a feature-copy cannot replicate.

## Article XVI — Operating Rules for Claude Code

See Appendix C.

## Article XVII — Amendments to Prior Designs

1. **Breadth → discipline.** ~50-section brainstorm (community forum, paid certification, parallel guides, standalone case studies) rejected/deferred under III.8.
2. **"Mobile-first" → device honesty** (VII.10): heavy data entry is desktop-respecting.
3. **"Offline resilience" → resilience, not offline-first** (III.12): conflicts with cloud-as-truth.
4. **AI scope clamp** (VIII): grounded-only, cite-always, never-fabricate, assist-not-authorize.

---

# APPENDICES

## Appendix A — Product Laws (hard, non-negotiable)

**Data Integrity (supreme — already in force):**
- **L1.** Local state never silently diverges from the cloud; failed base saves roll back visibly with a clear message.
- **L2.** Reports compute from the same formula as the state they describe.
- **L3.** Deleting/editing a parent cascades to every dependent (linked vouchers, entries, inventory, sub-ledgers); references are renamed/soft-deleted, never orphaned.
- **L4.** Financial computations exclude soft-deleted records.
- **L5.** Every mutation respects the audit/FY lock.
- **L6.** Encoding integrity (UTF-8/Devanagari) preserved in every edit.

**Knowledge & Product:**
- **L7.** One canonical node per concept; duplication is a defect.
- **L8.** Short does, long teaches; how-tos ≤ ~600 words and link down.
- **L9.** Every URL is a permanent contract; changes require redirects.
- **L10.** AI is grounded-only, cite-always, never fabricates numbers or law, never authorizes financial actions.
- **L11.** Reuse before building; one pattern per problem.
- **L12.** User-facing language is everyday Hinglish; no Sanskritised Hindi.
- **L13.** Nothing un-maintainable ships; nothing stale stays live.
- **L14.** Compliance/legal content is the only formally gated layer: dated, sourced (not re-hosted), disclaimed, verified-state-only.

## Appendix B — Decision Framework (every proposal passes ALL gates)

1. Real problem? 2. Duplication? (reuse/extend instead) 3. Maintainable? (near-zero labor) 4. Constitution-fit? 5. Intent/IA-fit? 6. Graph-fit? 7. User success? 8. PLG? 9. SEO (unique, canonical, zero-duplicate)? 10. AI-readiness? 11. Complexity cost vs value? 12. Should it exist at all? (default no until 1–11 satisfied)

*Output:* APPROVE · APPROVE-WITH-CHANGES · REJECT · DEFER — with the failing gate named.

## Appendix C — Claude Code Operating Rules (binding, pre-flight)

Before implementing **anything**:
1. **Is this already solved?** Search codebase/content for an existing helper, component, pattern, or node. Prefer reuse/extension.
2. **Does it duplicate?** If found, propose merge/canonicalize, don't add a sibling.
3. **Does it fit the Knowledge Graph & IA?** Identify node-type, edges, intent layer, canonical relationship.
4. **Does it improve user success / PLG / SEO / AI-readiness?**
5. **Is it maintainable?** State the ongoing cost honestly; if not cheap, recommend against.
6. **Does it honor the Product Laws?** Especially L1–L6 (data integrity), L7–L9 (knowledge/URLs), L10 (AI), L12 (language). Touching a save/report/delete/AI/Devanagari/URL surface → apply the corresponding law explicitly.
7. **Constitution conflict?** Stop and recommend changes before implementing; do not silently comply with a violating request.
8. **Scope honesty.** Confirm before irreversible/outward-facing actions; report outcomes faithfully; never fabricate data, testimonials, or legal facts.

*If any check fails, the response leads with the recommended change, not the implementation.*

---

**Ratification.** Version 1.0. Future changes are **amendments** with a version bump and a one-line changelog, never silent edits.
