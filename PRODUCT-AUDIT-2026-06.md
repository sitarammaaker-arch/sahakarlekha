# SahakarLekha Codebase Audit vs. Constitution & Delivery Framework

**Date:** 2026-06-26 · **Method:** parallel read-only code exploration (file:line evidence) · **Scope:** full repo audited against `CONSTITUTION.md` (Laws L1–L14) and `DELIVERY-FRAMEWORK.md`. · **Status:** roadmap approved 2026-06-26. **✅ Phase 0 (P0 data-integrity remediation) IMPLEMENTED 2026-06-26** — see §0 below. This is a point-in-time document — re-verify against current code before acting on any single file:line.

## 0. Phase 0 Status — ✅ DONE (2026-06-26)

Data-integrity remediation complete in `src/contexts/DataContext.tsx`; build green. All changes reuse existing in-repo patterns (L11). **Not yet committed** (awaiting approval).
- **L5 (FY-lock):** `guardFYLocked()` added to **29** previously-unguarded mutations (the 27 in §3 P0-2 plus `clearVoucher`/`unclearVoucher`).
- **L1 (rollback):** visible rollback + ≥12s destructive Hinglish toast added to **17** paths — 5 voucher status-changes, 8 `update*`, `updateSalaryRecord`, and the 3 stock-item paths (`persistStockItem` gained an `onBaseFail` hook).
- **L3 (cascade):** `deleteLoan` soft-cancels the disbursement voucher; `deleteAsset` soft-cancels depreciation journals (matched by unique `loanNo`/`assetNo`). The audit's `deleteMember` and `deleteStockItem` items were re-verified as **non-issues** (members have no per-member sub-ledger; stock delete already reverses closing-stock asset) — left unchanged.
- **Verification:** `npm run build` passes. Runtime failure-path testing (induced Supabase failure / locked FY / delete-with-dependents) NOT yet exercised — compile/inspection only.

> **Headline finding.** The supreme law (**L1**) is only ~41% enforced and the audit-lock (**L5**) has ~24 holes. Every `update*` function and every voucher status-change (clear/approve/reject/restore) does an optimistic local update with **no rollback** on cloud-save failure — the exact "लोकल में सेव हो रहा है, Supabase में नहीं" data-loss mode RULE 1 / Law L1 exists to prevent. This outranks all feature work (tie-breaker: data integrity first).

---

## 1. Compliance Scorecard

| Law / Principle | Status | Evidence |
|---|---|---|
| **L1 — Two-step persist + rollback** | 🔴 PARTIAL (~41%) | `persistVoucher` (DataContext.tsx:793) is the gold standard. **All `update*` lack rollback** (`updateMember`:1473, `updateLoan`:1962, `updateAsset`:1997, `updateAccount`:1586, `updateEmployee`:3169, `updateSalaryRecord`:3206, `updateRecoverable`:1374, `updateKachiAaratEntry`:1405, `updateAuditObjection`:1342). **Voucher status changes optimistic, no rollback** (`clearVoucher`:1283, `unclearVoucher`:1291, `approveVoucher`:1299, `rejectVoucher`:1311, `restoreVoucher`:1242). **Stock items no `onBaseFail`** (`persistStockItem`:2401; add/update/delete). P7 entries no rollback. |
| **L2 — Report formula parity** | 🟢 COMPLIANT | Canonical stock formula `stockUtils.ts:18` matches Inventory, ClosingStockReport, `getTradingAccount`:2195. |
| **L3 — Cascade on delete** | 🟡 MOSTLY | Good: sales/purchases/members/suppliers/customers. Gaps: `deleteLoan`:1971 (orphan disbursement voucher), `deleteAsset`:2006 (orphan depreciation vouchers), `deleteStockItem`:2456 (orphan sales/purchases), member delete (orphan sub-ledger account). |
| **L4 — isDeleted filtering** | 🟢 COMPLIANT | All aggregators filter `!v.isDeleted` (getTrialBalance:1819, getTradingAccount:2207, etc.). Page-level not exhaustively verified. |
| **L5 — FY-lock guard** | 🔴 PARTIAL | `guardFYLocked`:188 present on vouchers/deletes. ~24 mutations missing it: `postDepreciation`:2017, `postClosingStock`:2315, `addSale`:2531, `addPurchase`:2830, stock add/update/movement, member/loan/asset/employee/salary add+update, suppliers/customers add+update, audit objections, recoverables, kachi aarat, P7. |
| **L7 — One canonical node / no duplication** | 🔴 VIOLATED | 9 topics exist as both guide chapter AND blog post (voucher-entry, audit-prep, financial-reports, accounting-basics, inventory, member/share, profit-distribution, common-mistakes, +). 0/9 cross-link. |
| **KO model / Knowledge Graph (Art VI)** | 🔴 ABSENT | 5 siloed shapes (GuideEntry, BlogPost, FAQItem, SocietyType, StateInfo); no shared envelope, no edges. |
| **DO layer / Help Center (Art V)** | 🔴 ABSENT | `/help` redirects to `/guide` (App.tsx:204). No task articles, no deep-link CTAs. |
| **Search First (Art III.5)** | 🟡 GUIDE-ONLY | `guideSearch.ts` solid but guide-only; no site-wide, no synonyms/Devanagari-fuzzy. |
| **Contextual help (Art VII.4)** | 🔴 MINIMAL | FeedbackFab = feedback not help; no per-screen "?" → article. |
| **AI / Intelligence (Art VIII)** | 🔴 ABSENT | No copilot/RAG/"Ask", no llms.txt, no TL;DR/atomic-answer convention. |
| **SEO / structured data (Art IX)** | 🟢 STRONG | Prerender (guide/blog/software/states); correct Article+BreadcrumbList; no deprecated HowTo; 47 redirects; apex canonical. Minor: `/faq` lacks FAQPage schema; software WebPage schema incomplete; sitemap hand-maintained (drift risk). |
| **Analytics — PLG measurability** | 🟡 MARKETING-ONLY | 7 GA4 events (lead/feedback/CTA). Zero in-app product events; activation/retention/PLG-conversion unmeasured. |

