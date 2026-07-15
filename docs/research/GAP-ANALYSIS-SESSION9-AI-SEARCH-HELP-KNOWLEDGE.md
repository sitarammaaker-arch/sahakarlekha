# SahakarLekha Gap Analysis — Session 9 (AI, Search, Help Centre & Knowledge Base)

**Nature:** Audit only. No code written, no files modified. Scope strictly **AI + Search + Help Centre + Knowledge Base** (`pages/AskAssistant`, `SiteSearch`; `components/GlobalSearch`; `lib/siteSearch`; `src/content/*`; Help/Guide/Glossary/Cookbook/FAQ; docs knowledge stacks SCOS/SMRD/KAE/KPP). Measured against Blueprint 3.1/3.6 (AI-readiness) and the product's own grounding constitution. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**AI (grounded retrieval, no generation).** `AskAssistant` (`/ask`) is a **retrieval assistant**: it takes a natural-language question, retrieves the best-matching Knowledge Objects (help/cookbook/guide/blog/faq) via `lib/siteSearch`, and presents the top hit as a **cited answer** with related links. It **never generates free-form text** — a deliberate anti-hallucination design ("cannot fabricate numbers or law", Constitution Art. VIII), with an "confirm with your auditor/RCS" disclaimer. There is **no LLM library or API** (openai/anthropic/etc. absent); LLM synthesis is explicitly a deferred optional layer over the same retrieval. `trackEvent('ask_query')` logs queries + result counts.

**Search (two client-side systems).**
1. **`GlobalSearch`** (cmdk command palette) — substring search over **live app data** (members, vouchers, accounts, loans, assets, housing), **capability-gated** (e.g. loans only if `has('lending')`), top-5 per category, `.toLowerCase().includes()`.
2. **`lib/siteSearch`** (`buildIndex()` + `search()`) — a **client-side content index** over help/cookbook/guide/blog/faq; powers `SiteSearch` and `AskAssistant`.
No server-side search, no fuzzy library (Fuse/FlexSearch), no vector/semantic search, no typo tolerance.

**Help Centre / Knowledge Base (rich, well-governed).** Extensive `src/content`: **guide** (605K — chapters + quiz + certificate + verify), **blog** (432K), **cookbook** (60K entry-recipes), **calculators** (52K), **help** (32K), **glossary** (16K), **faq** (12K), plus `relatedContent`/`crossLinks`/`societyTypes`/`states`. Published content carries **Knowledge-Item provenance** — e.g. "स्रोत: सक्रिय Knowledge Items (KI-000043/044) — Evidence Level A", with **"Needs Expert Validation"** flags on uncertain domain points. `HelpfulWidget`/`RatingWidget` capture content feedback.

**Knowledge stacks (authoring-only).** The `docs/` SCOS/SMRD/KAE/KPP/KDI knowledge system (356 Knowledge Items, evidence levels, NEV rule) is an **authoring/content-OS pipeline**; grep confirms `src/` does **not** import `docs/kae|kdi|kpp` — the KI citations are baked into the rendered markdown as text, not a live runtime engine.

**Verdict:** this is one of the **most mature and best-governed clusters** — grounding-first AI, comprehensive bilingual content, and genuine provenance/evidence governance. The gaps are **enhancement opportunities**, not defects.

---

## 2. Business Rule / Design Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **AI is retrieval-only** | By design (safe), but it cannot synthesize, compute, or answer anything not already authored as content. It is a content finder, not a copilot. |
| BR-2 | **Assistant is public-only, not in-app contextual** | `AskAssistant` renders in `PublicLayout` over site content — a **logged-in user cannot ask about their own society's data** (balances, this member, this voucher). No authenticated copilot. |
| BR-3 | **Two disconnected search systems** | `GlobalSearch` (app entities) and `siteSearch` (content) never unify — a user cannot search data + help + actions in one place. |
| BR-4 | **Client-side substring matching** | No fuzzy/typo tolerance and limited **Hinglish↔Devanagari** cross-script matching — a Hindi-first product where users type Hinglish ("member kaise jode") relies on the index already containing those forms. |
| BR-5 | **Knowledge engine is authoring-only** | The KAE/KPP runtime lives in `docs`, not the app; provenance is static text, so evidence-level/NEV state cannot be queried or enforced at render time. |

---

