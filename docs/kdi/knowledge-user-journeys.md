# Phase 6 — Knowledge User Journeys

> How the **active** KIs surface along real user journeys — so knowledge appears *at the moment of need*,
> not buried in docs. Each step names the **KI** delivered and the **surface** it appears on (all existing).
> Personas use [SCOS 05](../scos/05-personas.md) codes.

---

## 1. New User Journey (first-run)
| Step | Need | KI delivered | Surface |
|---|---|---|---|
| Land on homepage | "what is this / is it free?" | KI-000303 cloud, KI-000341 free, KI-000322 why-digital | homepage, FAQ |
| Register | "how do I start?" | KI-000325 getting started | /register, onboarding email |
| Society setup | "what type / which FY?" | KI-000305 setup, KI-000009 types, KI-000050 FY | wizard tooltips |
| Add accounts | "what is an account/ledger?" | KI-000033 account, KI-000079 ledger | /ledger-heads context help |
| Add members | "who is a member?" | KI-000004 member, KI-000131 membership | /members empty state |
| First voucher | "what is a voucher / Dr-Cr?" | KI-000055 voucher, KI-000026/27/28 | /vouchers empty state + tooltips |
| See first report | "how do I read this?" | KI-000212 read reports | /reports help-popover |

## 2. Secretary Journey (SEC)
Setup & run the society → KI-000305 setup, KI-000009 types, KI-000050 FY, KI-000004 member,
KI-000131 membership, KI-000007 RCS, KI-000306 backup. Surfaces: society-setup wizard, /members,
/backup-restore, glossary, FAQ. Compliance specifics (returns, audit) are **NEV → deferred to CA/RCS**.

## 3. Accountant Journey (ACC)
Daily books → KI-000055 voucher, KI-000026 double-entry, KI-000027/28 Dr/Cr, KI-000079 ledger,
KI-000080 ledger account, KI-000048 posting, KI-000101 cash book, KI-000114 bank book, KI-000121
bank statement. Surfaces: /vouchers, /ledger, /cash-book, /bank-book, /bank-reconciliation context help +
glossary. Treatments (depreciation, GST entries) are **B/NEV → deferred** pending SME.

## 4. Auditor Journey (AUD)
Verify & trust the books → KI-000079 ledger, KI-000080 account, KI-000040 accounting equation,
KI-000034/35/36 asset/liability/capital, KI-000121 bank statement, KI-000050 FY. Surfaces: /ledger,
/balance-sheet, /reports report-notes, glossary. Audit grading/objections are **C-D/NEV → deferred**.

## 5. Chairman / Board Journey (CHR)
Understand health & decide → KI-000212 read reports, KI-000034/35/36 asset/liability/capital,
KI-000040 equation, KI-000001 society, KI-000021 vs company, KI-000322 why-digital. Surfaces:
/dashboard, /reports help-popover, blog, FAQ. Dividend/reserve %= **D/NEV → deferred**.

## 6. Manager / CEO Journey (MGR)
Operate & monitor → KI-000212 read reports, KI-000049 accounting cycle, KI-000303 cloud,
KI-000306 backup, KI-000322 why-digital. Surfaces: /dashboard, /reports, settings. NPA/recovery/budget
treatments are later waves.

## 7. Learning Journey (upskilling)
Guided path via glossary + guide, prerequisite-ordered ([KPP 04 graph](../kpp/04-knowledge-relationships.md)):
KI-000025 accounting → 000026 double-entry → 000027/28 Dr/Cr → 000029 golden rules → 000033 account →
000055 voucher → 000079 ledger → trial balance* → 000040 equation → 000034/35/36 → 000212 read reports.
Surfaces: /guide chapters, glossary, /ask, quizzes.

## 8. Problem-Solving Journey
| Problem | KI delivered | Surface |
|---|---|---|
| "Dr/Cr confusing" | KI-000027, 000028, 000026, 000029 | tooltip + glossary + /ask |
| "what's cash book vs bank book?" | KI-000101, 000114, 000099, 000113 | glossary + /ask |
| "bank balance doesn't match" | KI-000121 statement, bank reconciliation* | /bank-reconciliation help |
| "how do I read the balance sheet?" | KI-000212, 000034/35, 000040 | /reports help-popover |
| "where do I add a member/bank?" | KI-000004, 000113 | /members, /bank-book help |
> Entry points: `/search`, `/ask`, in-module "?" help.

## 9. Software Adoption Journey (BUY/CHR)
Awareness → KI-000322 why-digital, KI-000303 cloud, KI-000001 society;
Consideration → KI-000341 free, KI-000009/010/014 types/PACS/credit, KI-000306 backup (trust);
Decision → KI-000325 getting started, KI-000305 setup. Surfaces: homepage, /software, /software/:type,
/cooperative-software/:state, /pricing, FAQ, email.

---

## Journey design principles
1. **Knowledge at point of need** — the KI surfaces on the screen where the question arises (context help), not only in docs.
2. **Prerequisite ordering** — learning paths follow the [KPP relationship graph](../kpp/04-knowledge-relationships.md).
3. **Defer the regulated** — any B/C/D/NEV need in a journey is answered as concept + "verify with CA/RCS", never as a fabricated specific.
4. **Every journey ends in action** — a module CTA (the KI's `related_module`).
5. **Reuse surfaces** — guide/help/glossary/ask/modules already exist; journeys route the KIs through them.

### Cross-references
[Product Integration](product-integration.md) · [Ask-AI Map](ask-ai-map.md) · [Implementation Roadmap](implementation-roadmap.md) · [SCOS Personas](../scos/05-personas.md) · [KPP Relationships](../kpp/04-knowledge-relationships.md)
