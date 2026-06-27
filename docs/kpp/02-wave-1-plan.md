# 02 — Wave Plan (~500 Knowledge Items)

> The population roadmap: **which** concepts become KIs, grouped and sequenced into waves. **No
> explanations here** — only the plan. Each group reserves a `KI-` id block; the actual records are
> assigned in [05 — Wave-1 Registry](05-wave-1-registry.md). Every concept maps to a SCOS cluster
> ([SCOS 03](../scos/03-topic-registry.md)) — nothing is invented.

**Sequencing principle:** foundational + low-NEV (Level A) first (acquirable now, no SME), so the
database becomes usable immediately; regulated (B/C/D) concepts follow as the SME clears evidence.

---

## WAVE 1 — Foundations (≈360 KIs · id block KI-000001–000360)

The core spine + glossary + product/help concepts. Mostly Level A/B; the educational layer can go
`active` without SME ([KAE 10](../kae/10-content-readiness-engine.md)).

| Grp | Group | Id block | ~Count | SCOS domain | Default readiness |
| --- | --- | --- | --- | --- | --- |
| G01 | Cooperative Basics | KI-000001–000024 | 24 | D01 | A (C005/C010 → D) |
| G02 | Accounting Foundations | KI-000025–000054 | 30 | D03 | A/B |
| G03 | Voucher Concepts | KI-000055–000078 | 24 | D04 | A/B |
| G04 | Ledger & Chart of Accounts | KI-000079–000098 | 20 | D03/D04 | A/B |
| G05 | Cash | KI-000099–000112 | 14 | D11 | A |
| G06 | Bank | KI-000113–000130 | 18 | D11 | A/B |
| G07 | Members | KI-000131–000152 | 22 | D06 | A (law → D) |
| G08 | Share Capital | KI-000153–000166 | 14 | D06 | A/B (law → D) |
| G09 | Reserve Funds & Profit | KI-000167–000184 | 18 | D19 | B (statutory → D) |
| G10 | Trial Balance | KI-000185–000196 | 12 | D05 | A/B |
| G11 | Financial Statements | KI-000197–000226 | 30 | D05 | B (format → C) |
| G12 | Balance Sheet (detail) | KI-000227–000240 | 14 | D05 | B |
| G13 | Audit Basics | KI-000241–000262 | 22 | D16 | A (process → C/D) |
| G14 | Glossary (core terms) | KI-000263–000302 | 40 | cross | A |
| G15 | Software / SaaS Concepts | KI-000303–000324 | 22 | D22/product | A |
| G16 | Help / Onboarding Concepts | KI-000325–000340 | 16 | D26 | A |
| G17 | FAQ Concepts | KI-000341–000356 | 16 | cross | A |

**Wave-1 total: ~356 KIs.**

## WAVE 2 — Operations (≈90 KIs · id block KI-000361–000450)

Transaction-heavy domains; many corroborated by `/cookbook` + modules, evidence then SME for treatments.

| Grp | Group | Id block | ~Count | SCOS domain |
| --- | --- | --- | --- | --- |
| G18 | Inventory & Stock | KI-000361–000378 | 18 | D09 |
| G19 | Sales & Purchase | KI-000379–000392 | 14 | D10 |
| G20 | Loans, KCC & Recovery | KI-000393–000410 | 18 | D07 |
| G21 | Deposits & Savings | KI-000411–000420 | 10 | D08 |
| G22 | Assets & Depreciation | KI-000421–000432 | 12 | D12 |
| G23 | Banking & Reconciliation (depth) | KI-000433–000442 | 10 | D11 |
| G24 | Payroll & HR | KI-000443–000450 | 8 | D13 |

## WAVE 3 — Compliance, Governance, Sector & State (≈100 KIs · id block KI-000451–000550)

Highest-NEV; gated on SME + primary law. Built per `concept_key` with jurisdiction variants.

| Grp | Group | Id block | ~Count | SCOS domain |
| --- | --- | --- | --- | --- |
| G25 | GST | KI-000451–000466 | 16 | D14 |
| G26 | TDS & Income Tax (80P) | KI-000467–000480 | 14 | D15 |
| G27 | Compliance & Statutory Returns | KI-000481–000494 | 14 | D17 |
| G28 | Governance, AGM & Elections | KI-000495–000510 | 16 | D18 |
| G29 | Profit Distribution (depth) | KI-000511–000520 | 10 | D19 |
| G30 | Society-type specifics | KI-000521–000536 | 16 | D02 |
| G31 | State-wise legal variants | KI-000537–000546 | 10+ | D24 |
| G32 | Digital / AI concepts | KI-000547–000550 | 4 | D21/D23 |

