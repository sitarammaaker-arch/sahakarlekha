# Phase 7 — Content Gap Audit

> Where knowledge and product are **not yet connected**: isolated KIs, product pages with no knowledge,
> duplicate/weak pages, and missing links/CTAs/help/FAQ/downloads/calculators. Prioritized. Scope =
> the 50 active KIs + the surfaces they should reach.

**Priority:** 🔴 P0 · 🟠 P1 · 🟡 P2.

---

## 1. Active KIs with NO product destination yet
**All 50** are currently surfaced **only in `/docs`** — none are wired into glossary/tooltip/FAQ/AI/search
as KIs yet. This is the headline gap. Severity by KI priority:
- 🔴 **P0 isolated (12):** KI-000001, 000026, 000027, 000028, 000033, 000050, 000055, 000079, 000101, 000303, 000306, 000341 — high-traffic, trivial to surface (glossary/FAQ/tooltip).
- 🟠 **P1 isolated (~26):** the remaining concept/member/bank/report KIs.
- 🟡 **P2 isolated (~12):** posting, nominal member, face value, cheque, NEFT/RTGS, etc.

> **No active KI should be flagged "no practical value"** — all 50 map to a real surface in
> [Delivery Map](knowledge-delivery-map.md). None require review-for-removal.

## 2. Product pages/screens WITHOUT knowledge (need context help)
| Surface | Missing knowledge | KI to attach | Pri |
|---|---|---|---|
| /vouchers (entry form) | no Dr/Cr / voucher explainer | KI-000055, 000026, 000027, 000028 | 🔴 |
| /ledger-heads (add account) | no "what is an account" | KI-000033, 000079 | 🔴 |
| /cash-book (empty state) | no cash-book explainer | KI-000101, 000099 | 🔴 |
| /bank-book (+ नया बैंक) | no bank-account explainer | KI-000113, 000114 | 🟠 |
| /bank-reconciliation | no statement/BRS explainer | KI-000121 | 🟠 |
| /members (add) | no member/membership explainer | KI-000004, 000131, 000134 | 🟠 |
| /share-register | no share/face-value explainer | KI-000153, 000158, 000157 | 🟠 |
| /reports, /balance-sheet, /profit-loss | no "read this report" help | KI-000212, 000034/35/36, 000040 | 🔴 |
| /society-setup (wizard) | no per-field help | KI-000305, 000009, 000050 | 🔴 |
| /backup-restore | no backup trust note | KI-000306 | 🟠 |
| /dashboard (first run) | no welcome/cycle overview | KI-000025, 000049 | 🟡 |

## 3. Missing FAQ entries (active KIs with FAQ destination, none live yet)
KI-000001, 000002, 000021, 000029, 000040, 000055, 000079, 000101, 000116, 000118, 000131, 000153,
000303, 000305, 000306, 000322, 000325, 000341, 000212. → **~19 FAQ entries** to generate from KIs. 🔴/🟠

## 4. Missing glossary (no KI-driven glossary surfacing yet)
~42 of the 50 KIs are glossary-eligible; **a live KI-driven glossary page does not yet exist** (guide has
static glossary chapters, but not wired to KIs). 🔴 **Highest-leverage single build** (one glossary →
~42 KIs surfaced + powers search synonyms + tooltips).

## 5. Missing internal links
- Guide chapters (e.g. /guide/accounting-foundations, /guide/daybook-and-ledger) don't yet link to the
  **glossary KI** for inline terms (debit, credit, ledger, voucher…). 🟠
- Modules don't link out to their concept KI / guide chapter. 🟠
- Cookbook recipes don't link to the concept KI behind the entry. 🟡
> Source of truth for links = each KI's `internal_links` + `related_concepts` ([KPP](../kpp/wave-1-active/00-index.md)).

## 6. Missing CTAs
- Concept pages/glossary have no **module CTA** ("इसे SahakarLekha में करें → /vouchers"). 🟠
- FAQ answers (free, backup, digital) have no **register CTA**. 🔴 (high conversion)
- Ask-AI answers don't yet append the KI's `related_module` CTA. 🟠

## 7. Missing help / onboarding
- Onboarding wizard exists but lacks **per-step KI help** (KI-000305, 000009, 000050, 000325). 🔴
- No "understand your first report" help moment (KI-000212). 🟠

## 8. Missing downloads
Active KIs suggest downloads not yet produced (Level-A safe 1-pagers): Debit-Credit cheat sheet,
Accounting equation 1-pager, Income-vs-Expense 1-pager, Society-types comparison, Cash-book format,
Going-digital benefits, Getting-started checklist. 🟡 *(Statutory templates remain NEV — out of scope.)*

## 9. Missing calculators
**None required for these 50** — all active KIs are Level-A educational/product; calculators map to
**B/NEV** items (interest, depreciation, GST, dividend) that are **not yet active**. ✅ Correctly absent.
Flag: do not build calculators from non-active KIs.

## 10. Duplicate / weak pages (watch-list)
- **Glossary duplication risk:** guide has `glossary.md` + `account-name-glossary.md` (static). When the
  KI-driven glossary ships, **canonicalize** to KI glossary; convert the guide chapters to point at it
  (avoid two glossaries — [SCOS 07 canonical](../scos/07-seo-engine.md)). 🟠
- **FAQ duplication risk:** guide `comprehensive-faq.md` vs `/faq` vs KI-FAQ — route to one canonical;
  KIs supply the answers. 🟠
- **Weak/thin:** none among active-KI targets; flag any future state/type page that only renames (thin-content guard).

---

## Gap rollup & top fixes
| Gap class | Count / severity |
|---|---|
| Active KIs isolated in /docs | **50/50** 🔴 (the core gap) |
| Module screens lacking context help | ~11 🔴/🟠 |
| Missing FAQ entries | ~19 🔴/🟠 |
| KI-driven glossary | not live 🔴 (single highest-leverage) |
| Missing internal links | guide/module/cookbook 🟠 |
| Missing CTAs (FAQ/AI → register/module) | 🔴 conversion |
| Missing onboarding help | wizard steps 🔴 |

**Top 3 highest-ROI fixes:** (1) **KI-driven glossary** (surfaces ~42 KIs + search synonyms + tooltips at
once); (2) **in-module context help** for /vouchers, /ledger-heads, /cash-book, /reports, /society-setup
(daily-use moments); (3) **KI-fed FAQ + register CTA** (conversion). Sequenced in
[implementation-roadmap.md](implementation-roadmap.md).

### Cross-references
[Coverage Audit](knowledge-coverage-audit.md) · [Delivery Map](knowledge-delivery-map.md) · [Implementation Roadmap](implementation-roadmap.md) · [Dashboard](knowledge-delivery-dashboard.md)
