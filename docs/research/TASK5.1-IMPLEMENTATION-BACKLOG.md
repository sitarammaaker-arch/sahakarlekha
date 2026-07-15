# SahakarLekha Product Planning 5.1 — Implementation Backlog

**Source:** Approved Phase-1/2/3 research + Phase-4 blueprints only. No new features except where marked **[Optional]**. **Priority:** P0 (must, blocks others) · P1 (core) · P2 (important) · P3 (later). **Complexity:** S/M/L/XL. Story field order: Goal · Value · Acceptance criteria (key) · Dependencies · Priority · Complexity · Sprint.

## Epic map
| Epic | Scope | Depends on |
|---|---|---|
| **E1 Platform Foundation** | Multi-tenancy, auth, RBAC, audit trail, FY, config | — |
| **E2 Accounting Core** | COA, voucher engine, GL, TB, statements | E1 |
| **E3 Member & Capital** | Member, share capital, dividend | E1, E2 |
| **E4 Cash & Bank** | Receipts, payments, contra, reconciliation | E2 |
| **E5 Credit** (Credit types) | Loans, deposits, DCB, NPA | E2, E3 |
| **E6 Trading** (Trading types) | Procurement, inventory, sales | E2 |
| **E7 Payroll & Assets** | Payroll, fixed assets, depreciation | E2 |
| **E8 Compliance & Tax** | GST/TDS, statutory calendar, audit prep | E2 |
| **E9 Reporting & BI** | Statutory reports, dashboards, alerts | E2 |
| **E10 Verticals** | Dairy, Housing, Marketing, Labour, Industrial, Consumer specifics | E2–E6 |
| **E11 Integrations** | Bank, GST, migration (Excel/Tally), NABARD-NLDR | E2, E8 |
| **E12 Reliability & Offline** | Backup/DR, offline-first field capture, sync | E1, E2 |
| **E13 Notifications & Documents** | Alerts, document management | E1 |
| **E14 AI Readiness** [Optional/Deferred] | Event stream, data foundation | E2 |

---

## E1 — Platform Foundation
| # | User story (Goal) | Value | Acceptance criteria (key) | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 1.1 | Multi-tenant society isolation | Each society's data is private | Tenant scope enforced on every entity; no cross-tenant read/write; society-type set | — | P0 | L | 1 |
| 1.2 | User authentication | Secure login | Email/mobile+password; lockout on failures; platform-admin via controlled RPC (JWT-less) | 1.1 | P0 | M | 1 |
| 1.3 | RBAC (17 roles × 14 permissions) | Least privilege | Role assignment; permission checks scoped by tenant/branch/module | 1.2 | P0 | L | 1–2 |
| 1.4 | Segregation of duties enforcement | Fraud prevention | Entry≠approval≠audit≠config enforced; violations blocked | 1.3 | P0 | M | 2 |
| 1.5 | Immutable audit trail | Non-repudiation | Every create/update/delete/approve logged (who/what/when/before/after/reason); append-only | 1.1 | P0 | L | 2 |
| 1.6 | Financial Year + lock/unlock | Period integrity | Apr–Mar default configurable; lock on close; dual-control unlock; FY-lock blocks mutation | 1.1 | P0 | M | 2 |
| 1.7 | MFA for privileged roles | Sensitive-action security | MFA required for Admin/Chairman/Secretary + unlock/FY-close | 1.2 | P1 | M | 2 |
| 1.8 | Per-society configuration | State/type variation w/o forks | Reserve %, dividend cap, forms, thresholds as effective-dated config | 1.1 | P1 | M | 2 |