**Net:** the public/marketing/SEO half is in excellent shape. The data-integrity core and the knowledge-ecosystem + intelligence halves have concrete gaps; L1 and L5 are live risks.

## 2. Gap Analysis by Severity

**🔴 Critical (supreme-law violations — data integrity):**
1. Rollback missing on ~28 mutations (L1) → silent data loss on failed cloud save.
2. FY-lock guard missing on ~24 mutations (L5) → financial mutation during audit lock.
3. Cascade gaps on loan/asset/stock/member deletes (L3) → orphan vouchers & ghost balances.

**🟠 High (knowledge integrity + measurability):**
4. Guide↔blog duplication, zero cross-links (L7).
5. No in-app analytics → cannot measure activation/PLG/retention.
6. No KO model / graph → no foundation for future knowledge features.

**🟡 Medium (the missing ecosystem):**
7. No Help Center / DO layer + no deep-link CTAs (PLG loop absent).
8. No site-wide search; no synonyms/Devanagari.
9. No contextual in-app help.
10. Missing REFERENCE moats: Entry Cookbook, Formats, Compliance.

**🟢 Low (polish + AI seeds):**
11. `/faq` FAQPage schema; software WebPage schema.
12. llms.txt + TL;DR convention.
13. Auto-generate sitemap.
14. AI copilot / Intelligence layer (Year-2).

## 3. Prioritized Backlog (classified per Framework §12)

**P0 — Data-Integrity Remediation (T1–T2 + data-integrity modifier; before any new feature):**
- **P0-1** Visible rollback on all `update*` + voucher status-change + stock-item functions — reuse the `persistVoucher`/`onBaseFail` pattern (L1, L11). *T2 + integrity.*
- **P0-2** `guardFYLocked()` on the ~24 unguarded mutations (exclude `updateSociety`). *T1 + integrity.* (L5)
- **P0-3** Complete cascades: loan→disbursement voucher, asset→depreciation vouchers, stock-item→orphan check, member→sub-ledger rename. *T2 + integrity.* (L3)

**P1 — Measurement + SEO/AI hygiene + Canonical fix (T0–T2):**
- **P1-1** In-app analytics events (activation funnel) — prerequisite to measure PLG.
- **P1-2** Cross-link the 9 guide↔blog overlaps + canonical-by-intent (fixes L7).
- **P1-3** `/faq` FAQPage schema + complete software WebPage schema.
- **P1-4** `llms.txt` + TL;DR/atomic-answer convention.
- **P1-5** Auto-generate `sitemap.xml` at build.

**P2 — Knowledge Ecosystem Foundation:**
- **P2-1** Knowledge Object model + edge taxonomy (the graph spine). *T4 + knowledge.*
- **P2-2** Help Center MVP: 10 tasks + deep-link CTAs. *T3 + knowledge + PLG.*
- **P2-3** Entry Cookbook (~40 entries incl. HAFED/PACS). *T3 + knowledge.*
- **P2-4** Site-wide fuzzy search (Devanagari↔roman, glossary-seeded synonyms). *T3.*
- **P2-5** Contextual in-app help (helpKey per screen → article). *T3 + knowledge.*

**P3 — Intelligence + Depth (Year 2+):**
- **P3-1** AI copilot / "Ask" — RAG grounded, cite-always, never-fabricate. *T4 + AI.*
- **P3-2** Formats & Templates library; Compliance library (Haryana, governed). *T3 + compliance.*
- **P3-3** Society-Type Playbooks; video; interactive walkthroughs. *T2–T3.*

## 4. Roadmap

- **Phase 0 — Stop the bleeding (P0):** data-integrity remediation. Non-skippable; supreme-law violations with live risk.
- **Phase 1 — Measure & tidy (P1):** in-app analytics, L7 cross-links, small SEO/AI debts. Cheap, high-leverage.
- **Phase 2 — Build the foundation (P2):** KO model + graph first, then Help Center + deep-link CTAs, Entry Cookbook, site-wide search, contextual help.
- **Phase 3 — Intelligence (P3, Year 2+):** AI copilot on the populated graph, REFERENCE depth, playbooks, media.

Maps to the Constitution's 5-year vision: Phase 0–2 = Year 1; Phase 3 = Year 2.

## 5. Stack Reference (for future work)

Vite + React 18 + React Router 6, Radix/shadcn UI, Supabase (RLS + JWT-less platform-admin via SECURITY DEFINER RPCs), jsPDF, TanStack Query + Context. State in `src/contexts/DataContext.tsx`. Build runs `vite build` then `scripts/prerender-guide.mjs`. ~79 authenticated app screens (deep-link targets for Help CTAs exist: /members, /vouchers, /trial-balance, /bank-book, etc.). Migrations `supabase/migrations/001–005`. Toasts: radix `useToast` from `@/hooks/use-toast` renders reliably (sonner present but the memory notes radix is the visible one).