## 3. Missing Features (vs AI-readiness Blueprint 3.1/3.6)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **In-app contextual AI copilot** over the user's own data (grounded, cited) | P2 |
| MF-2 | **Unified search** (content + app entities + navigable actions) | P2 |
| MF-3 | **Fuzzy / semantic search** (typo tolerance, synonyms, vector recall) | P2 |
| MF-4 | **Hinglish/Devanagari query normalisation** (transliteration-aware matching) | P2 |
| MF-5 | **Optional LLM synthesis layer** over retrieval (behind cost/key gate) | P3 |
| MF-6 | **Live knowledge engine** (wire KAE/KPP into app; queryable evidence/NEV state) | P3 |
| MF-7 | **AI-readiness data foundation** (event stream / clean data) for future models | P3 |
| MF-8 | **Answer-quality feedback loop** (was-this-helpful on AI answers, coverage/zero-result analytics → content backlog) | P3 |
| MF-9 | **Role/context-aware help** (surface the right help for the current screen/role) | P3 |

---

## 4. Governance / Compliance (mostly strengths)

| # | Item | Assessment |
|---|---|---|
| GV-1 | **Grounding-first, no fabrication** (Constitution Art. VIII) | **Strong** — the single most important property for a financial/legal assistant |
| GV-2 | **Evidence levels + "Needs Expert Validation" flags + KI citations** | **Strong** — honest content governance rare in this space |
| GV-3 | **Auditor/RCS confirmation disclaimer** | **Strong** — appropriate liability posture |
| GV-4 | Evidence/NEV state not enforceable at runtime (static text) | Minor gap — a stale KI cannot be flagged live |
| GV-5 | No content-staleness tracking in-app (law changes) | Minor gap — relies on authoring discipline |

---

## 5. Quality / Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **No unified answer-quality loop** | `ask_query` logs result counts (zero-result is captured), but there is no "helpful?" signal tied to AI answers feeding a content backlog. |
| AG-2 | **Coverage blind spots** | Retrieval-only means unanswerable questions silently fall through to a WhatsApp CTA; no systematic gap report. |
| AG-3 | **Provenance not machine-checkable in-app** | KI/evidence citations are prose, so the app cannot audit whether displayed guidance is current/validated. |

---

## 6. Gap Register

| Gap ID | Area | Current situation | Expected | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| AK-01 | AI | Public retrieval-only assistant | In-app grounded copilot over user data | Limited help where users work | **P2** | L | Auth, data access, grounding |
| AK-02 | Search | Two disconnected search systems | Unified search (data + content + actions) | Fragmented findability | **P2** | M | Search refactor |
| AK-03 | Search | Substring only | Fuzzy/semantic + typo tolerance | Missed matches | **P2** | M | Search lib |
| AK-04 | Search | Weak Hinglish/Devanagari matching | Transliteration-aware normalisation | Hindi-first users under-served | **P2** | M | siteSearch index |
| AK-05 | Knowledge | KAE/KPP authoring-only | Live knowledge engine in app | Evidence/NEV not enforceable | **P3** | L | Wiring |
| AK-06 | AI | No LLM synthesis | Optional synthesis over retrieval | Richer answers | **P3** | M | API/cost gate |
| AK-07 | Quality | No answer-quality/coverage loop | Feedback + zero-result → content backlog | Slow content improvement | **P3** | S | Analytics |
| AK-08 | AI | No AI-readiness data foundation | Event stream / clean data | Future models blocked | **P3** | L | Architecture |

---

## Summary
This cluster is a **product strength and a good-governance exemplar** — the AI is deliberately **grounded and non-generative** (it cites real content and refuses to fabricate, per Constitution Art. VIII), the Help/Guide/Glossary/Cookbook content is extensive and bilingual, and published guidance carries **Knowledge-Item provenance, evidence levels, and Needs-Expert-Validation flags**. There are **no P0s or P1s** — nothing here is broken or non-compliant. The opportunities are enhancements: an **in-app contextual copilot** over the user's own data (AK-01), **unified + fuzzy + Hinglish-aware search** (AK-02/03/04), and eventually wiring the **KAE knowledge engine** into the runtime and adding an optional LLM synthesis layer — all consistent with the blueprint's "AI is downstream; grounding first" posture.

*End of Gap Analysis Session 9 — audit only; no code, no changes. STOP.*