## E2 — Accounting Core
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 2.1 | Chart of Accounts (template + extension) | Ledger foundation | 5-class coded COA; CAS heads for PACS; per-society extension; unique codes | E1 | P0 | L | 3 |
| 2.2 | Voucher engine (types + lifecycle) | Capture all events | Receipt/Payment/Journal/Contra; Draft→…→Locked; balanced; post on approval | 2.1, 1.6 | P0 | XL | 3–4 |
| 2.3 | Gap-free voucher numbering | Audit continuity | Serial per type/FY/branch; no gaps/dupes | 2.2 | P0 | S | 3 |
| 2.4 | GL posting + per-item routing | Correct ledger | Txn→voucher→GL; routing (default 4101/5101); control-account update | 2.2 | P0 | L | 4 |
| 2.5 | **Data-integrity save contract (rollback)** | No silent data loss | Two-step persist; on cloud-fail → rollback + destructive alert; no divergence | 2.2 | P0 | L | 3–4 |
| 2.6 | Trial Balance (single computation layer) | Books balance | Sum ledgers; Dr=Cr; one canonical formula reused by all reports | 2.4 | P0 | M | 4 |
| 2.7 | Voucher reversal + soft-cancel | Correct without deletion | Reversal ties to original; reason mandatory; cascade; no hard delete | 2.2 | P0 | M | 4 |
| 2.8 | Opening-balance carry (audited closing) | Continuity | Opening = prior audited closing; balanced; no manual override post-audit | 2.6, 1.6 | P0 | M | 5 |
| 2.9 | Statements: R&P, P&L/Trading, Balance Sheet | Statutory output | Generated from shared layer; A=L+E; tie to TB; per-type format | 2.6 | P0 | L | 5 |
| 2.10 | Year-end closing + appropriation | Close correctly | Accruals/provisions/NPA → closing → reserve≥25%→education→funds→dividend; FY lock | 2.9 | P0 | L | 5 |

## E3 — Member & Capital
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 3.1 | Member registration + register (Form I) | Statutory members | Unique no.; KYC; nominee mandatory; committee approval; never delete (inactive) | E1 | P0 | M | 6 |
| 3.2 | Share capital (member-wise, Form J) | Capital accuracy | Member-wise ledger tied to control; issue/transfer/refund; certificate | 3.1, E2 | P0 | M | 6 |
| 3.3 | Transfer premium + cap | Compliance | Configurable cap (₹25k Maha housing); committee approval | 3.2 | P1 | S | 6 |
| 3.4 | Dividend computation + AGM gate | Statutory distribution | Within cap; reserve transferred first; AGM approval; dividend register | 3.2, 2.10 | P1 | M | 6 |

## E4 — Cash & Bank
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 4.1 | Cash receipts/payments + cash book | Daily ops | Serial receipts; cash book; daily verification; cash-limit alert | E2 | P0 | M | 5 |
| 4.2 | Bank book + contra | Bank ops | Bank txns; cash-bank transfer; cheque registers | E2 | P0 | M | 5 |
| 4.3 | Bank reconciliation (signed BRS) | Integrity | Monthly BRS; unmatched items; stale-cheque review | 4.2 | P1 | M | 9 |
| 4.4 | Petty cash (imprest) | Small expense control | Imprest; voucher; reconcile | 4.1 | P2 | S | 9 |

## E5 — Credit (Credit types)
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 5.1 | Loan lifecycle (apply→sanction→disburse) | Core credit business | Configurable products (ST/MT/LT); committee sanction; loan bond; disbursement voucher | E2, E3 | P0 | XL | 7 |
| 5.2 | Repayment + DCB tracking | Recovery discipline | EMI/repayment; demand-collection-balance; overdue ageing | 5.1 | P0 | L | 7 |
| 5.3 | **NPA classification + overdue-interest rule** | Correct income/audit | Config NPA policy + provisioning; overdue interest excluded from income | 5.2 | P0 | L | 7 |
| 5.4 | Deposits (SB/FD/RD/pigmy) | Deposit business | Configurable products; interest accrual; maturity/renewal; KYC | E2, E3 | P0 | L | 7 |

## E6 — Trading (Trading types)
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 6.1 | Purchase (indent→PO→GRN) + 3-way match | Purchase integrity | PO-GRN-invoice match; GST input; creditor ledger | E2 | P1 | L | 8 |
| 6.2 | Inventory (canonical stock formula) | No phantom stock | Single formula (opening+movements) shared by state/report/aggregator; valuation | 6.1 | P0 | L | 8 |
| 6.3 | Sales/POS + GST output | Sales business | Invoice; stock reduction; debtor; GST output; cash control | 6.2 | P1 | L | 8 |
| 6.4 | Procurement (MSP/pool) + agency reconciliation | Marketing/PACS | Pool accounting; farmer payment; agency settlement | 6.1 | P2 | L | 11 |