**Grand total (Waves 1–3): ≈546 KIs (~500 target ✓).** Expansion (per-state `concept_key` variants,
society-type×topic) grows organically beyond this without new architecture.

---

## Group → seed concept lists (the roadmap; NOT definitions)

> Concept names only — what each KI will capture. Decomposed atomically per [03](03-population-rules.md).

- **G01 Cooperative Basics:** cooperative society, cooperative principles, values, member, byelaws,
  registration, RCS, MSCS Act, society types (overview), PACS, dairy/consumer/marketing/credit/housing/
  labour/processing/federation, member rights, member duties, cooperative vs company.
- **G02 Accounting Foundations:** accounting, double-entry, debit, credit, golden rules (3), account,
  asset, liability, capital, income, expense, transaction, accounting equation, accrual vs cash,
  going concern, books of account, journal, posting, accounting cycle, financial year, opening balance,
  closing balance, accounting period.
- **G03 Voucher Concepts:** voucher, receipt voucher, payment voucher, journal voucher, contra voucher,
  compound voucher, narration, voucher number/series, supporting document, maker-checker, voucher
  approval, cancellation/soft-delete, debit note, credit note, voucher date, backdated entry.
- **G04 Ledger & COA:** ledger, ledger account, chart of accounts, account group, account head, control
  account, subsidiary ledger, day book, posting, balancing, ledger folio, group summary, account code,
  standard COA, sub-ledger (members/loans/suppliers/customers).
- **G05 Cash:** cash, cash book, cash account, cash-in-hand, cash receipt, cash payment, petty cash,
  cash limit, denomination, cash verification, imprest, cash discrepancy.
- **G06 Bank:** bank, bank account, bank book, deposit slip, cheque, DD, NEFT/RTGS/UPI, passbook,
  bank statement, bank reconciliation, BRS difference, stale cheque, multi-bank, bank charges.
- **G07 Members:** membership, admission, nominal member, associate member, member register, member
  ledger, exit/resignation, expulsion, nomination, nominee, transmission, Form-1 member list, entrance
  fee, member dues, dormant member, defaulter, share certificate, membership eligibility.
- **G08 Share Capital:** share, share capital, authorised/issued/paid-up, face value, share issue,
  share transfer, share refund, share register, redeemable shares, dividend on shares.
- **G09 Reserve & Profit:** net profit/surplus, appropriation, reserve fund, statutory reserve,
  education fund, building/other funds, dividend, patronage bonus, undistributed surplus, carry forward,
  deficit, provision, reserve fund investment.
- **G10 Trial Balance:** trial balance, debit/credit columns, agreement (Dr=Cr), suspense account,
  TB error types, TB to statements, opening TB, adjusted TB.
- **G11 Financial Statements:** trading account, gross profit, P&L, income & expenditure, net result,
  receipts & payments, balance sheet, schedules, comparative statements, final accounts, direct/indirect
  expense, operating income, statement format (NEV), report→form map.
- **G12 Balance Sheet:** assets side, liabilities side, fixed/current assets, current/long-term
  liabilities, capital & reserves, contingent liability, fund-based BS, accounting equation in BS.
- **G13 Audit Basics:** audit, statutory/cooperative audit, internal audit, concurrent audit, auditor,
  audit period, audit report, audit certificate, audit classification/grade, audit memo, objection,
  rectification, audit trail, vouching, verification.
- **G14 Glossary:** core Hindi–English terms spanning all domains (single-term KIs).
- **G15 Software/SaaS:** cloud accounting, SaaS, data backup, restore, import, export, user role,
  permission, FY-lock, multi-society, dashboard, audit log, optimistic save/rollback (product
  invariant), report export, society setup.
- **G16 Help/Onboarding:** getting started, society setup steps, first voucher, add member (task),
  opening balance entry (task), view trial balance, generate report, year-end close (task).
- **G17 FAQ Concepts:** the highest-frequency questions as atomic KIs (one Q-concept each).

---

### Cross-references
[KI Schema](01-knowledge-item-schema.md) · [Population Rules](03-population-rules.md) · [Wave-1 Registry](05-wave-1-registry.md) · [Knowledge Relationships](04-knowledge-relationships.md) · [SCOS Topic Registry](../scos/03-topic-registry.md)
