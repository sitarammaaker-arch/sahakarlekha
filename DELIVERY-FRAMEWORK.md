# SahakarLekha Product Delivery Framework — Version 1.0

**Status:** Ratified · **Type:** Mandatory delivery workflow · **Subordinate to:** `CONSTITUTION.md` (supreme law) · **Governs:** how every feature is conceived → validated → designed → built → tested → documented → released → measured → improved.

> The Constitution says *what may exist and why*. This Framework says *how it gets built*. Where they overlap, this Framework **invokes** the Constitution rather than restating it (validation = the Constitution's Decision Framework, Appendix B). Duplicating the Constitution would violate Law **L7**.

**Core principle: proportionality.** The 17 classic delivery phases are a *menu*, not a mandatory sequence for every change. A solo+AI team cannot run a 17-stage waterfall per task — forcing it would violate Constitution Article III.8 (maintainability) and Article XIV (process for its own sake). Every change is classified; the class determines which gates apply. A typo crosses one gate; a platform feature crosses all of them.

---

## 1. Executive Summary

Turns the Constitution into a repeatable production line that prevents chaos, duplication, wrong architecture, missing docs/analytics, tech debt, SEO/AI mistakes, and unmaintainable features — without enterprise ceremony. Four moves:

1. **Proportionality.** Classify every change (T0–T4 size + type modifiers); class sets the gates.
2. **Reviews are artifacts, not meetings.** Each "review" is a short written artifact Claude produces and the founder approves.
3. **Documentation, analytics, knowledge, and AI are built *with* the feature, not after** (Constitution is Documentation-First and one-canonical-node).
4. **Five gates, automated where possible:** G0 should-it-exist · G1 ready-to-build · G2 ready-to-merge · G3 ready-to-release · G4 post-release.

Small work stays fast; risky work (data integrity, AI, compliance, architecture) gets real scrutiny; nothing important is silently skipped.

## 2. Delivery Philosophy

- **Proportional process** — ceremony scales to risk, never uniformly.
- **Integrity before interface** — the save path, rollback, and report-formula parity (L1–L5) are built and verified before the UI.
- **Build the knowledge with the feature** — done = works + a user can learn it + AI can cite it.
- **Automate the gate, not the judgment.**
- **Reuse is default; building is the exception** (L11).
- **Reversibility is a feature** — additive, fail-soft, redirect-and-migrate, rollback-ready.
- **Slow is smooth, smooth is fast** — never trade long-term quality for short-term speed; never spend major-feature process on a one-line fix.

## 3. The Complete Workflow

Eight stages (S0–S7) and five gates (G0–G4); the feature class (§12) decides which are mandatory.

```
S0 Intake ─▶ [G0 Should it exist?] ─▶ S1 Validate ─▶ S2 Define & Review (PRD + impact)
   ─▶ [G1 Ready to build?] ─▶ S3 Build ─▶ S4 Verify ─▶ S5 Document
   ─▶ [G2 Ready to merge?] ─▶ S6 Release ─▶ [G3 Ready to release?]
   ─▶ S7 Measure & Improve ─▶ [G4 Post-release review] ─▶ (loop)
```

- **S0 Intake** — the one-pager (§4a). Problem, not solution.
- **G0 Should it exist?** = Constitution Decision Framework (Appendix B 1–12).
- **S1 Validate** — reuse search + duplication check (L11, L7). Output: reuse map.
- **S2 Define & Review** — PRD (§4) + Impact Sheet (§5), at class depth.
- **G1 Ready to build?** — PRD complete · no unresolved Constitution conflict · data-integrity plan if any save/report/delete path is touched · knowledge + analytics plan present.
- **S3 Build** — standard order (§3a).
- **S4 Verify** — class-appropriate tests; observe real behavior in the running app.
- **S5 Document** — canonical node, contextual help, release note, analytics, search terms, internal links, migration notes (designed in S2).
- **G2 Ready to merge?** — tests green · Laws L1–L6 honored · canonical node + help exist · analytics wired · no duplication · lints pass.
- **S6 Release** — checklist (§9).
- **G3 Ready to release?** — prerender/schema · search indexed · deep-links + redirects · rollback ready · monitoring on.
- **S7 Measure & Improve** — §10.
- **G4 Post-release** — moved its metric? regressions/errors/support spike? keep / iterate / roll back / deprecate.

### 3a. Standard Implementation Order (redesigned for this product)

1. **Data model + migration** (additive, `add column if not exists`, two-step persist designed — L1; tell the user to run it).
2. **Persistence path with visible rollback** (L1, L3) — *before any UI*.
3. **Business logic & computations** (formula parity L2, cascade completeness L3).
4. **UI with all states** (empty / loading / error / success / FY-locked).
5. **Analytics events + contextual-help hook** — wired during build (defined in PRD).
6. **Knowledge node + deep-link CTA** — one node serving Help Center, search, AND copilot (L7).
7. **Verification** — real behavior in the running app.
8. **SEO/prerender/schema + search index.**
9. **AI readiness** — confirmed automatically if step 6 was done right; verify grounding + citation.
10. **Release.**

*Documentation and AI are NOT a final phase — designed at S2, built at steps 5–6.*

## 4. PRD Template

**4a. PRD-Lite (T0–T1):** problem · affected users/screens · root cause (bugs) · the fix · Product Laws touched · how verified · rollback.

**4b. Full PRD (T2–T4):** 1 Objective (tied to a north-star metric) · 2 User stories · 3 Acceptance criteria (testable) · 4 Edge cases (failed cloud save, soft-deleted parents, FY-locked, zero-state, society-type variance) · 5 Business rules · 6 Functional requirements · 7 Non-functional (low-end perf, accessibility, security/PII, resilience-not-offline-first) · 8 Constraints (Constitution articles/laws) · 9 Dependencies · 10 Risks + mitigations (§8) · 11 **Knowledge & analytics plan (mandatory):** canonical node(s), edges, helpKey, deep-link route, analytics events, search terms, internal links · 12 Decision.

## 5. Review Process (collapsed Impact Sheet)

One written sheet Claude produces, the founder approves. Three sections:
- **Architecture impact:** architecture · Knowledge-Graph nodes/edges · data model + migration · routing/navigation · search · AI grounding · analytics · performance · security · accessibility · backward-compat · **maintenance cost (honest)** · extensibility.
- **Design impact:** UX flow · UI reuse · contextual help · learning impact · mobile vs. desktop posture · error-prevention · all five states.
- **Engineering impact:** reuse map (components/hooks/utils/APIs/schema) · naming + coding conventions · refactor opportunities · tech-debt · which existing **pattern** this follows.

Any unresolved Constitution conflict **blocks G1**.

## 6. Quality Gates

| Gate | When | Mandatory checks | Enforcement |
|---|---|---|---|
| **G0** Should-it-exist | After intake | Constitution Decision Framework; reuse/duplication clear | Human + founder |
| **G1** Ready-to-build | After PRD + Impact Sheet | PRD to class depth; no Constitution conflict; data-integrity plan if save/report/delete touched; knowledge+analytics plan | Human |
| **G2** Ready-to-merge | After build+verify+docs | Tests green; **Laws L1–L6 honored**; canonical node + help exist; analytics wired; no duplication; encoding intact; lints pass | Lints + human |
| **G3** Ready-to-release | Before deploy | Prerender/schema; search indexed; deep-links + redirects; rollback ready; monitoring; perf | Build + human |
| **G4** Post-release | At review interval | Moved its metric?; no regressions/error/support spike; AI answers grounded+cited | Human + analytics |

A gate may be **waived only by the founder, explicitly, with the reason recorded** — never skipped silently.

## 7. Decision Matrix

| Verdict | Criteria | Next |
|---|---|---|
| **APPROVE** | Passes all Decision-Framework gates; reuse clear; maintainable; fits Constitution & Graph | Proceed |
| **APPROVE WITH CHANGES** | Sound but violates a principle as-scoped (would duplicate / needs deep-link / must shrink to ≤600 words) | Apply changes, proceed |
| **NEEDS RESEARCH** | Real problem but unknown duplication, unclear demand, or unverified legal/accounting fact | Spike, re-gate |
| **DEFER** | Valuable but maintenance/team cost too high now, or dependency missing | Park with revisit trigger |
| **REJECT** | Violates Constitution, duplicates a canonical node/feature, or can't be maintained | Stop; record why |

**Tie-breakers (in order):** data integrity > user trust > maintainability > user success/PLG > SEO/AI reach > velocity.

## 8. Risk Framework

| Risk | Trigger | Standard mitigation |
|---|---|---|
| Technical / data integrity | save/report/delete/inventory | Two-step persist + visible rollback (L1); formula parity (L2); cascade audit (L3); verify in running app |
| User | changes a familiar workflow/vocabulary | Preserve patterns; Hinglish copy; contextual help; empty/error states |
| SEO | new/changed URLs or content | Canonical-by-intent; redirects; no duplicate body; schema; sitemap |
| AI | feeds or uses the copilot | Grounded-only, cite-always, never-fabricate; verify answers post-release (L10) |
| Knowledge | new content/concept | One canonical node; dedup lint; edges; last-verified |
| Maintenance | recurring upkeep implied | If not near-zero → DEFER/REJECT (III.8) |
| Legal / Compliance | any Act/Rule/Circular/rate content | Approval gate; dated; sourced not re-hosted; disclaimer; verified-state-only (L14) |
| Business | affects free-tier promise or trust | Never paywall essentials; never fabricate proof |
| Backward-compat | URL/API/stored-data/ledger-name change | Migrate + redirect + sync; never silent break (L9) |

## 9. Release Framework (G3 checklist)

Documentation & canonical node complete · analytics firing · search indexed · deep-links resolve · AI grounding verified · contextual help live · Knowledge-Graph edges added · redirects verified · prerender/schema emitted · performance acceptable on low-end · monitoring/alerts on · **rollback path confirmed** · migration instructions delivered and run.

**Deploy discipline:** commit/push only on the founder's explicit approval; branch off `main` for non-trivial work; deliver migrations as SQL the founder runs in Supabase; never skip hooks/signing; additive and fail-soft by default.

## 10. Continuous Improvement Framework

```
Signals: feedback inbox · GA4 events · helpful 👍/👎 · zero-result searches · AI copilot logs · support/WhatsApp
   ↓ (weekly skim, monthly triage)
Prioritize: impact × reach ÷ maintenance cost, through the Decision Matrix
   ↓
Improve (re-enters at the right stage/class) ↓ Release ↓ Measure ↓ repeat
```
- Zero-result searches and 👎 votes = the content backlog.
- Copilot "no verified answer" events = highest-priority knowledge gaps.
- **Review intervals:** T0/T1 next session · T2 2wk & 6wk · T3/T4 2wk, 6wk, quarter · Compliance on a fixed cycle.

## 11. Claude Code Operating Workflow (binding, pre-flight)

If any required step for the class is incomplete: **stop, explain, recommend the missing work, wait — never skip silently.**

```
1. CLASSIFY   → T0–T4 + type modifiers (§12).
2. INTAKE     → problem, user, outcome, success metric, "why now" (PRD-Lite or Full).
3. G0         → Constitution Decision Framework. Fail → recommend change/REJECT, stop.
4. REUSE      → search codebase + graph for existing component/util/hook/pattern/node. Duplicate → reuse/extend.
5. IMPACT     → Impact Sheet (§5) for T2+. Flag Constitution conflict NOW.
6. PLAN LAWS  → touching save/report/delete/AI/Devanagari/URL → state the governing Law (L1–L14) + how honored, BEFORE coding.
7. G1         → PRD + integrity plan + knowledge/analytics plan complete. Else stop & recommend.
8. BUILD      → standard order (§3a).
9. G2 → tests+Laws+docs+dedup+lints. 10. G3 → release checklist. 11. G4 → measure.
12. REPORT honestly → failures as failures; never fabricate data/proof/legal facts; confirm before irreversible/outward-facing actions.
```

Lead with the recommended change, not the implementation, whenever a check fails.

## 12. Feature Classification (the proportionality engine)

**Size classes:**
| Class | Examples | PRD | Gates |
|---|---|---|---|
| **T0 Trivial** | copy/typo, style, alt text | none | G2 only |
| **T1 Bug fix** | wrong total, broken link | PRD-Lite | G0(quick)+G2 |
| **T2 Minor feature** | new field, report column, how-to | Full (short) | G0–G3 |
| **T3 Major feature** | new module/screen, content layer | Full | G0–G4 |
| **T4 Platform/Architecture/Infra** | data-model, search engine, prerender | Full + backward-compat & migration scrutiny | G0–G4 + founder sign-off |

**Type modifiers (extra mandatory checks on ANY size):**
- **Knowledge** → canonical node + edges + dedup lint + contextual help (L7).
- **SEO** → canonical-by-intent + redirects + schema + sitemap + zero-duplicate body.
- **AI** → grounded-only + cite + never-fabricate + post-release answer audit (L10). Mandatory even when small.
- **Compliance/Legal** → approval gate + dated + sourced + disclaimer + verified-state-only (L14). Mandatory even for one circular.
- **Data-integrity-touching** (save/report/delete/inventory) → two-step persist + rollback + formula parity + cascade audit + verify-in-app (L1–L5). The most-enforced modifier.

## 13. Final Recommendations

1. Proportionality is the law of delivery — the classification table keeps this alive for a small team.
2. The data-integrity modifier is non-negotiable — spend the process budget there.
3. Treat knowledge + analytics as build steps (PRD §4b.11, build steps 5–6).
4. Automate the gates you can; reserve humans for judgment.
5. Waivers are explicit and logged, never silent.
6. Don't grow the framework — automate recurring needs into lints, don't add stages.

---

**Versioning.** PDF v1.0, subordinate to the Constitution. Changes are amendments with a version bump and a one-line changelog.