## E7 — Payroll & Assets
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 7.1 | Payroll + statutory deductions | Staff pay | Attendance/muster tie-out; PF/ESI/TDS; pay slips; returns | E2, E8 | P2 | L | 9 |
| 7.2 | Fixed assets + depreciation | Asset integrity | Asset register (property register); WDV depreciation; disposal approval | E2 | P2 | M | 9 |

## E8 — Compliance & Tax
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 8.1 | GST engine (rate config + ITC) | GST compliance | Config rates (effective-dated); output/input; return data | E2 | P1 | L | 9 |
| 8.2 | TDS engine (deduct + challan/return) | TDS compliance | PAN/section/rate; deposit by 7th; 24Q/26Q data | E2 | P1 | M | 9 |
| 8.3 | Compliance calendar + alerts | No missed deadlines | Monthly/quarterly/annual obligations; due alerts; status | E13 | P1 | M | 10 |
| 8.4 | Audit prep + objection register | Audit readiness | Reconciliations; objection tracking; rectification follow-up | 2.9 | P1 | M | 10 |

## E9 — Reporting & BI
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 9.1 | Statutory report set (per type) | Compliance output | R&P/P&L/BS/DCB templates; format compliance; export Excel/PDF | 2.9 | P1 | L | 10 |
| 9.2 | Role dashboards (7) | Decision support | Chairman/Manager/Accountant/Auditor/Procurement/Inventory/Compliance dashboards | 9.1 | P2 | L | 10 |
| 9.3 | Decision-intelligence alerts (15) | Risk visibility | Negative cash, overdue, NPA, tax due, duplicate payment, etc.; role-routed | E13 | P2 | M | 10 |

## E10 — Verticals
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 10.1 | Dairy Fat/SNF pricing + collection/fat-test | Dairy societies | Two-axis pricing; milk-collection & fat-test registers; producer payment | E2 | P2 | L | 11 |
| 10.2 | Housing funds (sinking/repair) + I & J registers | Housing societies | Sinking ≥0.25%/repair ~0.75% accrual; member dues; transfer premium cap | E2, E3 | P2 | L | 12 |
| 10.3 | Consumer POS/retail + patronage rebate | Consumer stores | POS billing; stock; rebate | E6 | P2 | M | 12 |
| 10.4 | Labour muster/wage + contract billing | Labour co-ops | Muster roll; wage register; works-contract billing | E7 | P3 | M | 13 |
| 10.5 | Industrial production costing | Industrial co-ops | Raw-material→production→finished-goods; piece-rate wage | E6 | P3 | M | 13 |
| 10.6 | Marketing pool accounting | Marketing co-ops | Pool per commodity/season; settlement; commission | 6.4 | P3 | M | 13 |

## E11 — Integrations
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 11.1 | Excel import/export | Onboarding & reports | Bulk import w/ validation; export | E2 | P1 | M | 12 |
| 11.2 | Legacy/Tally migration (opening balances) | Switch from incumbents | Masters + opening = audited closing; validation; reconciliation | 2.8, 11.1 | P1 | L | 12 |
| 11.3 | Bank statement/reconciliation feed | Reconciliation | Statement import; matching | 4.3 | P2 | M | 12 |
| 11.4 | GST portal / TDS utility export | Statutory filing | Return-ready files; format-versioned adapter | 8.1, 8.2 | P2 | M | 12 |
| 11.5 | NABARD/NLDR data flow (PACS) [Optional] | PACS statutory | NLDR-format export | E2 | P3 | L | later |

## E12 — Reliability & Offline
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 12.1 | Backup + point-in-time recovery | No data loss | Automated per-tenant backup; restore-tested | E1 | P0 | M | 2 |
| 12.2 | **Offline-first field capture + sync** | Market differentiator | Collection/receipt entry offline; **integrity-safe sync, guaranteed no loss** | 2.5 | P1 | XL | 11 |
| 12.3 | Disaster recovery / HA | Continuity | RPO/RTO defined; geo-redundant | 12.1 | P2 | L | later |

