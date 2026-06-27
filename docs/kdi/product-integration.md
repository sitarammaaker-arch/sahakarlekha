# Phase 3 — Product Integration Map

> Maps each **active** KI to the concrete **product touchpoints**: module, menu, button, screen, form,
> wizard, reports, notifications, settings, and the user-journey stage where it surfaces. Every target
> is an **existing** route/UI element (no new architecture). The integration mechanism is **context help**:
> tooltips, empty states, and "?" popovers whose text is **generated from the KI** ([KAE 11 API](../kae/11-ai-knowledge-api.md)).

**Integration types:** Tooltip (field-level "?") · Empty-state (first-use explainer) · Help-popover (screen "?") ·
Inline-link (to glossary/guide) · Wizard-step (onboarding) · Report-note (statement footnote).

---

## A. KIs that bind to a transactional module
| KI | Module | Menu | Screen / Form | Integration type | Journey stage |
|---|---|---|---|---|---|
| KI-000055 Voucher | /vouchers | Vouchers | voucher entry form | Empty-state + field tooltip | Daily entry |
| KI-000026 Double-entry | /vouchers | Vouchers | Dr/Cr section | Help-popover | Daily entry |
| KI-000027 Debit | /vouchers | Vouchers | Dr field | Tooltip ("?") | Daily entry |
| KI-000028 Credit | /vouchers | Vouchers | Cr field | Tooltip ("?") | Daily entry |
| KI-000029 Golden rules | /vouchers | Vouchers | entry help-popover | Inline-link → glossary | Learning |
| KI-000047 Journal | /vouchers | Vouchers | journal voucher | Tooltip | Daily entry |
| KI-000039 Transaction | /vouchers | Vouchers | new-voucher empty state | Empty-state | Daily entry |
| KI-000101 Cash book | /cash-book | Cash Book | cash book screen | Empty-state + download link | Daily entry |
| KI-000099 Cash / KI-000100 Cash account | /cash-book | Cash Book | balance header | Tooltip | Daily entry |
| KI-000114 Bank book / KI-000113 Bank account | /bank-book | Bank Book | bank list + "+ नया बैंक" | Empty-state + button help | Setup/Daily |
| KI-000116 Cheque / KI-000118 NEFT-RTGS | /bank-book | Bank Book | payment-mode field | Tooltip | Daily entry |
| KI-000121 Bank statement | /bank-reconciliation | Bank Reconciliation | BRS screen | Empty-state ("upload/compare statement") | Monthly |
| KI-000079 Ledger / KI-000080 Ledger account | /ledger | Ledger | account view | Empty-state + tooltip | Review |
| KI-000048 Posting | /ledger | Ledger | posted-entry hint | Inline-link | Learning |
| KI-000086 Day book | /day-book | Day Book | day book screen | Empty-state | Review |
| KI-000033 Account | /ledger-heads | Ledger Heads | add-account form | Field tooltip + inline-link | Setup |

## B. KIs that bind to members / capital
| KI | Module | Menu | Screen / Form | Integration type | Journey stage |
|---|---|---|---|---|---|
| KI-000004 Member / KI-000131 Membership | /members | Members | member list + add form | Empty-state + tooltip | Setup |
| KI-000134 Nominal member | /members | Members | member-type field | Tooltip | Setup |
| KI-000153 Share / KI-000158 Face value | /share-register | Share Register | share form | Field tooltip | Setup |
| KI-000157 Paid-up capital | /share-register | Share Register | capital column | Report-note | Review |
| KI-000036 Capital | /share-register, /balance-sheet | Reports | capital section | Report-note | Review |

## C. KIs that bind to reports / statements
| KI | Module | Menu | Screen | Integration type | Journey stage |
|---|---|---|---|---|---|
| KI-000212 Read financial reports | /reports, /dashboard | Reports | reports hub | Help-popover + download "read your reports" | Review |
| KI-000034 Asset / KI-000035 Liability | /balance-sheet | Reports | BS sides | Report-note | Review |
| KI-000040 Accounting equation | /balance-sheet | Reports | BS footer | Report-note | Review |
| KI-000037 Income / KI-000038 Expense | /profit-loss | Reports | P&L/I&E rows | Report-note | Review |
| KI-000050 Financial year | /society-setup, all reports | Settings/Reports | FY selector | Tooltip on FY field | Setup |

## D. KIs that bind to setup / onboarding / settings
| KI | Module | Where | Integration type | Journey stage |
|---|---|---|---|---|
| KI-000305 Society setup | /society-setup | setup wizard | **Wizard-step** help on each field | New user (step 1) |
| KI-000009 Society types | /society-setup | type selector | Tooltip + inline-link | New user |
| KI-000050 Financial year | /society-setup | FY field | Tooltip | New user |
| KI-000325 Getting started | /register → /dashboard | onboarding checklist | **Wizard / checklist** | New user |
| KI-000306 Data backup | /backup-restore | Settings → Backup | Empty-state + trust note | Ongoing |
| KI-000049 Accounting cycle | /dashboard | dashboard overview | Help-popover (the year's flow) | Learning |
| KI-000025 Accounting | /dashboard | first-run welcome | Inline-link → guide | New user |

## E. KIs that bind to marketing / acquisition surfaces
| KI | Surface | Element | Integration type | Journey stage |
|---|---|---|---|---|
| KI-000303 Cloud accounting | homepage, /software | hero/benefits | Section copy (from KI) + FAQ | Awareness |
| KI-000322 Why go digital | homepage, /software, landing | benefits block | Section + email + blog | Awareness |
| KI-000010 PACS / KI-000014 Credit / KI-000009 types | /software/:type, /cooperative-software/:state | type/state landing | Section + nav link | Consideration |
| KI-000341 Is free? | homepage, /pricing | pricing/FAQ | FAQ + nav | Consideration |
| KI-000001 Cooperative society / KI-000021 vs company | homepage, /blog | intro/education | Link + blog | Awareness |
| KI-000306 Data backup | homepage | trust strip | Trust badge note | Consideration |

## F. Notifications & emails (KI-driven copy)
| KI | Trigger | Channel |
| --- | --- | --- |
| KI-000325 Getting started | post-register | onboarding email + in-app checklist |
| KI-000305 Society setup | setup incomplete | nudge notification |
| KI-000050 Financial year / KI-000049 cycle | near year-end | seasonal email (reuses live drip) |
| KI-000306 Data backup | periodic | trust/reassurance email |
| KI-000212 Read reports | first report generated | "understand your report" email |

---

## Integration principles (reuse, don't rebuild)
1. **Context-help text is generated from the KI** — one source of truth; never hand-write a second copy.
2. Reuse the KI's `related_module` (already in each KPP record) as the binding target.
3. Empty states and tooltips link to the **glossary KI** + the **guide chapter** in `internal_links`.
4. Onboarding/wizard steps map to the **procedural KIs** (KI-000305, 000325, 000329-type).
5. Report-notes cite the KI's evidence (`EV-`) where a definition appears in a statement.
6. **No module is modified structurally** — only help/empty-state/tooltip slots are populated.

### Cross-references
[Delivery Map](knowledge-delivery-map.md) · [User Journeys](knowledge-user-journeys.md) · [Implementation Roadmap](implementation-roadmap.md) · [SCOS Module Index](../scos/02-knowledge-architecture.md) · [KPP active KIs](../kpp/wave-1-active/00-index.md)
