# Phase 1 — Knowledge Coverage Audit

> For every **active** KI (50, Wave-1A): where it is **currently** surfaced in the product, what is
> **missing**, and the priority/impact/difficulty of closing the gap. Grounded in the real repo
> (guide/blog/help/cookbook/faq/search/ask + ~95 modules).

**Honest baseline:** the 50 KIs are **documentation records today**. Many of their *concepts* are already
covered by existing **guide chapters / cookbook recipes / modules** (Tier-5 corroboration) — but the **KI
layer itself is not yet wired** into glossary, tooltips, FAQ, Ask-AI grounding, or search. So "Current
usage" cites the existing surface that touches the concept; "Missing usage" lists KI-driven surfaces.

**Cols:** KI · Current usage (existing surface) · Missing usage (KI-driven) · Pri · Impact · Difficulty · Recommended first destination
**Pri/Impact:** P0–P2 / High-Med-Low · **Difficulty:** S(mall)/M(edium)/L(arge)

---

## A. Cooperative Basics
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000001 Cooperative society | /guide/introduction; /software | glossary, FAQ, Ask-AI, search synonym, homepage intro | P0 | High | S | Glossary + FAQ |
| KI-000002 Cooperative principles | /guide/introduction | glossary, FAQ, blog link | P1 | Med | S | FAQ |
| KI-000004 Member | /guide/member-management; /members | glossary, tooltip on /members, Ask-AI | P0 | High | S | Context help (/members) |
| KI-000007 RCS | /guide/society-setup-and-roles | glossary, FAQ, Ask-AI | P1 | Med | S | Glossary |
| KI-000009 Society types | /software; /guide/society-type-entries | glossary, /software/:type link, setup tooltip | P0 | High | M | /society-setup help |
| KI-000010 PACS | /software/pacs; guide | glossary, state/type landing link, Ask-AI | P0 | High | M | /software/:type |
| KI-000014 Credit society | /software; guide | glossary, /software/:type, Ask-AI | P1 | Med | M | /software/:type |
| KI-000021 Cooperative vs company | /guide/introduction | FAQ, blog, glossary | P1 | Med | S | FAQ |

## B. Accounting Foundations
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000025 Accounting | /guide/accounting-foundations | glossary, FAQ, Ask-AI, search | P0 | High | S | Glossary |
| KI-000026 Double-entry | /guide/accounting-foundations,/golden-rules | glossary, tooltip on /vouchers, Ask-AI | P0 | High | S | Context help (/vouchers) |
| KI-000027 Debit | /guide/golden-rules | glossary, voucher-form tooltip, search synonym | P0 | High | S | Tooltip (/vouchers) |
| KI-000028 Credit | /guide/golden-rules | glossary, voucher-form tooltip, search synonym | P0 | High | S | Tooltip (/vouchers) |
| KI-000029 Golden rules | /guide/golden-rules | glossary, FAQ, Ask-AI | P1 | Med | S | FAQ |
| KI-000033 Account | /guide/chart-of-accounts; /ledger-heads | glossary, tooltip on /ledger-heads | P0 | High | S | Context help (/ledger-heads) |
| KI-000034 Asset | /guide/balance-sheet; /balance-sheet | glossary, report tooltip | P1 | Med | S | Glossary |
| KI-000035 Liability | /guide/balance-sheet | glossary, report tooltip | P1 | Med | S | Glossary |
| KI-000036 Capital | /guide/balance-sheet; /share-register | glossary, report tooltip | P1 | Med | S | Glossary |
| KI-000037 Income | /guide/income-and-expenditure; /profit-loss | glossary, report tooltip | P1 | Med | S | Glossary |
| KI-000038 Expense | /guide/expense-dictionary; /profit-loss | glossary, report tooltip | P1 | Med | S | Glossary |
| KI-000039 Transaction | /guide/accounting-foundations; /vouchers | glossary, Ask-AI | P1 | Med | S | Glossary |
| KI-000040 Accounting equation | /guide/balance-sheet | glossary, FAQ, /balance-sheet empty state | P1 | Med | S | FAQ |
| KI-000046 Books of account | /guide/daybook-and-ledger | glossary, Ask-AI | P1 | Med | S | Glossary |
| KI-000047 Journal | /guide/daybook-and-ledger; /vouchers | glossary, tooltip | P2 | Med | S | Glossary |
| KI-000049 Accounting cycle | /guide/accounting-foundations; case-study | FAQ, onboarding step, Ask-AI | P1 | Med | M | Onboarding |
| KI-000050 Financial year | /guide/year-end-and-fy-lock; /society-setup | glossary, setup tooltip, FAQ | P0 | High | S | Context help (/society-setup) |