## E13 — Notifications & Documents
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 13.1 | Document management (retention) | Statutory evidence | Upload/index; ≥10-yr retention; linkage to entities/audit | E1 | P1 | M | 10 |
| 13.2 | Notification engine (SMS/email/app) | Engagement & compliance | Provider-agnostic; event catalog; DLT for SMS | E1 | P1 | M | 10 |

## E14 — AI Readiness [Optional/Deferred]
| # | User story | Value | Acceptance criteria | Deps | Pri | Cx | Sprint |
|---|---|---|---|---|---|---|---|
| 14.1 | Event stream + clean-data foundation | Future AI | Events emitted; analytics store separated | E2 | P3 | L | later |

---

## Sprint plan (summary)
| Sprint | Theme | Key stories |
|---|---|---|
| **1** | Tenancy + auth + RBAC | 1.1–1.3 |
| **2** | Governance foundation | 1.4–1.8, 12.1 |
| **3** | COA + voucher engine + integrity | 2.1–2.3, 2.5 |
| **4** | GL + TB + reversal | 2.4, 2.6, 2.7 |
| **5** | Opening balances + statements + cash/bank | 2.8–2.10, 4.1–4.2 |
| **6** | Member + share + dividend | 3.1–3.4 |
| **7** | Credit (loans + deposits + NPA) | 5.1–5.4 |
| **8** | Trading (purchase + inventory + sales) | 6.1–6.3 |
| **9** | Reconciliation + tax + payroll + assets | 4.3–4.4, 7.1–7.2, 8.1–8.2 |
| **10** | Reporting + dashboards + compliance + docs/notify | 8.3–8.4, 9.1–9.3, 13.1–13.2 |
| **11** | First vertical (dairy) + offline foundation | 10.1, 6.4, 12.2 |
| **12** | Migration + integrations + housing vertical | 11.1–11.4, 10.2–10.3 |
| **13+** | Remaining verticals, DR/HA, AI readiness | 10.4–10.6, 12.3, 14.1, 11.5 |

## Critical path
E1 (tenancy→auth→RBAC→audit→FY) → E2 (COA→voucher engine→**integrity save contract**→GL→TB→statements→year-end) → E3/E4 → E5/E6 → verticals. **The accounting core (E2), and within it the voucher engine + data-integrity save contract, is the single hardest critical-path item** — nothing above it is safe until it is correct.

## High-risk items
| Item | Why | Mitigation |
|---|---|---|
| 2.2 Voucher engine (XL) | Foundation of everything; hardest to change later | Design review; extensive tests before dependents build |
| 2.5 Data-integrity save contract | #1 correctness risk (silent divergence) | Rollback + two-step persist; verified end-to-end early |
| 5.3 NPA/overdue-interest | #1 audit-defect area; wrong income | NABARD/RBI-aligned config; auditor review |
| 6.2 Inventory formula | Phantom-stock class of bug | Single canonical formula shared by all consumers |
| 12.2 Offline sync (XL) | Differentiator but conflict-prone | Integrity-safe sync; limited scope first (collection/receipt) |
| 11.2 Migration opening balances | Wrong opening books poison everything | Tie to audited closing; reconciliation gate |

## Blockers
- E2 blocks E3–E10 (no module works without accounting core).
- 1.6 FY-lock blocks year-end (2.10) and all period integrity.
- 2.5 integrity contract blocks safe rollout of any save path.
- 8.x tax config blocks payroll (7.1) statutory deductions.

## Quick wins
| Item | Why quick | Value |
|---|---|---|
| 2.3 Voucher numbering (S) | Small, self-contained | Audit continuity early |
| 3.3 Transfer premium cap (S) | Config-driven | Compliance signal |
| 4.4 Petty cash (S) | Isolated | Daily usefulness |
| 8.3 Compliance calendar (M) | Config + alerts, high visibility | Prevents penalties; strong demo |
| 9.2 Dashboards (once 9.1 done) | Reuse report layer | High perceived value |
| 11.1 Excel import/export (M) | Standard | Unblocks onboarding & trust |

*End of Backlog 5.1 — development-ready backlog from approved research/blueprints only. STOP.*