## C. Vouchers, Ledger & Books
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000055 Voucher | /guide/voucher-types; /vouchers; /help first-voucher | glossary, tooltip, Ask-AI, search | P0 | High | S | Context help (/vouchers) |
| KI-000048 Posting | /guide/daybook-and-ledger; /ledger | glossary, Ask-AI | P2 | Low | S | Glossary |
| KI-000079 Ledger | /guide/daybook-and-ledger; /ledger; /help add-ledger | glossary, tooltip on /ledger | P0 | High | S | Context help (/ledger) |
| KI-000080 Ledger account | /ledger; /help view | glossary, tooltip | P1 | Med | S | Glossary |
| KI-000086 Day book | /guide/daybook-and-ledger; /day-book | glossary, /day-book empty state | P2 | Med | S | Context help (/day-book) |
| KI-000099 Cash | /guide/receipts-and-payments; /cash-book | glossary | P1 | Med | S | Glossary |
| KI-000101 Cash book | /guide/receipts-and-payments; /cash-book; /help cash-book | glossary, /cash-book empty state, download | P0 | High | S | Context help (/cash-book) |

## D. Cash Account & Bank
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000100 Cash account | /cash-book | glossary, tooltip | P2 | Low | S | Glossary |
| KI-000113 Bank account | /bank-book; /help (bank) | glossary, /bank-book "+ नया बैंक" help | P1 | Med | S | Context help (/bank-book) |
| KI-000114 Bank book | /guide/receipts-and-payments; /bank-book | glossary, empty state | P1 | Med | S | Context help (/bank-book) |
| KI-000116 Cheque | /bank-book | glossary, FAQ | P2 | Low | S | Glossary |
| KI-000118 NEFT/RTGS | /bank-book | glossary, FAQ | P2 | Low | S | Glossary |
| KI-000121 Bank statement | /bank-reconciliation; /help bank-reconciliation | glossary, BRS empty-state help | P1 | Med | S | Context help (/bank-reconciliation) |

## E. Members & Share Capital
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000131 Membership | /guide/member-management; /members | glossary, tooltip, FAQ | P1 | Med | S | Glossary |
| KI-000134 Nominal member | /members | glossary, member-form tooltip | P2 | Low | S | Tooltip (/members) |
| KI-000153 Share | /guide/member-management; /share-register | glossary, tooltip | P1 | Med | S | Glossary |
| KI-000157 Paid-up capital | /share-register; /balance-sheet | glossary, report tooltip | P1 | Med | S | Glossary |
| KI-000158 Face value | /share-register | glossary, share-form tooltip | P2 | Low | S | Tooltip (/share-register) |

## F. Financial Statements
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000212 How to read financial reports | /guide/financial-ratios-and-lifecycle; /reports | FAQ, /reports help, Ask-AI, download | P0 | High | M | Context help (/reports) |

## G. Software / SaaS Concepts
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000303 Cloud accounting | /software | homepage, FAQ, /software section, Ask-AI | P0 | High | S | FAQ + homepage |
| KI-000305 Society setup | /society-setup; /help society setup | onboarding wizard help, empty state | P0 | High | M | Onboarding |
| KI-000306 Data backup | /guide/data-security-and-backup; /backup-restore | FAQ, /backup-restore help, homepage trust | P0 | High | S | FAQ (trust) |
| KI-000322 Why go digital | /software; /blog | homepage, landing, email, /software | P0 | High | M | Homepage/landing |

## H. Help / FAQ Concepts
| KI | Current usage | Missing usage | Pri | Impact | Diff | Recommended first |
|---|---|---|---|---|---|---|
| KI-000325 Getting started | /guide/quick-start; /register | onboarding, homepage CTA, Ask-AI | P0 | High | M | Onboarding |
| KI-000341 Is SahakarLekha free? | /pricing | FAQ, homepage, Ask-AI, /software | P0 | High | S | FAQ + homepage |

---

## Coverage summary (active KIs = 50)
- **Concept covered by an existing surface (guide/cookbook/module):** ~50/50 (≈100%) — the *topics* exist in product content.
- **KI-layer wired into product (glossary/tooltip/FAQ/AI/search as a KI):** **0/50 (0%)** today — the integration gap.
- **Quick wins (Difficulty S, Impact High, P0):** KI-000001, 026, 027, 028, 033, 050, 055, 079, 101, 303, 306, 341 → glossary + context help + FAQ.
- **Biggest impact destinations:** **Glossary** (covers ~40 KIs), **Context help/tooltips** (~20 module KIs), **FAQ** (~12), **Ask-AI grounding** (all 50), **Search synonyms** (all term KIs).

> **Read-out:** the cheapest, highest-impact first move is a **KI-driven glossary + in-module context help
> + FAQ**, because one glossary build surfaces ~40 KIs at once. Full plan in
> [implementation-roadmap.md](implementation-roadmap.md).

### Cross-references
[Delivery Map](knowledge-delivery-map.md) · [Product Integration](product-integration.md) · [Content Gap Audit](content-gap-audit.md) · [Dashboard](knowledge-delivery-dashboard.md) · [KPP active KIs](../kpp/wave-1-active/00-index.md)
